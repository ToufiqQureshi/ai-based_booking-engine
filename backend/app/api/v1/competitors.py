from typing import List, Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy import func
from sqlmodel import select, desc
from datetime import date, timedelta, datetime
import json
import logging
from pydantic import BaseModel, Field as PydanticField, field_validator

from app.api.deps import CurrentUser, DbSession, require_hotel_role
from app.core.feature_flags import require_feature
from app.core.tasks import safe_background
from app.core.decodo_usage import record_decodo_request, get_usage_summary
from app.models.competitor import Competitor, CompetitorRate, CompetitorSource, ScraperUsage
from app.models.hotel import Hotel
from app.models.room import RoomType
from app.core.redis_client import redis_client
from app.core.database import async_session
from app.core.config import get_settings
import re
import random
import uuid
import httpx
import asyncio
from scrapling import Selector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])

def check_rate_shopper_feature(current_user: CurrentUser):
    if not current_user.hotel or not getattr(current_user.hotel, "feature_rate_shopper", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rate Shopper feature is not enabled for your subscription plan"
        )

@router.get("", response_model=List[Competitor])
async def list_competitors(current_user: CurrentUser, session: DbSession):
    """List all competitors for current hotel"""
    check_rate_shopper_feature(current_user)
    query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    competitors = result.scalars().all()

    # Self-heal: nothing else ever revisits a competitor stuck on "running"
    # (e.g. the worker restarted mid-scrape), so without this the Refresh
    # button stays disabled and the UI polls forever. Surface it as a
    # retryable failure the moment the hotelier looks at the page.
    healed = False
    for comp in competitors:
        if _is_stale_running(comp):
            comp.last_scrape_status = "failed"
            comp.last_scrape_error = "Scrape timed out (the server may have restarted mid-run). Please try refreshing again."
            session.add(comp)
            healed = True
    if healed:
        await session.commit()

    return competitors

class CompetitorCreate(BaseModel):
    """
    Request body for adding a competitor.

    Deliberately a *narrow* schema — the table model `Competitor` was
    previously accepted directly as the request body, which let a client
    set `id`, `hotel_id`, `is_active`, `last_scrape_status` and other
    server-managed fields (mass assignment). Only `name`/`url`/`source`
    are attacker-controlled inputs; everything else is derived server-side.
    """
    name: str
    url: str
    source: CompetitorSource = CompetitorSource.MAKEMYTRIP

    @field_validator("name")
    @classmethod
    def _name_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("url")
    @classmethod
    def _url_must_be_http(cls, v: str) -> str:
        v = (v or "").strip()
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("URL must start with http:// or https://")
        return v


