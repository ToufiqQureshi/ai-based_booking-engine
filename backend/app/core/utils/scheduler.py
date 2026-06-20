"""
Background scheduler (APScheduler) with a Redis lock.

Across multiple gunicorn workers / Railway replicas, every instance would
otherwise run every periodic job on each tick. We acquire a short-lived Redis
lock (`set_nx_ex`) per job per tick so exactly one instance does the work.
If Redis is unavailable we fail-open and run (single-instance assumption).

Jobs:
  - social_proof          every 15 min     — refresh cached social-proof stats
  - subscription_expiry   every 24 h       — notify hotels of expiring plans
  - abandoned_recovery    hourly           — nudge guests who left a PENDING,
                                             unpaid booking (per-hotel opt-in)
  - rate_shopper_auto_scrape  hourly (:10) — scrape competitor rates for hotels
                                             whose configured local hour is now

Disable entirely with ENABLE_SCHEDULER=false.
"""
import logging
from typing import Awaitable, Callable, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.cache.redis_client import redis_client

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


async def _run_locked(job_name: str, lock_ttl: int, coro_factory: Callable[[], Awaitable]) -> None:
    """Run the job only if we win the per-tick Redis lock."""
    lock_key = f"sched_lock:{job_name}"
    try:
        acquired = await redis_client.set_nx_ex(lock_key, "1", expire=lock_ttl)
    except Exception:
        acquired = True  # Redis down -> assume single instance and run
    if not acquired:
        logger.debug("Scheduler: another instance holds the lock for '%s'", job_name)
        return
    try:
        await coro_factory()
        logger.info("Scheduler: job '%s' completed", job_name)
    except Exception:
        logger.exception("Scheduler: job '%s' failed", job_name)


async def _job_social_proof() -> None:
    from app.core.db.database import async_session
    from app.google_reviews.social_proof_refresh import refresh_all_social_proof_stats
    async with async_session() as session:
        await refresh_all_social_proof_stats(session)


async def _job_subscription_expiry() -> None:
    from app.core.utils.tasks import check_subscription_expiry
    await check_subscription_expiry()


async def _job_abandoned_recovery() -> None:
    # hotel_id=None sweeps every hotel; per-hotel settings["recovery_enabled"]
    # gates who actually gets nudged, so disabled hotels are skipped inside.
    from app.revenue.recovery import run_abandoned_recovery
    result = await run_abandoned_recovery()
    logger.info(
        "Abandoned-recovery sweep: scanned=%s nudged=%s skipped_disabled=%s errors=%s",
        result.get("scanned"), result.get("nudged"),
        result.get("skipped_disabled"), result.get("errors"),
    )


async def _tick_social_proof() -> None:
    # lock TTL < interval so a crashed run releases before the next tick
    await _run_locked("social_proof", 600, _job_social_proof)


async def _tick_subscription_expiry() -> None:
    await _run_locked("subscription_expiry", 3600, _job_subscription_expiry)


async def _job_orphan_media() -> None:
    from app.core.storage import sweep_orphaned_media
    result = await sweep_orphaned_media(grace_hours=24)
    logger.info(
        "Orphan-media sweep: scanned=%s referenced=%s orphaned=%s deleted=%s",
        result.get("scanned"), result.get("referenced"),
        result.get("orphaned"), result.get("deleted"),
    )


async def _tick_abandoned_recovery() -> None:
    # lock TTL (50 min) < hourly interval so a crashed run releases in time.
    await _run_locked("abandoned_recovery", 3000, _job_abandoned_recovery)


async def _tick_orphan_media() -> None:
    # lock TTL (12h) < 24h interval so a crashed run releases before next tick.
    await _run_locked("orphan_media", 43200, _job_orphan_media)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(_tick_social_proof, "interval", minutes=15,
                  id="social_proof", max_instances=1, coalesce=True)
    sched.add_job(_tick_subscription_expiry, "interval", hours=24,
                  id="subscription_expiry", max_instances=1, coalesce=True)
    sched.add_job(_tick_abandoned_recovery, "interval", hours=1,
                  id="abandoned_recovery", max_instances=1, coalesce=True)
    sched.add_job(_tick_orphan_media, "interval", hours=24,
                  id="orphan_media", max_instances=1, coalesce=True)
    sched.start()
    _scheduler = sched
    logger.info(
        "Background scheduler started "
        "(social_proof=15m, subscription_expiry=24h, abandoned_recovery=1h, orphan_media=24h)"
    )


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
