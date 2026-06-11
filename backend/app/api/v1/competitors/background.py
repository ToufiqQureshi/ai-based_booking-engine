"""
Background scrape job: walks 7 days for a single competitor, persisting rates
one day at a time so frontend polling shows live progress via Redis.
"""
import uuid
import json
import logging
import asyncio
from datetime import date, datetime, timedelta

from sqlmodel import select

from app.core.database import async_session
from app.core.redis_client import redis_client
from app.models.competitor import Competitor, CompetitorRate, CompetitorSource, ScraperUsage

from .scraper import (
    scrape_mmt_hotel_rate,
    update_url_dates,
    _is_stale_running,
    STALE_SCRAPE_MINUTES,
)

logger = logging.getLogger(__name__)

# Max retries on Decodo 613 (Akamai bot-block) per day.
# 3 attempts = 1 original + 2 retries. Retry delay starts at 4s then 8s.
MAX_613_RETRIES = 2

# Gap between sequential day scrapes — gives Akamai time to see the IP as
# "legitimate". Concurrent burst = same IP = 613 on all days.
INTER_DAY_PAUSE_SECONDS = 2.5


async def _scrape_mmt_with_retry(url: str, hotel_id: str, session_id: str) -> dict:
    """Wrap scrape_mmt_hotel_rate with 613-specific retry + exponential backoff."""
    delay = 4.0
    result = {}
    for attempt in range(MAX_613_RETRIES + 1):
        result = await scrape_mmt_hotel_rate(url, hotel_id, session_id=session_id)
        if result.get("reason") != "decodo_613_target_blocked":
            return result
        if attempt < MAX_613_RETRIES:
            logger.info(f"613 on attempt {attempt + 1}, retrying in {delay:.0f}s…")
            await asyncio.sleep(delay)
            delay *= 2
    return result


