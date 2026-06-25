"""
Experiences / Add-ons Tests
Covers:
  - GET /addons     — auth guard, returns list, item shape, tenant-scoped
  - POST /addons    — OWNER/MANAGER can create; STAFF blocked; tampered hotel_id ignored
  - DELETE /addons/:id — IDOR guard
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.experiences.addon import AddOn

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
        """Fresh hotel with no addons returns [] not 500."""
        r = await auth_client.get("/api/v1/addons")
        assert r.status_code == 200
        assert r.json() == []

    async def test_tenant_isolation_and_shape(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Own add-on appears with correct fields; another hotel's add-on is excluded."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_addon_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Addon Isolation Hotel",
            slug=f"other-addon-iso-{uuid.uuid4().hex[:6]}",
        )
        other_addon = AddOn(
            id=other_addon_id,
            hotel_id=other_hotel_id,
            name="Foreign Addon",
            price=50.0,
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_addon)
            await session.commit()

        # Create one addon for the authenticated hotel
        create_r = await auth_client.post("/api/v1/addons", json={
            "name": f"Own Addon {uuid.uuid4().hex[:6]}",
            "price": 100.0,
        })
        assert create_r.status_code in (200, 201)
        own_addon_id = create_r.json()["id"]

        r = await auth_client.get("/api/v1/addons")
        assert r.status_code == 200
        items = r.json()
        addon_ids = [a["id"] for a in items]
        assert own_addon_id in addon_ids, "Own hotel's addon must appear"
        assert other_addon_id not in addon_ids, "Other hotel's addon must not appear"
        # Verify item shape
        own_item = next(a for a in items if a["id"] == own_addon_id)
        assert "id" in own_item
        assert "name" in own_item
        assert "price" in own_item
        assert "hotel_id" in own_item


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

    async def test_tampered_hotel_id_ignored(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Client cannot forge a hotel_id — backend always uses the authenticated hotel."""
        other_hotel_id = str(uuid.uuid4())
        r = await auth_client.post("/api/v1/addons", json={
            "name": f"Tamper Addon {uuid.uuid4().hex[:6]}",
            "price": 100.0,
            "hotel_id": other_hotel_id,  # attempted forge
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["hotel_id"] == seeded_hotel.id, (
            "Backend must use authenticated hotel_id, not the client-supplied one"
        )


class TestAddonIsolation:
    async def test_idor_cannot_delete_other_hotel_addon(
        self, auth_client: AsyncClient
    ):
        """auth_client (hotel A) cannot delete an addon belonging to hotel B."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_addon_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Addon Hotel",
            slug=f"other-addon-{uuid.uuid4().hex[:6]}",
        )
        other_addon = AddOn(
            id=other_addon_id,
            hotel_id=other_hotel_id,
            name="Other Hotel Addon",
            price=99.0,
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_addon)
            await session.commit()

        r = await auth_client.delete(f"/api/v1/addons/{other_addon_id}")
        assert r.status_code == 404

    async def test_cannot_delete_nonexistent_addon(self, auth_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await auth_client.delete(f"/api/v1/addons/{fake_id}")
        assert r.status_code == 404

    async def test_staff_cannot_delete_addon(self, staff_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await staff_client.delete(f"/api/v1/addons/{fake_id}")
        assert r.status_code == 403
