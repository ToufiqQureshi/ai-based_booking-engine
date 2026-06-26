"""
Core / Booking Endpoints Auth Guard Tests
Covers auth guards on the core booking lifecycle endpoints.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCoreBookingAuth:
    async def test_bookings_list_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/bookings")
        assert r.status_code == 401

    async def test_rooms_list_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/rooms")
        assert r.status_code == 401

    async def test_analytics_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/dashboard")
        assert r.status_code == 401
