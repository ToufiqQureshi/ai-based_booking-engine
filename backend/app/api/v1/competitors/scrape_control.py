"""
Scrape control endpoints: manually trigger, stop, and poll progress for a competitor scrape.
"""
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks

from app.api.deps import CurrentUser, DbSession
from app.core.feature_flags import require_feature
from app.core.tasks import safe_background
from app.core.redis_client import redis_client
from app.core.config import get_settings

from .scraper import _is_stale_running, MANUAL_SCRAPE_COOLDOWN_SECONDS
from .background import run_background_scrape
from .crud import check_rate_shopper_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])


@router.post("/{comp_id}/scrape", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def trigger_scrape(
    comp_id: str,
    current_user: CurrentUser,
    session: DbSession,
    background_tasks: BackgroundTasks,
):
    """Manually trigger a 7-day competitor rate scrape."""
    check_rate_shopper_feature(current_user)

    from app.models.competitor import Competitor
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    settings = get_settings()
    if not settings.SCRAPINGBEE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Rate sync is temporarily unavailable. Our team has been notified — please try again shortly.",
        )

    # Prevent concurrent scrapes for the same competitor to avoid racing writes
    # and stop double-clicks from multiplying paid ScrapingBee API calls.
    if comp.last_scrape_status == "running" and not _is_stale_running(comp):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A scrape is already running for this competitor. Please wait for it to finish.",
        )

    cooldown_key = f"scrape_cooldown:{comp_id}"
    try:
        if not await redis_client.set_nx_ex(cooldown_key, "1", MANUAL_SCRAPE_COOLDOWN_SECONDS):
            r = redis_client.get_instance()
            ttl = r.ttl(cooldown_key) if r else MANUAL_SCRAPE_COOLDOWN_SECONDS
            wait_minutes = max(1, ((ttl if ttl and ttl > 0 else MANUAL_SCRAPE_COOLDOWN_SECONDS) // 60) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait about {wait_minutes} more minute(s) before refreshing this competitor again.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Scrape cooldown check failed (failing open): {exc}")

    comp.last_scrape_status = "running"
    comp.last_scrape_error = None
    comp.scrape_started_at = datetime.utcnow()
    session.add(comp)
    await session.commit()

    # Pass status_pre_set=True so the double-execution guard inside
    # run_background_scrape doesn't fire — we already set status="running" above.
    safe_background(
        background_tasks,
        lambda: run_background_scrape(comp_id, status_pre_set=True),
        task_name="competitor_rate_scrape",
    )
    return {"message": "Scrape started in background"}


@router.post("/{comp_id}/stop", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def stop_scrape(comp_id: str, current_user: CurrentUser, session: DbSession):
    """
    Stop an in-progress scrape. Days already fetched stay saved — the background
    job commits each day as it goes; we just signal it to stop before burning
    more paid API calls on remaining days.
    """
    check_rate_shopper_feature(current_user)

    from app.models.competitor import Competitor
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    if comp.last_scrape_status != "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No scrape is currently running for this competitor.",
        )

    try:
        redis_client.set_value(f"scrape_cancel:{comp_id}", "1", expire=600)
    except Exception as exc:
        logger.warning(f"Failed to set scrape cancel flag for {comp_id}: {exc}")
        raise HTTPException(status_code=503, detail="Could not request stop right now. Please try again.")

    # Force-update status so frontend stops polling immediately. The background
    # task checks the cancel flag on its next iteration and exits without overwriting this.
    comp.last_scrape_status = "success"
    comp.last_scrape_error = "Stopped by you."
    session.add(comp)
    await session.commit()

    return {"message": "Stopping scrape — already-fetched rates are saved."}


@router.get("/{comp_id}/progress", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_scrape_progress(comp_id: str, current_user: CurrentUser, session: DbSession):
    """
    Returns live per-day scraping results for a running scrape.
    Frontend polls this every 2s to show a per-date price toast instantly.
    Returns [] when no in-progress data exists.
    """
    check_rate_shopper_feature(current_user)

    from app.models.competitor import Competitor
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    try:
        raw = redis_client.get_value(f"scrape_progress:{comp_id}")
        return json.loads(raw) if raw else []
    except Exception:
        return []
