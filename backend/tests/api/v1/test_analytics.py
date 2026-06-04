"""
Analytics API tests — dashboard structure, auth boundary, edge cases.
"""
import pytest
from datetime import date, timedelta
from httpx import AsyncClient


def _ai_booking_payload(room_type_id: str, rate_plan_id: str) -> dict:
    check_in = date.today() + timedelta(days=12)
    check_out = check_in + timedelta(days=2)
    return {
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "guest": {
            "first_name": "Aisha",
            "last_name": "Khan",
            "email": "aisha.ai@test.com",
            "phone": "9000000001",
        },
        "rooms": [
            {
                "room_type_id": room_type_id,
                "room_type_name": "Test Room",
                "rate_plan_id": rate_plan_id,
                "rate_plan_name": "Test Plan",
                "guests": 2,
                "children": 0,
                "price_per_night": 3000.0,
                "total_price": 6000.0,
            }
        ],
        "total_amount": 6000.0,
        "source": "ai_agent",
    }


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
# AI attribution + occupancy sanity (regression guard for the math/source fix)
# ---------------------------------------------------------------------------

async def test_dashboard_counts_ai_bookings(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    """A booking with source=ai_agent must show up in AI metrics and revenue.
    Uses a unique `days` value so the tenant cache key is fresh (no stale hit)."""
    payload = _ai_booking_payload(seeded_room.id, seeded_rate_plan.id)
    create_res = await auth_client.post("/api/v1/bookings", json=payload)
    assert create_res.status_code == 201

    res = await auth_client.get("/api/v1/analytics/dashboard?days=45")
    assert res.status_code == 200
    body = res.json()
    assert body["ai_assisted_bookings"] >= 1
    assert body["ai_revenue"] > 0


async def test_dashboard_occupancy_never_exceeds_100(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    """Occupancy rate and forecast must be clamped to a valid 0–100% range."""
    payload = _ai_booking_payload(seeded_room.id, seeded_rate_plan.id)
    await auth_client.post("/api/v1/bookings", json=payload)

    res = await auth_client.get("/api/v1/analytics/dashboard?days=60")
    assert res.status_code == 200
    body = res.json()
    assert 0 <= body["occupancy_rate"] <= 100
    for point in body.get("occupancy_forecast", []):
        assert 0 <= point["occupancy"] <= 100


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
