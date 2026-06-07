"""
Background scheduler (APScheduler) with a Redis lock.

Across multiple gunicorn workers / Railway replicas, every instance would
otherwise run every periodic job on each tick. We acquire a short-lived Redis
lock (`set_nx_ex`) per job per tick so exactly one instance does the work.
If Redis is unavailable we fail-open and run (single-instance assumption).

Jobs:
  - social_proof          every 15 min     — refresh cached social-proof stats
  - subscription_expiry   every 24 h       — notify hotels of expiring plans
  - rate_shopper_auto_scrape  hourly (:10) — scrape competitor rates for hotels
                                             whose configured local hour is now

Disable entirely with ENABLE_SCHEDULER=false.
"""
import logging
from typing import Awaitable, Callable, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.redis_client import redis_client

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
    from app.core.database import async_session
    from app.core.social_proof_refresh import refresh_all_social_proof_stats
    async with async_session() as session:
        await refresh_all_social_proof_stats(session)


async def _job_subscription_expiry() -> None:
    from app.core.tasks import check_subscription_expiry
    await check_subscription_expiry()


async def _job_rate_shopper_auto_scrape() -> None:
    from app.core.database import async_session
    from app.api.v1.competitors import run_due_auto_scrapes
    async with async_session() as session:
        await run_due_auto_scrapes(session)


async def _tick_social_proof() -> None:
    # lock TTL < interval so a crashed run releases before the next tick
    await _run_locked("social_proof", 600, _job_social_proof)


async def _tick_subscription_expiry() -> None:
    await _run_locked("subscription_expiry", 3600, _job_subscription_expiry)


async def _tick_rate_shopper_auto_scrape() -> None:
    # lock TTL < 1h interval so a crashed run releases before the next tick
    await _run_locked("rate_shopper_auto_scrape", 1800, _job_rate_shopper_auto_scrape)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(_tick_social_proof, "interval", minutes=15,
                  id="social_proof", max_instances=1, coalesce=True)
    sched.add_job(_tick_subscription_expiry, "interval", hours=24,
                  id="subscription_expiry", max_instances=1, coalesce=True)
    sched.add_job(_tick_rate_shopper_auto_scrape, "cron", minute=10,
                  id="rate_shopper_auto_scrape", max_instances=1, coalesce=True)
    sched.start()
    _scheduler = sched
    logger.info(
        "Background scheduler started (social_proof=15m, subscription_expiry=24h, "
        "rate_shopper_auto_scrape=hourly:10)"
    )


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
