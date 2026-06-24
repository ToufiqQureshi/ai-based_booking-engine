"""
Brand Console / Hotel Settings Tests
Covers:
  - GET /hotels/me — auth guard, returns hotel settings shape
  - PATCH /hotels/me — STAFF blocked from modifying hotel settings
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestHotelSettings:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/hotels/me")
        assert r.status_code == 401

    async def test_returns_hotel_shape(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/hotels/me")
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "name" in data
        assert "slug" in data

    async def test_patch_requires_auth(self, client: AsyncClient):
        r = await client.patch("/api/v1/hotels/me", json={"description": "No auth"})
        assert r.status_code == 401

    async def test_owner_can_update_hotel(self, auth_client: AsyncClient):
        """Owner PATCH /hotels/me returns 200 with the mutated field reflected."""
        r = await auth_client.patch("/api/v1/hotels/me", json={"description": "Updated by test"})
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "name" in data
        assert "slug" in data
        assert data.get("description") == "Updated by test"

    async def test_staff_cannot_update_settings(self, staff_client: AsyncClient):
        r = await staff_client.patch("/api/v1/hotels/me", json={"name": "Hacked"})
        assert r.status_code == 403
