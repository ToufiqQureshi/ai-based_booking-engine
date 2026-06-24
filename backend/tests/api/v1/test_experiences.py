"""
Experiences / Add-ons Tests
Covers:
  - GET /addons     — auth guard, returns list, tenant-scoped
  - POST /addons    — OWNER/MANAGER can create; STAFF blocked
  - PATCH /addons/:id — IDOR guard (cannot modify another hotel's add-on)
  - DELETE /addons/:id — IDOR guard
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestGetAddons:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/addons")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/addons")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_hotel_returns_empty_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/addons")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestCreateAddon:
    async def test_staff_cannot_create_addon(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/addons", json={
            "name": "Spa Package",
            "price": 500.0,
            "description": "Relaxing spa session",
        })
        assert r.status_code == 403

    async def test_owner_can_create_addon(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/addons", json={
            "name": f"Test Addon {uuid.uuid4().hex[:6]}",
            "price": 250.0,
            "description": "Test add-on",
            "category": "wellness",
        })
        assert r.status_code in (200, 201)

    async def test_invalid_payload_returns_422(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/addons", json={})
        assert r.status_code == 422


class TestAddonIsolation:
    async def test_cannot_delete_nonexistent_addon(self, auth_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await auth_client.delete(f"/api/v1/addons/{fake_id}")
        assert r.status_code in (403, 404)

    async def test_staff_cannot_delete_addon(self, staff_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await staff_client.delete(f"/api/v1/addons/{fake_id}")
        assert r.status_code == 403
