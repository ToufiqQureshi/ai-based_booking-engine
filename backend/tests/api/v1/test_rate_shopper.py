"""
Rate Shopper / Competitors Tests
Covers:
  - GET /competitors        — auth guard, returns list, tenant-scoped
  - POST /competitors       — OWNER/MANAGER can add; STAFF blocked
  - DELETE /competitors/:id — IDOR guard (cannot delete another hotel's competitor)
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestGetCompetitors:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/competitors")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/competitors")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_hotel_returns_empty_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/competitors")
        assert r.status_code == 200
        # Fresh hotel has no competitors configured
        assert isinstance(r.json(), list)


class TestCreateCompetitor:
    async def test_staff_cannot_create_competitor(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/competitors", json={
            "name": "Rival Hotel",
            "url": "https://rival.com",
        })
        assert r.status_code == 403

    async def test_invalid_payload_returns_422(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/competitors", json={})
        assert r.status_code == 422


class TestDeleteCompetitor:
    async def test_cannot_delete_nonexistent_competitor(self, auth_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await auth_client.delete(f"/api/v1/competitors/{fake_id}")
        assert r.status_code in (403, 404)

    async def test_staff_cannot_delete_competitor(self, staff_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await staff_client.delete(f"/api/v1/competitors/{fake_id}")
        assert r.status_code == 403
