"""
Analytics Tests — covers all analytics endpoints:
  - Public tracking (session start / ping / event)
  - Dashboard aggregations (requires auth)
  - Sub-dashboard reports (overview / revenue / traffic / AI / cancellations / KPIs)
  - Live endpoints (active visitors / feed)
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics import AnalyticsSession, AnalyticsEvent
from app.models.hotel import Hotel

pytestmark = pytest.mark.asyncio


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
async def seeded_analytics_session(seeded_hotel: Hotel) -> AnalyticsSession:
    """Create a real analytics session in DB for tracking tests."""
    from tests.conftest import engine
    obj = AnalyticsSession(
        id=str(uuid.uuid4()),
        hotel_id=seeded_hotel.id,
        user_agent="Mozilla/5.0 (test)",
        device_type="desktop",
        browser="Chrome 120",
        country="India",
    )
    async with AsyncSession(engine) as session:
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
    return obj


# ─── Public Tracking ─────────────────────────────────────────────────────────

class TestTrackingEndpoints:
    """These endpoints are public (no auth) — called by the booking widget."""

    async def test_track_start_creates_session(self, client: AsyncClient, seeded_hotel: Hotel):
        r = await client.post(
            f"/api/v1/analytics/track/start?hotel_id={seeded_hotel.id}",
            json={"user_agent": "TestBrowser/1.0", "referrer": "https://google.com"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "session_id" in body
        assert body["session_id"]  # non-empty

    async def test_track_start_with_page_url(self, client: AsyncClient, seeded_hotel: Hotel):
        r = await client.post(
            f"/api/v1/analytics/track/start?hotel_id={seeded_hotel.id}",
            json={"user_agent": "TestBrowser/1.0", "page_url": "/booking"},
        )
        assert r.status_code == 200

    async def test_track_ping_updates_session(self, client: AsyncClient, seeded_analytics_session: AnalyticsSession):
        r = await client.post(
            "/api/v1/analytics/track/ping",
            json={"session_id": seeded_analytics_session.id, "time_spent_seconds": 30},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    async def test_track_ping_unknown_session_ignored(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/analytics/track/ping",
            json={"session_id": str(uuid.uuid4()), "time_spent_seconds": 10},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "ignored"

    async def test_track_event_accepted(self, client: AsyncClient, seeded_analytics_session: AnalyticsSession):
        r = await client.post(
            "/api/v1/analytics/track/event",
            json={
                "session_id": seeded_analytics_session.id,
                "event_type": "room_view",
                "page_url": "/rooms/deluxe",
            },
        )
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    async def test_track_event_booking_complete(self, client: AsyncClient, seeded_analytics_session: AnalyticsSession):
        r = await client.post(
            "/api/v1/analytics/track/event",
            json={
                "session_id": seeded_analytics_session.id,
                "event_type": "booking_complete",
                "page_url": "/confirmation",
            },
        )
        assert r.status_code == 200


# ─── Dashboard ────────────────────────────────────────────────────────────────

class TestDashboardEndpoint:
    async def test_dashboard_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/dashboard")
        assert r.status_code == 401

    async def test_dashboard_returns_expected_structure(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard?days=7")
        assert r.status_code == 200
        body = r.json()
        required_keys = [
            "total_visitors", "conversion_rate", "revenue_total",
            "chart_data", "funnel_data", "device_stats",
            "occupancy_rate", "avg_daily_rate",
        ]
        for key in required_keys:
            assert key in body, f"Missing key: {key}"

    async def test_dashboard_days_param_accepted(self, auth_client: AsyncClient):
        for days in [1, 7, 30, 90]:
            r = await auth_client.get(f"/api/v1/analytics/dashboard?days={days}")
            assert r.status_code == 200


# ─── Sub-dashboard Reports ────────────────────────────────────────────────────

class TestSubDashboardReports:
    async def test_overview_endpoint(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard/overview")
        assert r.status_code == 200
        body = r.json()
        assert "total_visitors" in body
        assert "funnel_data" in body

    async def test_revenue_endpoint(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard/revenue")
        assert r.status_code == 200
        body = r.json()
        assert "revenue_total" in body
        assert "avg_daily_rate" in body
        assert "occupancy_forecast" in body

    async def test_traffic_endpoint(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard/traffic")
        assert r.status_code == 200
        body = r.json()
        assert "geo_stats" in body
        assert "traffic_heatmap" in body
        # Heatmap must have 7 days × 24 hours = 168 entries
        assert len(body["traffic_heatmap"]) == 168

    async def test_ai_endpoint(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard/ai")
        assert r.status_code == 200
        body = r.json()
        assert "ai_resolution_rate" in body
        assert "total_leads" in body
        assert "ai_assisted_bookings" in body

    async def test_cancellations_endpoint(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard/cancellations")
        assert r.status_code == 200
        body = r.json()
        assert "cancellations_count" in body
        assert "lost_revenue" in body

    async def test_kpis_endpoint(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/dashboard/kpis")
        assert r.status_code == 200
        body = r.json()
        assert "total_visitors" in body
        assert "revenue_total" in body
        assert "occupancy_rate" in body

    async def test_all_sub_endpoints_require_auth(self, client: AsyncClient):
        sub_paths = ["/overview", "/revenue", "/traffic", "/ai", "/cancellations", "/kpis"]
        for path in sub_paths:
            r = await client.get(f"/api/v1/analytics/dashboard{path}")
            assert r.status_code == 401, f"Expected 401 for {path}, got {r.status_code}"


# ─── Live Endpoints ───────────────────────────────────────────────────────────

class TestLiveEndpoints:
    async def test_active_visitors_count(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/live/active")
        assert r.status_code == 200
        body = r.json()
        assert "active_visitors" in body
        assert isinstance(body["active_visitors"], int)
        assert body["active_visitors"] >= 0

    async def test_live_feed_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/analytics/live/feed?limit=5")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        assert len(body) <= 5

    async def test_live_active_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/live/active")
        assert r.status_code == 401

    async def test_live_feed_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/live/feed")
        assert r.status_code == 401