@router.post("", response_model=Competitor)
async def add_competitor(comp_data: CompetitorCreate, current_user: CurrentUser, session: DbSession):
    """Add a new competitor to track"""
    check_rate_shopper_feature(current_user)

    # Enforce per-hotel competitor limit (configurable by super-admin, default 5)
    count_res = await session.execute(
        select(func.count()).select_from(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    )
    current_count = count_res.scalar() or 0
    max_comps = getattr(current_user.hotel, "max_competitors", None) or 5
    if current_count >= max_comps:
        raise HTTPException(
            status_code=409,
            detail=f"COMPETITOR_LIMIT_REACHED:{max_comps}",
        )

    # Check for duplicates (URL or Name)
    existing = await session.execute(
        select(Competitor).where(
            Competitor.hotel_id == current_user.hotel_id,
            (Competitor.url == comp_data.url) | (Competitor.name == comp_data.name)
        )
    )
    existing_comp = existing.scalars().first()

    if existing_comp:
        return existing_comp

    comp = Competitor(
        hotel_id=current_user.hotel_id,
        name=comp_data.name,
        url=comp_data.url,
        source=comp_data.source,
    )
    session.add(comp)
    await session.commit()
    await session.refresh(comp)

    return comp

# Decodo Scraper API Configuration
DECODO_URL = "https://scraper-api.decodo.com/v2/scrape"

# A scrape walks 7 days sequentially with a 2-4s pause between each Decodo
# call; this is the generous upper bound for a healthy run. Past this we
# treat "running" as a crashed/orphaned worker rather than work-in-progress
# (no other job ever revisits these rows otherwise — see _is_stale_running).
STALE_SCRAPE_MINUTES = 20

# Each manual "Refresh Rates" click burns ~7 paid Decodo requests (premium
# proxy + headless render). This cooldown stops a few impatient clicks from
# multiplying our third-party bill — see CLAUDE.md "bound every cost".
MANUAL_SCRAPE_COOLDOWN_SECONDS = 15 * 60


def _decodo_auth_header() -> Optional[str]:
    """
    Build the Decodo Basic-auth header from the configured env var.

    IMPORTANT: there must be NO hardcoded fallback credential here. A prior
    version of this code shipped one as a default value — that's the exact
    same class of bug as the leaked Razorpay secret CLAUDE.md warns about
    (a real, working third-party credential baked into git history forever).
    Missing config must surface as a clear "not configured" error instead.
    """
    token = get_settings().DECODO_AUTH_TOKEN
    if not token:
        return None
    return token if token.startswith("Basic ") else f"Basic {token}"


def _is_stale_running(comp: "Competitor") -> bool:
    """A 'running' row with no progress for STALE_SCRAPE_MINUTES is orphaned
    (worker restarted/crashed mid-scrape) — treat it as failed/retryable."""
    if comp.last_scrape_status != "running":
        return False
    if not comp.scrape_started_at:
        return True  # legacy rows from before we tracked start time
    return datetime.utcnow() - comp.scrape_started_at > timedelta(minutes=STALE_SCRAPE_MINUTES)


@router.post("/{comp_id}/scrape", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def trigger_scrape(comp_id: str, current_user: CurrentUser, session: DbSession, background_tasks: BackgroundTasks):
    """Manually trigger a scrape"""
    check_rate_shopper_feature(current_user)

    # Fetch competitor and verify ownership
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    settings = get_settings()
    if not settings.DECODO_AUTH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Rate sync is temporarily unavailable. Our team has been notified — please try again shortly."
        )

    # Don't allow a second concurrent scrape for the same competitor — this
    # both prevents racing writes to the same CompetitorRate rows and stops
    # double-clicks / multiple tabs from doubling the paid Decodo API calls.
    if comp.last_scrape_status == "running" and not _is_stale_running(comp):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A scrape is already running for this competitor. Please wait for it to finish."
        )

    cooldown_key = f"scrape_cooldown:{comp_id}"
    r = redis_client.get_instance()
    if r:
        try:
            if not r.set(cooldown_key, "1", nx=True, ex=MANUAL_SCRAPE_COOLDOWN_SECONDS):
                ttl = r.ttl(cooldown_key)
                wait_minutes = max(1, ((ttl if ttl and ttl > 0 else MANUAL_SCRAPE_COOLDOWN_SECONDS) // 60) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait about {wait_minutes} more minute(s) before refreshing this competitor again."
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(f"Scrape cooldown check failed (failing open): {exc}")

    # Set status to running
    comp.last_scrape_status = "running"
    comp.last_scrape_error = None
    comp.scrape_started_at = datetime.utcnow()
    session.add(comp)
    await session.commit()

    safe_background(background_tasks, lambda: run_background_scrape(comp_id), task_name="competitor_rate_scrape")
    return {"message": "Scrape started in background"}


@router.post("/{comp_id}/stop", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def stop_scrape(comp_id: str, current_user: CurrentUser, session: DbSession):
    """
    Stop an in-progress scrape. Any days already fetched stay saved (the
    background job commits each day as it goes) — we just signal it to stop
    before it burns more paid API calls on the remaining days.
    """
    check_rate_shopper_feature(current_user)

    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    if comp.last_scrape_status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No scrape is currently running for this competitor.",
        )

    # The background loop polls this Redis flag at the top of each day's
    # iteration; TTL is a safety net so a stale flag can never block a future run.
    r = redis_client.get_instance()
    if r:
        try:
            r.set(f"scrape_cancel:{comp_id}", "1", ex=600)
        except Exception as exc:
            logger.warning(f"Failed to set scrape cancel flag for {comp_id}: {exc}")
            raise HTTPException(status_code=503, detail="Could not request stop right now. Please try again.")

    # Force-update status in DB immediately so the frontend stops polling / showing "running"
    # and recovers instantly. The background task checks the redis cancellation key on its 
    # next loop iteration/check-in and exits early without overriding this.
    comp.last_scrape_status = "success"
    comp.last_scrape_error = "Stopped by you."
    session.add(comp)
    await session.commit()

    return {"message": "Stopping scrape — already-fetched rates are saved."}


def get_dynamic_dates(offset):
    today = datetime.now()
    checkin = (today + timedelta(days=offset)).strftime("%d%m%Y")
    checkout = (today + timedelta(days=offset + 1)).strftime("%d%m%Y")
    return checkin, checkout

def clean_makemytrip_url(url: str, checkin: str, checkout: str) -> str:
    """
    Update checkin/checkout dates in a MakeMyTrip URL while preserving ALL
    other query parameters.

    The old implementation rebuilt a stripped-down URL with only hotelId+city,
    which broke region-based resort listings that rely on topHtlId, locusId,
    locusType, and searchText to resolve the correct hotel page.  Replacing
    just the date tokens avoids that regression.
    """
    url = re.sub(r"checkin=\d{8}", f"checkin={checkin}", url)
    url = re.sub(r"checkout=\d{8}", f"checkout={checkout}", url)
    return url

def update_url_dates(url, offset):
    checkin, checkout = get_dynamic_dates(offset)
    if "makemytrip.com" in url.lower():
        return clean_makemytrip_url(url, checkin, checkout)
    url = re.sub(r"checkin=\d{8}", f"checkin={checkin}", url)
    url = re.sub(r"checkout=\d{8}", f"checkout={checkout}", url)
    return url


async def scrape_mmt_hotel_rate(url: str, hotel_id: str, session_id: Optional[str] = None) -> dict:
    """
    Performs extraction by fetching HTML via Decodo Scraper API and parsing it
    with Scrapling Selector.

    session_id: When provided, Decodo reuses the same proxy IP for all requests
    in the same session (up to 10 min). This is critical — without a session_id,
    geo:in gets a fresh IP each time and MakeMyTrip's Akamai consistently blocks
    the first request (613 error). With a session_id the connection is warmed up
    and subsequent requests succeed reliably.
    """
    auth_header = _decodo_auth_header()
    if not auth_header:
        return {"status": "failed", "reason": "decodo_not_configured"}

    try:
        logger.info(f"Fetching Hotel URL via Decodo API: {url[:60]}... (session={session_id})")

        payload: dict = {
            "url": url,
            "proxy_pool": "premium",
            "headless": "html",
            "geo": "in",
            "device_type": "desktop_chrome",
        }
        # session_id pins all 7-day requests to the same Decodo proxy IP,
        # which avoids Akamai's per-IP challenge on fresh connections.
        if session_id:
            payload["session_id"] = session_id

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "authorization": auth_header
        }

        # Native async HTTP client — matches the rest of the codebase
        # (external_sync/channel_manager/analytics all use httpx.AsyncClient).
        # The previous `requests` + run_in_executor combo borrowed threads
        # from the shared default executor, which Starlette also uses for
        # sync route handlers — under concurrent scrapes that risks starving
        # unrelated requests.
        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                response = await client.post(DECODO_URL, json=payload, headers=headers)
        except httpx.HTTPError as e:
            # Network/timeout — Decodo may have already received and billed the request,
            # so record usage here too for transparency.
            record_decodo_request(hotel_id)
            logger.error(f"Decodo API request failed before a response was received: {e}")
            return {"status": "failed", "reason": f"request_error_{type(e).__name__}"}

        # Decodo bills per processed request regardless of whether we end up
        # finding a price — record it so the hotelier can see exactly what
        # we're spending on their behalf (we resell this third-party capacity).
        record_decodo_request(hotel_id)

        if response.status_code != 200:
            logger.error(f"Decodo API returned status code {response.status_code}: {response.text[:200]}")
            return {"status": "failed", "reason": f"API_status_{response.status_code}"}

        res_json = response.json()

        # Decodo status_code 613 = target scraping failed (Akamai/bot-protection
        # blocked the request). This can happen even with session_id on the very
        # first warm-up request — treat it as a transient failure so the caller
        # can retry rather than marking the whole scrape as broken.
        decodo_status = res_json.get("status_code")
        if decodo_status == 613:
            logger.warning(f"Decodo 613 (blocked by target) for {url[:60]}")
            return {"status": "failed", "reason": "decodo_613_target_blocked"}

        if not res_json.get("results") or len(res_json["results"]) == 0:
            logger.error("Decodo API response doesn't contain results key or results list is empty")
            return {"status": "failed", "reason": "empty_api_results"}
            
        first_result = res_json["results"][0]
        html_content = first_result.get("content", "")
        
        # Check for blocking
        if "access denied" in html_content.lower() or "access-denied" in html_content.lower() or "reference id" in html_content.lower():
            logger.error("Blocked by Akamai (Access Denied / Reference ID)")
            return {"status": "blocked", "reason": "shield_blocked"}
            
        page = Selector(html_content)
        
        # Check if sold out
        sold_out_check = page.css("p.font14.appendBottom5.redText.latoBold.lineHight17").first
        if sold_out_check and "You Just Missed It" in sold_out_check.text:
            return {"status": "success", "price": 0.0, "is_sold_out": True}
            
        price_el = page.css('p.priceText.latoBlack.font22.blackText.appendBottom5[id="hlistpg_hotel_shown_price"]').first
        if not price_el:
            price_el = page.css('#hlistpg_hotel_shown_price').first
            
        if not price_el:
            logger.warning("Scrape finished but Hotel Price element could not be found.")
            return {"status": "failed", "reason": "price_element_not_found"}

        # MMT renders the price as: <p id="hlistpg_hotel_shown_price">₹ <span>2,449</span></p>
        # Scrapling's .text already aggregates child text, so the element text is
        # typically "₹ 2,449".  We extract the FIRST contiguous digit-and-comma
        # group to get a clean number — avoids the double-collection bug where
        # iterating css("*") duplicated child text into "₹ 2,449 ₹ 2,449" and
        # then stripping gave the wrong value 24492449 instead of 2449.
        price_text = price_el.text or ""

        # If parent text is only a currency symbol (no digits), also check children
        if not re.search(r"\d", price_text):
            for child in price_el.css("*"):
                child_text = child.text or ""
                if re.search(r"\d", child_text):
                    price_text = child_text
                    break

        # Extract the FIRST number token (e.g. "2,449" → "2449")
        price_match = re.search(r"[\d,]+", price_text)
        if not price_match:
            logger.warning(f"Could not parse price digits from raw text: {price_text!r}")
            return {"status": "failed", "reason": "price_parse_failed"}

        price_digits = re.sub(r"[^\d]", "", price_match.group())
        if not price_digits:
            logger.warning(f"Empty digits after cleaning: {price_text!r}")
            return {"status": "failed", "reason": "price_parse_failed"}

        price = float(price_digits)
        logger.info(f"Parsed price: Rs.{price:,.0f} from text {price_text!r}")
        return {"status": "success", "price": price, "is_sold_out": False}
        
    except Exception as e:
        logger.error(f"Scraper error: {e}")
        return {"status": "failed", "reason": str(e)}

async def run_background_scrape(comp_id: str):
    """
    Run competitor rate scraping in the background using Decodo API + Scrapling.
    Scrapes the next 7 days of rates.
    """
    logger.info(f"Starting Background Scrape for competitor ID: {comp_id}")
    # Declare before try so crash handler can read how many days were actually attempted.
    attempted = 0

    try:
        async with async_session() as session:
            comp = await session.get(Competitor, comp_id)
            if not comp:
                logger.error(f"Competitor {comp_id} not found for background scrape")
                return

            # Guard against double-execution (e.g. the scheduled auto-scrape
            # firing while a manual refresh is mid-flight, or vice versa) —
            # each run burns paid Decodo calls, so we never want two at once
            # for the same competitor unless the previous one is orphaned.
            if comp.last_scrape_status == "running" and not _is_stale_running(comp):
                logger.info(f"Skipping scrape for {comp_id} — a run is already in progress")
                return

            comp.last_scrape_status = "running"
            comp.last_scrape_error = None
            comp.scrape_started_at = datetime.utcnow()
            session.add(comp)
            await session.commit()

            url = comp.url
            hotel_id = comp.hotel_id
            is_mmt = comp.source == CompetitorSource.MAKEMYTRIP or "makemytrip.com" in url.lower()
            
            if not is_mmt:
                comp.last_scrape_status = "failed"
                comp.last_scrape_error = f"Background scrape only supported for MakeMyTrip. Competitor source is {comp.source}."
                session.add(comp)
                await session.commit()
                logger.warning(f"Background scrape only supported for MakeMyTrip. Competitor source: {comp.source}")
                return
                
            logger.info(f"Scraping MakeMyTrip URL for competitor: {comp.name} ({comp_id})")

            # One session_id per scrape run so all 7 days share the same Decodo
            # proxy IP. Akamai treats a warmed-up IP much more leniently than a
            # fresh one, which is why the previous code (no session_id) got 613
            # errors consistently on geo:in.
            scrape_session_id = uuid.uuid4().hex[:12]

            success_count = 0
            # `attempted` is pre-declared before the outer try for crash-handler access
            has_errors = False
            last_error_reason = None
            was_stopped = False
            cancel_key = f"scrape_cancel:{comp_id}"

            # We define an inner async helper function to scrape a single offset day.
            # Running this concurrently allows all 7 days to be fetched in parallel.
            async def scrape_single_day(offset_val: int):
                try:
                    # Stagger launches slightly (e.g. 250ms spacing) so we don't dump 
                    # all requests onto the Decodo endpoint in the same exact millisecond.
                    await asyncio.sleep(offset_val * 0.25)
                    
                    # Check cancellation flag before making the HTTP call
                    try:
                        _rc = redis_client.get_instance()
                        if _rc and _rc.get(cancel_key):
                            return {"status": "stopped", "offset": offset_val, "date": date.today() + timedelta(days=offset_val)}
                    except Exception as cancel_err:
                        logger.warning(f"Scrape cancel-flag check failed (ignoring): {cancel_err}")
                    
                    check_in_date_obj = date.today() + timedelta(days=offset_val)
                    updated_url = update_url_dates(url, offset_val)
                    
                    rate_data = await scrape_mmt_hotel_rate(updated_url, hotel_id, session_id=scrape_session_id)
                    return {
                        "status": rate_data.get("status"),
                        "offset": offset_val,
                        "date": check_in_date_obj,
                        "price": rate_data.get("price"),
                        "is_sold_out": rate_data.get("is_sold_out"),
                        "reason": rate_data.get("reason"),
                    }
                except Exception as ex:
                    logger.error(f"Task error in scrape_single_day for offset {offset_val}: {ex}")
                    return {
                        "status": "failed",
                        "offset": offset_val,
                        "date": date.today() + timedelta(days=offset_val),
                        "reason": str(ex),
                    }

            # Launch all 7 scrape tasks concurrently.
            # as_completed processes each result the moment it finishes —
            # we commit + clear the Redis cache after EACH day so the
            # frontend polling sees prices appear one by one in real-time
            # instead of waiting for all 7 to finish before anything shows.
            pending_tasks = [
                asyncio.create_task(scrape_single_day(offset))
                for offset in range(7)
            ]

            for coro in asyncio.as_completed(pending_tasks):
                res = await coro

                # Check cancellation flag — cancel remaining tasks if set
                try:
                    _rc = redis_client.get_instance()
                    if _rc and _rc.get(cancel_key):
                        _rc.delete(cancel_key)
                        was_stopped = True
                        # Cancel all still-running tasks to stop burning Decodo credits
                        for t in pending_tasks:
                            t.cancel()
                except Exception as cancel_err:
                    logger.warning(f"Scrape cancel-flag check failed (ignoring): {cancel_err}")

                if was_stopped or res["status"] == "stopped":
                    was_stopped = True
                    logger.info(f"Scrape for {comp_id} stopped/cancelled by user after {attempted} days processed")
                    break

                attempted += 1
                check_in_date_obj = res["date"]

                if res["status"] == "success":
                    price = res["price"]
                    is_sold_out = res["is_sold_out"]
                    
                    # Check if rate already exists for this competitor and date
                    stmt = select(CompetitorRate).where(
                        CompetitorRate.competitor_id == comp_id,
                        CompetitorRate.check_in_date == check_in_date_obj
                    )
                    db_res = await session.execute(stmt)
                    existing_rate = db_res.scalar_one_or_none()
                    
                    if existing_rate:
                        existing_rate.price = price
                        existing_rate.is_sold_out = is_sold_out
                        existing_rate.fetched_at = datetime.utcnow()
                        session.add(existing_rate)
                    else:
                        new_rate = CompetitorRate(
                            competitor_id=comp_id,
                            check_in_date=check_in_date_obj,
                            price=price,
                            is_sold_out=is_sold_out,
                            fetched_at=datetime.utcnow()
                        )
                        session.add(new_rate)
                    
                    # Commit immediately after each day — frontend sees the price
                    # as soon as Decodo returns it, not after all 7 are done.
                    await session.commit()
                    success_count += 1
                    logger.info(f"Ingested rate for {comp.name} on {check_in_date_obj.isoformat()}: {price} (Sold out: {is_sold_out})")
                    
                    # Clear cache immediately so the next frontend poll picks up this day's price
                    try:
                        r = redis_client.get_instance()
                        if r:
                            keys_to_delete = r.keys(f"rate_comparison:{comp.hotel_id}:*") + r.keys(f"market_analysis:{comp.hotel_id}:*")
                            if keys_to_delete:
                                r.delete(*keys_to_delete)
                    except Exception as cache_err:
                        logger.warning(f"Failed to clear competitor cache: {cache_err}")
                else:
                    has_errors = True
                    last_error_reason = res.get("reason", "Unknown scraping failure")
                    logger.warning(f"Failed to scrape rate for {comp.name} on {check_in_date_obj.isoformat()}: {last_error_reason}")
            
            # Update final status
            comp = await session.get(Competitor, comp_id)
            if comp:
                if success_count > 0:
                    comp.last_scrape_status = "success"
                    if was_stopped:
                        comp.last_scrape_error = f"Stopped by you — saved {success_count} day(s) of rates fetched so far."
                    elif has_errors:
                        comp.last_scrape_error = f"Successfully scraped {success_count}/7 days. Some dates failed: {last_error_reason}"
                    else:
                        comp.last_scrape_error = None
                    comp.last_scraped_at = datetime.utcnow()
                elif was_stopped:
                    # Stopped before any day completed — nothing saved, but this
                    # isn't a failure, so don't show a scary red error.
                    comp.last_scrape_status = "success"
                    comp.last_scrape_error = "Stopped by you before any rates were fetched."
                else:
                    comp.last_scrape_status = "failed"
                    comp.last_scrape_error = f"Scraping failed on all dates: {last_error_reason}"
                session.add(comp)

                # Log usage — bill only for the days we actually attempted, so a
                # stopped run doesn't over-report (and over-charge) the hotel.
                usage = ScraperUsage(
                    hotel_id=comp.hotel_id,
                    competitor_id=comp_id,
                    request_count=attempted,
                    status="success" if success_count > 0 else "failed"
                )
                session.add(usage)
                await session.commit()
                
    except Exception as e:
        logger.error(f"Background Scrape CRASHED for {comp_id}: {e}")
        try:
            async with async_session() as session:
                comp = await session.get(Competitor, comp_id)
                if comp:
                    comp.last_scrape_status = "failed"
                    comp.last_scrape_error = f"Internal system crash: {str(e)}"
                    session.add(comp)
                    
                    # Log failed usage — use the actual attempted count, not a hardcoded 7
                    usage = ScraperUsage(
                        hotel_id=comp.hotel_id,
                        competitor_id=comp_id,
                        request_count=attempted,
                        status="failed"
                    )
                    session.add(usage)
                    await session.commit()
        except Exception as db_err:
            logger.error(f"Failed to record crash status in database: {db_err}")

@router.delete("/{comp_id}")
async def delete_competitor(comp_id: str, current_user: CurrentUser, session: DbSession):
    """Delete a competitor and all their rate history"""
    check_rate_shopper_feature(current_user)
    comp = await session.get(Competitor, comp_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
        
    if comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Delete rates explicitly first (if cascade not set, safe bet)
    rates_stmt = select(CompetitorRate).where(CompetitorRate.competitor_id == comp_id)
    rates_res = await session.execute(rates_stmt)
    rates = rates_res.scalars().all()
    for r in rates:
        await session.delete(r)
        
    await session.delete(comp)
    await session.commit()
    
    return {"message": "Competitor deleted successfully"}

@router.patch("/{comp_id}/schedule", response_model=Competitor)
async def toggle_competitor_schedule(comp_id: str, payload: Dict[str, bool], current_user: CurrentUser, session: DbSession):
    """Toggle scheduling (automatic daily refresh) for a competitor"""
    check_rate_shopper_feature(current_user)
    
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")
        
    comp.is_scheduled = payload.get("is_scheduled", False)
    session.add(comp)
    await session.commit()
    await session.refresh(comp)
    return comp


# --- Market Analysis ---

class MarketAnalysisResult(BaseModel):
    date: str
    my_price: float
    lowest_market_price: float
    average_market_price: float
    highest_market_price: float
    market_position: str # "Premium", "Budget", "Average"
    suggestion: str

@router.get("/analysis", response_model=List[MarketAnalysisResult], dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_market_analysis(
    current_user: CurrentUser,
    session: DbSession,
    days: int = 7,
    start_date: date = None
):
    check_rate_shopper_feature(current_user)
    """
    Analyzes market rates for the next N days.
    Optimized: 15s -> <500ms using Redis + Efficient Queries
    """
    today = start_date if start_date else date.today()

    # 1. Check Redis Cache (Market Analysis is heavy, cache for 1 hour)
    cache_key = f"market_analysis:{current_user.hotel_id}:{today.isoformat()}"
    r = None
    try:
        r = redis_client.get_instance()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as cache_err:
        logger.warning("Redis cache read failed for %s: %s", cache_key, cache_err)

    end_date = today + timedelta(days=days)

    # 1. Fetch My Rates (First Room Type)
    rt_query = select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    rt_res = await session.execute(rt_query)
    room_type = rt_res.scalars().first()

    if not room_type:
        return []

    # Get my rates map
    my_rates_map = {}
    base_price = room_type.base_price
    # Default to base price
    for i in range(days):
        d = today + timedelta(days=i)
        my_rates_map[d] = base_price

    # 2. Fetch Competitor Rates efficiently (Use Index!)
    # Instead of fetching ALL rates and filtering in Python, fetch only needed range
    # And crucially, we need the LATEST fetch only.

    comp_ids_result = await session.execute(select(Competitor.id).where(Competitor.hotel_id == current_user.hotel_id))
    comp_ids = comp_ids_result.scalars().all()
    
    rates_by_date = {}

    if comp_ids:
        # Optimized Query: Fetch only rates in range, ordered by fetch time DESC
        # We rely on Python to pick the first one (latest) per (comp, date) pair
        # This is faster than complex SQL subqueries for small N (days=7)
        rate_query = select(CompetitorRate).where(
            CompetitorRate.competitor_id.in_(comp_ids),
            CompetitorRate.check_in_date >= today,
            CompetitorRate.check_in_date < end_date
        ).order_by(
            CompetitorRate.competitor_id,
            CompetitorRate.check_in_date,
            desc(CompetitorRate.fetched_at)
        )

        rates_res = await session.execute(rate_query)
        all_rates = rates_res.scalars().all()

        # Group by date - Keeping only the FIRST encountered (which is Latest due to DESC sort)
        seen_keys = set()

        for rate in all_rates:
            key = (rate.competitor_id, rate.check_in_date)
            if key not in seen_keys:
                seen_keys.add(key)
                if rate.check_in_date not in rates_by_date:
                    rates_by_date[rate.check_in_date] = []
                rates_by_date[rate.check_in_date].append(rate.price)

    # 3. Analyze
    results = []
    for i in range(days):
        d = today + timedelta(days=i)
        my_price = my_rates_map.get(d, 0)
        market_prices = rates_by_date.get(d, [])

        if not market_prices:
            # No data
            results.append({
                "date": d.isoformat(),
                "my_price": my_price,
                "lowest_market_price": 0,
                "average_market_price": 0,
                "highest_market_price": 0,
                "market_position": "Unknown",
                "suggestion": "No competitor data available. Please trigger a refresh to fetch latest rates."
            })
            continue

        lowest = min(market_prices)
        highest = max(market_prices)
        avg = sum(market_prices) / len(market_prices)

        # Position Logic
        if my_price > avg * 1.1:
            position = "Premium"
            suggestion = "Price is significantly higher than market average. Consider lowering if occupancy is low."
        elif my_price < avg * 0.9:
            position = "Budget"
            suggestion = "Price is lower than market. Opportunity to increase rate."
        else:
            position = "Average"
            suggestion = "Price is competitive with market average."

        results.append({
            "date": d.isoformat(),
            "my_price": my_price,
            "lowest_market_price": lowest,
            "average_market_price": int(avg),
            "highest_market_price": highest,
            "market_position": position,
            "suggestion": suggestion
        })

    # Cache for 1 Hour
    if r:
        try:
            r.setex(cache_key, 3600, json.dumps(results))
        except Exception as cache_err:
            logger.warning("Redis cache write failed for %s: %s", cache_key, cache_err)

    return results


@router.get("/rates/comparison", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_rate_comparison(current_user: CurrentUser, session: DbSession, start_date: date = None):
    check_rate_shopper_feature(current_user)
    """
    Get data for chart: My Rate vs Competitors for next 7 days.
    """
    today = start_date if start_date else date.today()
    end_date = today + timedelta(days=7)
    
    # Cache Check
    cache_key = f"rate_comparison:{current_user.hotel_id}:{today.isoformat()}"
    r = None
    try:
        r = redis_client.get_instance()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as cache_err:
        logger.warning("Redis cache read failed for %s: %s", cache_key, cache_err)

    # 1. Fetch My Rates
    rt_query = select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    rt_res = await session.execute(rt_query)
    room_type = rt_res.scalars().first()
    
    my_rates_map = {}
    if room_type:
        base_price = room_type.base_price
        for i in range(7):
            d = today + timedelta(days=i)
            my_rates_map[d] = base_price
            
    # 2. Fetch Competitor Rates
    comp_query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    comp_res = await session.execute(comp_query)
    competitors = comp_res.scalars().all()
    
    # 3. Bulk Fetch Competitor Rates (Optimization)
    comp_ids = [c.id for c in competitors]
    rates_map = {} # (competitor_id, check_in_date) -> RateObj
    
    if comp_ids:
        # Fetch all rates for these competitors in the date range in ONE query
        rate_query = select(CompetitorRate).where(
            CompetitorRate.competitor_id.in_(comp_ids),
            CompetitorRate.check_in_date >= today,
            CompetitorRate.check_in_date < end_date
        ).order_by(desc(CompetitorRate.fetched_at)) # Latest first

        rate_res = await session.execute(rate_query)
        all_rates = rate_res.scalars().all()

        # Populate map (since ordered by fetched_at desc, first encounter is latest)
        for rate in all_rates:
            key = (rate.competitor_id, rate.check_in_date)
            if key not in rates_map:
                rates_map[key] = rate

    # 4. Build Response Data (Iterate 7 days)
    chart_data = [] 
    table_data = []
    
    for i in range(7):
        d = today + timedelta(days=i)
        date_str = d.strftime("%d %b")
        
        # Initialize Day Chart
        day_chart = {
            "date": date_str,
            "My Hotel": my_rates_map.get(d, 0)
        }
        
        # Initialize Day Table
        day_table = {
            "date": date_str,
            "full_date": d.isoformat(),
            "my_rate": {
                "price": my_rates_map.get(d, 0),
                "room_type": room_type.name if room_type else "Standard" 
            },
            "competitors": {}
        }
        
        # Fill Competitor Data for this day
        for comp in competitors:
            # O(1) Lookup from memory
            rate = rates_map.get((comp.id, d))
            
            if rate:
                day_chart[comp.name] = rate.price
                day_table["competitors"][comp.name] = {
                    "price": rate.price,
                    "room_type": rate.room_type,
                    "is_sold_out": rate.is_sold_out,
                    "source": comp.source,
                    "url": comp.url
                }
        
        # Append to Main Lists
        chart_data.append(day_chart)
        table_data.append(day_table)
        
    final_res = {
        "chart_data": chart_data,
        "table_data": table_data,
        "competitors": [c.name for c in competitors]
    }

    # Cache for 1 Hour
    if r:
        try:
            r.setex(cache_key, 3600, json.dumps(final_res))
        except Exception as cache_err:
            logger.warning("Redis cache write failed for %s: %s", cache_key, cache_err)

    return final_res

# --- Decodo Usage (cost transparency for hoteliers) ---
# We buy this scraping capacity from a third party and resell it as the Rate
# Shopper feature — every request costs us money, so the hotelier should be
# able to see exactly how much is being used on their behalf.

@router.get("/usage", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_decodo_usage(current_user: CurrentUser):
    """Today's and last-30-days Decodo Scraper API request counts for this hotel."""
    check_rate_shopper_feature(current_user)
    return get_usage_summary(current_user.hotel_id)


# --- Auto-Scrape Schedule (hotelier picks the time of day) ---

class ScrapeScheduleResponse(BaseModel):
    scrape_hour: Optional[int] = None
    timezone: str = "Asia/Kolkata"


class ScrapeScheduleUpdate(BaseModel):
    scrape_hour: Optional[int] = PydanticField(default=None, ge=0, le=23)


@router.get(
    "/schedule",
    response_model=ScrapeScheduleResponse,
    dependencies=[Depends(require_feature("feature_rate_shopper"))],
)
async def get_scrape_schedule(current_user: CurrentUser, session: DbSession):
    check_rate_shopper_feature(current_user)
    hotel = await session.get(Hotel, current_user.hotel_id)
    hotel_settings = (hotel.settings if hotel else None) or {}
    return ScrapeScheduleResponse(
        scrape_hour=hotel_settings.get("rate_shopper_scrape_hour"),
        timezone=hotel_settings.get("timezone") or "Asia/Kolkata",
    )


@router.put(
    "/schedule",
    response_model=ScrapeScheduleResponse,
    dependencies=[
        Depends(require_hotel_role("OWNER", "MANAGER")),
        Depends(require_feature("feature_rate_shopper")),
    ],
)
async def update_scrape_schedule(payload: ScrapeScheduleUpdate, current_user: CurrentUser, session: DbSession):
    """
    Hotelier picks what local hour (0-23, in their property's configured
    timezone) the daily auto-scrape should run at. `null` turns auto-scrape
    off — competitors can still be refreshed manually at any time.
    """
    check_rate_shopper_feature(current_user)
    hotel = await session.get(Hotel, current_user.hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    new_settings = dict(hotel.settings or {})
    new_settings["rate_shopper_scrape_hour"] = payload.scrape_hour
    hotel.settings = new_settings
    session.add(hotel)
    await session.commit()

    return ScrapeScheduleResponse(
        scrape_hour=payload.scrape_hour,
        timezone=new_settings.get("timezone") or "Asia/Kolkata",
    )


# Per-hotel dedupe key TTL — fires at most once per calendar day even if the
# scheduler ticks hourly and the hour matches for >1 tick (DST edge cases etc).
AUTO_SCRAPE_DEDUPE_TTL = 23 * 3600


async def run_due_auto_scrapes(session) -> None:
    """
    Hourly scheduler tick (see app.core.scheduler): for every Rate-Shopper
    hotel that has chosen an auto-scrape hour — IN ITS OWN LOCAL TIMEZONE,
    the hotelier's choice, not ours — kick off a background scrape of all
    its active competitors once that local hour arrives.

    A Redis SETNX dedupe key per hotel-per-day prevents double-firing across
    instances/ticks even if the outer scheduler lock expires mid-run.
    """
    from zoneinfo import ZoneInfo

    now_utc = datetime.utcnow().replace(tzinfo=ZoneInfo("UTC"))

    hotels_res = await session.execute(
        select(Hotel.id, Hotel.settings).where(Hotel.feature_rate_shopper == True)
    )
    r = redis_client.get_instance()

    for hotel_id, hotel_settings in hotels_res.all():
        hotel_settings = hotel_settings or {}
        scrape_hour = hotel_settings.get("rate_shopper_scrape_hour")
        if scrape_hour is None:
            continue
        try:
            scrape_hour = int(scrape_hour)
            if not (0 <= scrape_hour <= 23):
                continue
        except (TypeError, ValueError):
            continue

        tz_name = hotel_settings.get("timezone") or "UTC"
        try:
            local_now = now_utc.astimezone(ZoneInfo(tz_name))
        except Exception:
            local_now = now_utc

        if local_now.hour != scrape_hour:
            continue

        dedupe_key = f"rate_shopper_auto_scrape:{hotel_id}:{local_now.strftime('%Y%m%d')}"
        try:
            if not r or not r.set(dedupe_key, "1", nx=True, ex=AUTO_SCRAPE_DEDUPE_TTL):
                continue
        except Exception as exc:
            logger.warning(f"Auto-scrape dedupe check failed for hotel {hotel_id}: {exc}")
            continue

        comp_res = await session.execute(
            select(Competitor.id).where(Competitor.hotel_id == hotel_id, Competitor.is_active == True)
        )
        comp_ids = comp_res.scalars().all()
        if not comp_ids:
            continue

        logger.info(
            f"Auto-scrape: triggering {len(comp_ids)} competitor(s) for hotel {hotel_id} "
            f"(local hour {scrape_hour}, tz {tz_name})"
        )
        # Sequential, not concurrent — keeps load (and the Decodo bill) for an
        # auto-run identical to a hotelier manually clicking "Refresh Rates"
        # on each competitor, one at a time.
        for comp_id in comp_ids:
            await run_background_scrape(comp_id)
