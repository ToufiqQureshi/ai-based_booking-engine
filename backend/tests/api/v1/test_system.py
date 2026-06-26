"""
System / Admin Endpoint Tests
Covers auth guards on the internal admin routes.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAdminAuth:
    async def test_admin_stats_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/admin/stats")
        assert r.status_code == 401

    async def test_admin_hotels_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/admin/hotels")
        assert r.status_code == 401

    async def test_owner_blocked_from_admin_stats(self, auth_client: AsyncClient):
        """Regular OWNER must not access internal admin stats."""
        r = await auth_client.get("/api/v1/admin/stats")
        assert r.status_code in (401, 403)
