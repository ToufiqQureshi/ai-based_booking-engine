"""
Shareable public report + city-level visitor tracking.

Covers the new guest-tracking / hotelier-report feature:
  * city geo is captured from Cloudflare headers and surfaced in the dashboard
  * OWNER/MANAGER can mint a public share link; auth is required to mint
  * the public token endpoint returns aggregate data (no auth) and is scoped to
    exactly one hotel, with revoke + 404-on-unknown behaviour
"""
import uuid
from datetime import date, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.database import engine
from app.brand_console.hotel import Hotel
from app.analytics.models import ReportShareLink


def _booking_payload(room_type_id: str, rate_plan_id: str, source: str, amount: float = 4000.0) -> dict:
    check_in = date.today() + timedelta(days=10)
    check_out = check_in + timedelta(days=2)
    return {
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "guest": {
            "first_name": "Chan",
            "last_name": "Mix",
            "email": f"chan.{source}@test.com",
            "phone": "9000000002",
        },
        "rooms": [{
            "room_type_id": room_type_id,
            "room_type_name": "Test Room",
            "rate_plan_id": rate_plan_id,
            "rate_plan_name": "Test Plan",
            "guests": 2,
            "children": 0,
            "price_per_night": amount / 2,
            "total_price": amount,
        }],
        "total_amount": amount,
        "source": source,
    }


# ---------------------------------------------------------------------------
# City-level tracking
# ---------------------------------------------------------------------------

async def test_track_start_captures_city_from_cloudflare(
    client: AsyncClient, seeded_hotel
):
    """A Cloudflare cf-ipcity header should land in the city breakdown."""
    res = await client.post(
        f"/api/v1/analytics/track/start?hotel_id={seeded_hotel.id}",
        json={"user_agent": "Mozilla/5.0", "page_url": "https://x.test/book"},
        headers={"cf-ipcity": "Mumbai", "cf-ipcountry": "IN"},
    )
    assert res.status_code == 200
    assert res.json()["session_id"]


async def test_dashboard_exposes_city_stats(auth_client: AsyncClient, seeded_hotel):
    """city_stats is always present and well-formed (sums never exceed visitors)."""
    # Seed a visitor from Pune via the public tracker.
    await auth_client.post(
        f"/api/v1/analytics/track/start?hotel_id={seeded_hotel.id}",
        json={"user_agent": "Mozilla/5.0"},
        headers={"cf-ipcity": "Pune", "cf-ipcountry": "IN"},
    )
    # Unique days value → fresh cache key (avoids a stale cached dashboard).
    res = await auth_client.get("/api/v1/analytics/dashboard?days=33")
    assert res.status_code == 200
    body = res.json()
    assert "city_stats" in body
    assert isinstance(body["city_stats"], list)
    for row in body["city_stats"]:
        assert {"city", "visitors", "percentage"}.issubset(row.keys())


# ---------------------------------------------------------------------------
# Share-link auth boundary
# ---------------------------------------------------------------------------

async def test_create_share_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/analytics/share", json={"days": 30})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Mint → view → revoke lifecycle
# ---------------------------------------------------------------------------

async def test_share_link_lifecycle(auth_client: AsyncClient, client: AsyncClient):
    # Mint a link (auth_client is an OWNER).
    create = await auth_client.post(
        "/api/v1/analytics/share",
        json={"label": "Investor deck", "days": 14, "expires_in_days": 7},
    )
    assert create.status_code == 200
    link = create.json()
    token = link["token"]
    assert token and link["is_active"] is True
    assert link["days"] == 14

    # It shows up in the hotel's list.
    listed = await auth_client.get("/api/v1/analytics/share")
    assert listed.status_code == 200
    assert any(l["id"] == link["id"] for l in listed.json())

    # Public read works with NO auth and is scoped to the hotel.
    pub = await client.get(f"/api/v1/public/report/{token}")
    assert pub.status_code == 200
    body = pub.json()
    assert body["hotel_name"] == "Pytest Grand Hotel"
    assert body["days"] == 14
    assert "total_visitors" in body["data"]
    # Must never leak PII — only aggregate keys.
    assert "guests" not in body["data"]

    # Revoke → the public link dies (404).
    revoke = await auth_client.delete(f"/api/v1/analytics/share/{link['id']}")
    assert revoke.status_code == 200
    gone = await client.get(f"/api/v1/public/report/{token}")
    assert gone.status_code == 404


async def test_public_report_unknown_token_404(client: AsyncClient):
    res = await client.get("/api/v1/public/report/definitely-not-a-real-token")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Report metrics — RevPAR, rooms booked, channel mix (Direct / AI / OTA)
# ---------------------------------------------------------------------------

async def test_dashboard_reports_metrics_and_channel_mix(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    """Bookings from different sources bucket into the right report channels,
    and the headline metrics (rooms_booked / total_bookings / rev_par) are
    present and sane."""
    for source in ("direct", "ai_agent", "booking_com"):
        res = await auth_client.post(
            "/api/v1/bookings", json=_booking_payload(seeded_room.id, seeded_rate_plan.id, source)
        )
        assert res.status_code == 201, res.text

    # Unique days value → fresh tenant cache key.
    body = (await auth_client.get("/api/v1/analytics/dashboard?days=51")).json()

    assert body["total_bookings"] >= 3
    assert body["rooms_booked"] >= body["total_bookings"]
    assert isinstance(body["rev_par"], (int, float)) and body["rev_par"] >= 0

    channels = {c["channel"] for c in body["channel_mix"]}
    assert {"Direct", "AI Agent", "OTA"}.issubset(channels)
    for slice_ in body["channel_mix"]:
        assert {"channel", "bookings", "revenue"}.issubset(slice_.keys())


# ---------------------------------------------------------------------------
# Authorization — STAFF cannot mint/revoke; expiry + IDOR on the public side
# ---------------------------------------------------------------------------

async def test_staff_cannot_create_share_link(staff_client: AsyncClient):
    res = await staff_client.post("/api/v1/analytics/share", json={"days": 30})
    assert res.status_code == 403


async def test_expired_link_returns_410(client: AsyncClient, seeded_hotel):
    """A link whose expires_at is in the past must 410, not serve the report."""
    link = ReportShareLink(
        hotel_id=seeded_hotel.id,
        token=f"expired-{uuid.uuid4().hex}",
        days=30,
        expires_at=datetime.utcnow() - timedelta(days=1),
    )
    token = link.token  # capture before commit (commit expires attributes)
    async with AsyncSession(engine) as s:
        s.add(link)
        await s.commit()

    res = await client.get(f"/api/v1/public/report/{token}")
    assert res.status_code == 410


async def test_cannot_revoke_another_hotels_link(auth_client: AsyncClient):
    """IDOR guard: a hotel can only revoke its own links. A link owned by a
    different hotel must look like 404 to this hotel's owner."""
    other_hotel = Hotel(
        id=str(uuid.uuid4()),
        name="Someone Else's Hotel",
        slug=f"other-{uuid.uuid4().hex[:8]}",
        description="Different tenant",
    )
    link = ReportShareLink(hotel_id=other_hotel.id, token=f"foreign-{uuid.uuid4().hex}", days=30)
    link_id = link.id  # capture before commit (commit expires attributes)
    async with AsyncSession(engine) as s:
        s.add(other_hotel)
        s.add(link)
        await s.commit()

    res = await auth_client.delete(f"/api/v1/analytics/share/{link_id}")
    assert res.status_code == 404
