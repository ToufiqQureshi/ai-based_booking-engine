"""
Analytics API tests — dashboard structure, auth boundary, edge cases.
"""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Auth boundary
# ---------------------------------------------------------------------------

async def test_dashboard_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/analytics/dashboard")
    assert res.status_code == 401



# ---------------------------------------------------------------------------
# Dashboard structure
# ---------------------------------------------------------------------------

async def test_dashboard_returns_expected_keys(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/analytics/dashboard")
    assert res.status_code == 200
    body = res.json()
    expected_keys = {"total_visitors", "revenue_total"}
    assert expected_keys.issubset(body.keys()), (
        f"Missing keys: {expected_keys - body.keys()}"
    )


async def test_dashboard_with_days_param(auth_client: AsyncClient):
    for days in [7, 30, 90]:
        res = await auth_client.get(f"/api/v1/analytics/dashboard?days={days}")
        assert res.status_code == 200, f"Failed for days={days}"


async def test_dashboard_empty_db_no_crash(auth_client: AsyncClient):
    """With no bookings/visitors, dashboard must not 500."""
    res = await auth_client.get("/api/v1/analytics/dashboard?days=7")
    assert res.status_code not in (500, 502, 503)


# ---------------------------------------------------------------------------
# Public tracking (no auth needed)
# ---------------------------------------------------------------------------

async def test_tracking_start_no_auth_needed(client: AsyncClient):
    """Analytics tracking is a public endpoint."""
    res = await client.post(
        "/api/v1/analytics/track/start?hotel_id=nonexistent-hotel-id",
        json={
            "user_agent": "Mozilla/5.0",
            "referrer": "google.com",
            "page_url": "https://test.com/book",
        },
    )
    # Hotel not found → 404 is acceptable; what's NOT acceptable is 401 or 500
    assert res.status_code != 401
    assert res.status_code != 500
