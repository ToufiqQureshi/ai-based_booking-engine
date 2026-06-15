"""
Tests for the abandoned-booking recovery scheduler wiring.

The recovery sweep logic itself is covered in tests/api/v1/test_revenue_recovery.py.
These tests pin down the *scheduling* side that was previously missing entirely:
without a registered job, run_abandoned_recovery() only ever ran when a hotelier
clicked "send now", so every abandoned booking aged past the 72h window unnudged.
"""
import pytest

import app.core.scheduler as scheduler
import app.revenue.recovery as recovery

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def _reset_scheduler_singleton():
    """Never leak a running scheduler between tests."""
    scheduler.shutdown_scheduler()
    yield
    scheduler.shutdown_scheduler()


async def test_recovery_job_sweeps_all_hotels(monkeypatch):
    """The scheduled job must sweep every hotel (hotel_id=None), letting each
    hotel's recovery_enabled flag gate who is nudged."""
    calls = {}

    async def fake_run(hotel_id=None, *, force=False):
        calls["hotel_id"] = hotel_id
        calls["force"] = force
        return {"scanned": 0, "nudged": 0, "skipped_disabled": 0, "errors": 0}

    monkeypatch.setattr(recovery, "run_abandoned_recovery", fake_run)

    await scheduler._job_abandoned_recovery()

    assert calls["hotel_id"] is None        # sweep all hotels
    assert calls["force"] is False          # respect per-hotel opt-in


async def test_recovery_tick_runs_job_when_lock_acquired(monkeypatch):
    """When the per-tick Redis lock is won, the tick must execute the job."""
    ran = {"job": False}

    async def fake_set_nx_ex(key, value, expire=None):
        return True  # we hold the lock

    async def fake_job():
        ran["job"] = True

    monkeypatch.setattr(scheduler.redis_client, "set_nx_ex", fake_set_nx_ex)
    monkeypatch.setattr(scheduler, "_job_abandoned_recovery", fake_job)

    await scheduler._tick_abandoned_recovery()

    assert ran["job"] is True


async def test_recovery_tick_skips_job_when_lock_held(monkeypatch):
    """Another instance holding the lock means this tick does nothing."""
    ran = {"job": False}

    async def fake_set_nx_ex(key, value, expire=None):
        return False  # someone else holds the lock

    async def fake_job():
        ran["job"] = True

    monkeypatch.setattr(scheduler.redis_client, "set_nx_ex", fake_set_nx_ex)
    monkeypatch.setattr(scheduler, "_job_abandoned_recovery", fake_job)

    await scheduler._tick_abandoned_recovery()

    assert ran["job"] is False


async def test_start_scheduler_registers_recovery_job():
    """start_scheduler must register the recovery job so it actually runs."""
    scheduler.start_scheduler()
    try:
        job_ids = {j.id for j in scheduler._scheduler.get_jobs()}
        assert "abandoned_recovery" in job_ids
    finally:
        scheduler.shutdown_scheduler()
