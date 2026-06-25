"""
Superadmin Endpoint Tests
Covers:
  - GET /superadmin/hotels — requires SUPER_ADMIN, OWNER blocked
  - Non-superadmin roles must be rejected with 403
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestSuperadminAccess:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 401

    async def test_owner_blocked(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 403

    async def test_staff_blocked(self, staff_client: AsyncClient):
        r = await staff_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 403

    async def test_super_admin_can_list_hotels(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