async def run_background_scrape(comp_id: str, status_pre_set: bool = False) -> None:
    """
    Scrape the next 7 days of rates for one competitor using Decodo + Scrapling.
    Commits each day individually so frontend polling shows live progress.

    status_pre_set=True when trigger_scrape already committed status="running"
    before enqueuing this task — skips the double-execution guard in that case.
    The guard still fires for the auto-scrape scheduler path (status_pre_set=False).
    """
    logger.info(f"Starting Background Scrape for competitor ID: {comp_id}")
    attempted = 0

    try:
        async with async_session() as session:
            comp = await session.get(Competitor, comp_id)
            if not comp:
                logger.error(f"Competitor {comp_id} not found for background scrape")
                return

            # Guard against double-execution — but skip when trigger_scrape already
            # set status="running" (otherwise we see our own "running" and exit).
            if not status_pre_set and comp.last_scrape_status == "running" and not _is_stale_running(comp):
                logger.info(f"Skipping scrape for {comp_id} — a run is already in progress")
                return

            comp.last_scrape_status = "running"
            comp.last_scrape_error = None
            comp.scrape_started_at = datetime.utcnow()
            session.add(comp)
            await session.commit()

            # Clear previous run's progress so frontend doesn't show stale toasts
            try:
                redis_client.delete_value(f"scrape_progress:{comp_id}")
            except Exception:
                pass

            url = comp.url
            hotel_id = comp.hotel_id
            is_mmt = comp.source == CompetitorSource.MAKEMYTRIP or "makemytrip.com" in url.lower()

            if not is_mmt:
                comp.last_scrape_status = "failed"
                comp.last_scrape_error = f"Background scrape only supported for MakeMyTrip. Source: {comp.source}."
                session.add(comp)
                await session.commit()
                logger.warning(f"Background scrape only supported for MakeMyTrip. Source: {comp.source}")
                return

            logger.info(f"Scraping MakeMyTrip URL for competitor: {comp.name} ({comp_id})")

            # One session_id per run so all 7 days share the same Decodo proxy IP.
            # Requests are sequential + inter-day pause so Akamai sees gradual traffic.
            scrape_session_id = uuid.uuid4().hex[:12]
            current_geo = "India"

            success_count = 0
            has_errors = False
            last_error_reason = None
            was_stopped = False
            cancel_key = f"scrape_cancel:{comp_id}"

            for offset in range(7):
                # Check cancellation flag before each day
                try:
                    if redis_client.get_value(cancel_key):
                        redis_client.delete_value(cancel_key)
                        was_stopped = True
                        logger.info(f"Scrape for {comp_id} cancelled by user after {attempted} days")
                        break
                except Exception as cancel_err:
                    logger.warning(f"Scrape cancel-flag check failed (ignoring): {cancel_err}")

                check_in_date_obj = date.today() + timedelta(days=offset)
                updated_url = update_url_dates(url, offset)
                attempted += 1

                rate_data = await _scrape_mmt_with_retry(updated_url, hotel_id, scrape_session_id)

                # Decodo session died, is blocked, got rate-limited, or got stuck — rotate and retry this day once.
                if rate_data.get("reason") in (
                    "decodo_session_failed",
                    "API_status_400",
                    "API_status_422",
                    "API_status_429",
                    "API_status_502",
                    "API_status_503",
                    "decodo_613_target_blocked",
                    "empty_html_content",
                    "shield_blocked",
                ):
                    logger.warning(
                        f"Rotating Decodo session due to {rate_data.get('reason')} (old={scrape_session_id}) "
                        f"and retrying day {offset + 1}/7"
                    )
                    scrape_session_id = uuid.uuid4().hex[:12]
                    await asyncio.sleep(3.0)
                    rate_data = await _scrape_mmt_with_retry(updated_url, hotel_id, scrape_session_id)

                if rate_data.get("status") == "success":
                    price = rate_data["price"]
                    is_sold_out = rate_data.get("is_sold_out", False)

                    stmt = select(CompetitorRate).where(
                        CompetitorRate.competitor_id == comp_id,
                        CompetitorRate.check_in_date == check_in_date_obj,
                    )
                    db_res = await session.execute(stmt)
                    existing_rate = db_res.scalar_one_or_none()

                    if existing_rate:
                        existing_rate.price = price
                        existing_rate.is_sold_out = is_sold_out
                        existing_rate.fetched_at = datetime.utcnow()
                        session.add(existing_rate)
                    else:
                        session.add(CompetitorRate(
                            competitor_id=comp_id,
                            check_in_date=check_in_date_obj,
                            price=price,
                            is_sold_out=is_sold_out,
                            fetched_at=datetime.utcnow(),
                        ))

                    # Per-day commit so frontend polling shows live progress
                    await session.commit()
                    success_count += 1
                    logger.info(
                        f"Ingested rate for {comp.name} on {check_in_date_obj.isoformat()}: "
                        f"{price} (sold_out={is_sold_out})"
                    )

                    # Push per-day result to Redis for live price toasts
                    try:
                        progress_key = f"scrape_progress:{comp_id}"
                        existing_raw = redis_client.get_value(progress_key)
                        progress_list = json.loads(existing_raw) if existing_raw else []
                        progress_list.append({
                            "date": check_in_date_obj.isoformat(),
                            "price": price,
                            "is_sold_out": is_sold_out,
                        })
                        redis_client.set_value(progress_key, json.dumps(progress_list), expire=600)
                    except Exception as pe:
                        logger.warning(f"Failed to write scrape progress to Redis: {pe}")

                    # Invalidate rate comparison + market analysis cache for this hotel
                    try:
                        redis_client.delete_pattern(f"rate_comparison:{comp.hotel_id}:*")
                        redis_client.delete_pattern(f"market_analysis:{comp.hotel_id}:*")
                    except Exception as cache_err:
                        logger.warning(f"Failed to clear competitor cache: {cache_err}")
                else:
                    has_errors = True
                    last_error_reason = rate_data.get("reason", "unknown")
                    logger.warning(
                        f"Failed to scrape {comp.name} on {check_in_date_obj.isoformat()}: {last_error_reason}"
                    )
                    # Rotate session ID so the next day starts with a fresh session
                    scrape_session_id = uuid.uuid4().hex[:12]

                # Inter-day pause so the warmed-up proxy IP looks human to Akamai.
                if offset < 6 and not was_stopped:
                    await asyncio.sleep(INTER_DAY_PAUSE_SECONDS)

            # Persist final status
            comp = await session.get(Competitor, comp_id)
            if comp:
                if success_count > 0:
                    comp.last_scrape_status = "success"
                    if was_stopped:
                        comp.last_scrape_error = f"Stopped by you — saved {success_count} day(s) fetched so far."
                    elif has_errors:
                        comp.last_scrape_error = (
                            f"Successfully scraped {success_count}/7 days. "
                            f"Some dates failed: {last_error_reason}"
                        )
                    else:
                        comp.last_scrape_error = None
                    comp.last_scraped_at = datetime.utcnow()
                elif was_stopped:
                    comp.last_scrape_status = "success"
                    comp.last_scrape_error = "Stopped by you before any rates were fetched."
                else:
                    comp.last_scrape_status = "failed"
                    comp.last_scrape_error = f"Scraping failed on all dates: {last_error_reason}"
                session.add(comp)

                # Bill only for the days we actually attempted
                session.add(ScraperUsage(
                    hotel_id=comp.hotel_id,
                    competitor_id=comp_id,
                    request_count=attempted,
                    status="success" if success_count > 0 else "failed",
                ))
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
                    session.add(ScraperUsage(
                        hotel_id=comp.hotel_id,
                        competitor_id=comp_id,
                        request_count=attempted,
                        status="failed",
                    ))
                    await session.commit()
        except Exception as db_err:
            logger.error(f"Failed to record crash status: {db_err}")
