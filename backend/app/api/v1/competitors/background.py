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

# Max retries per day when ScrapingBee reports a block/captcha.
# 3 attempts = 1 original + 2 retries. Retry delay starts at 4s then 8s.
MAX_BLOCK_RETRIES = 2

# Gap between sequential day scrapes — prevents bursting 7 requests at once
# which can trip rate limits on ScrapingBee or the target site.
INTER_DAY_PAUSE_SECONDS = 2.5


_BLOCK_REASONS = {
    "scrapingbee_target_blocked",
    "shield_blocked",
    "captcha_page",
    "scrapingbee_rate_limited",
}

async def _scrape_mmt_with_retry(url: str, hotel_id: str, session_id: str) -> dict:
    """Wrap scrape_mmt_hotel_rate with block-specific retry + exponential backoff."""
    delay = 4.0
    result = {}
    for attempt in range(MAX_BLOCK_RETRIES + 1):
        result = await scrape_mmt_hotel_rate(url, hotel_id, session_id=session_id)
        if result.get("reason") not in _BLOCK_REASONS:
            return result
        if attempt < MAX_BLOCK_RETRIES:
            logger.info(f"Blocked ({result.get('reason')}) on attempt {attempt + 1}, retrying in {delay:.0f}s…")
            await asyncio.sleep(delay)
            delay *= 2
    return result


async def run_background_scrape(comp_id: str, status_pre_set: bool = False) -> None:
    """
    Scrape the next 7 days of rates for one competitor using ScrapingBee + Scrapling.
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

            # session_id is kept for rotation tracking (used on block detection).
            # stealth_proxy ignores it at the ScrapingBee layer — each call gets
            # a fresh fingerprint internally — but we rotate it locally to get
            # a different session bucket on retries.
            scrape_session_id = uuid.uuid4().hex[:12]
            current_geo = "India"

            success_count = 0
            has_errors = False
            failed_dates: list[str] = []
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

                # Session is blocked or stale — rotate IP and retry this day once.
                if rate_data.get("reason") in _BLOCK_REASONS or rate_data.get("reason") in (
                    "scrapingbee_auth_failed",
                    "empty_html_content",
                ):
                    logger.warning(
                        f"Rotating session due to {rate_data.get('reason')} (old={scrape_session_id}) "
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
                    failed_dates.append(check_in_date_obj.isoformat())
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
                        failed_str = ", ".join(failed_dates) if failed_dates else "unknown dates"
                        comp.last_scrape_error = (
                            f"Fetched {success_count}/7 days. "
                            f"Failed on: {failed_str} ({last_error_reason})"
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
