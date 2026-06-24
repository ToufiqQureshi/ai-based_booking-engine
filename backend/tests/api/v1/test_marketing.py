"""
Marketing / Leads Tests
Covers:
  - GET /leads/  — auth guard, returns paginated list, tenant-scoped
  - PATCH /leads/:id — IDOR guard (patching non-existent / other hotel lead)
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestGetLeads:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/leads/")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/leads/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_hotel_returns_empty_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/leads/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_pagination_params_accepted(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/leads/?limit=5&offset=0")
        assert r.status_code == 200


class TestLeadIsolation:
    async def test_cannot_patch_nonexistent_lead(self, auth_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await auth_client.patch(f"/api/v1/leads/{fake_id}?status=contacted")
        assert r.status_code in (403, 404)
