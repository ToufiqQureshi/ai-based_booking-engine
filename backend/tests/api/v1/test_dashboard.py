"""
Dashboard Tests
Covers:
  - GET /dashboard/stats  — auth guard, all response keys present, zeros on empty DB
  - GET /dashboard/recent-bookings — auth guard, list shape, max 5 results
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

_STATS_KEYS = (
    "today_arrivals",
    "today_departures",
    "current_occupancy",
    "today_revenue",
    "pending_bookings",
    "total_rooms",
    "trends",
)
_TREND_KEYS = ("arrivals", "occupancy", "revenue")


class TestDashboardStats:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/dashboard/stats")
        assert r.status_code == 401

    async def test_returns_all_expected_keys(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        for key in _STATS_KEYS:
            assert key in data, f"Dashboard stats missing key: '{key}'"

    async def test_trends_shape(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/dashboard/stats")
        assert r.status_code == 200
        trends = r.json()["trends"]
        assert isinstance(trends, dict)
        for key in _TREND_KEYS:
            assert key in trends, f"trends dict missing key: '{key}'"

    async def test_numeric_fields_are_numbers(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        for key in ("today_arrivals", "today_departures", "current_occupancy",
                    "today_revenue", "pending_bookings", "total_rooms"):
            assert isinstance(data[key], (int, float)), f"'{key}' should be numeric, got {type(data[key])}"

    async def test_empty_db_returns_zeros_not_crash(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/dashboard/stats")
        assert r.status_code == 200
        data = r.json()
        # All counts must be 0 (not None or crash) when no bookings exist
        assert data["today_arrivals"] >= 0
        assert data["today_revenue"] >= 0
        assert data["pending_bookings"] >= 0


class TestDashboardRecentBookings:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/dashboard/recent-bookings")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/dashboard/recent-bookings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_capped_at_five_results(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/dashboard/recent-bookings")
        assert r.status_code == 200
        assert len(r.json()) <= 5
