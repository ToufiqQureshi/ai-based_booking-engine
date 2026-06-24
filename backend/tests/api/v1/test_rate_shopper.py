"""
Rate Shopper / Competitors Tests
Covers:
  - GET /competitors        — auth guard, returns list, tenant isolation
  - POST /competitors       — auth guard, OWNER can add, STAFF blocked, tampered hotel_id ignored
  - DELETE /competitors/:id — auth guard, IDOR guard (cannot delete another hotel's competitor)
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.rate_shopper.competitor import Competitor

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
        """Fresh hotel has no competitors — must return [] not crash."""
        r = await auth_client.get("/api/v1/competitors")
        assert r.status_code == 200
        assert r.json() == []

    async def test_tenant_isolation(self, auth_client: AsyncClient):
        """Competitors seeded for another hotel must not appear in our list."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_competitor_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Comp Hotel",
            slug=f"other-comp-{uuid.uuid4().hex[:6]}",
        )
        other_competitor = Competitor(
            id=other_competitor_id,
            hotel_id=other_hotel_id,
            name="Sneaky Rival",
            url="https://sneaky-rival.com",
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_competitor)
            await session.commit()

        r = await auth_client.get("/api/v1/competitors")
        assert r.status_code == 200
        comp_ids = [c["id"] for c in r.json()]
        assert other_competitor_id not in comp_ids, (
            "Competitor from another hotel leaked into response"
        )


class TestCreateCompetitor:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.post("/api/v1/competitors", json={
            "name": "Anon Rival", "url": "https://anon.com",
        })
        assert r.status_code == 401

    async def test_staff_cannot_create_competitor(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/competitors", json={
            "name": "Rival Hotel",
            "url": "https://rival.com",
        })
        assert r.status_code == 403

    async def test_owner_can_create_competitor(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Owner POST returns 201 with id and name."""
        r = await auth_client.post("/api/v1/competitors", json={
            "name": f"Rival {uuid.uuid4().hex[:6]}",
            "url": "https://test-rival.com",
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert "id" in data
        assert "name" in data
        assert data["hotel_id"] == seeded_hotel.id

    async def test_invalid_payload_returns_422(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/competitors", json={})
        assert r.status_code == 422

    async def test_tampered_hotel_id_ignored(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Client cannot forge hotel_id — backend must use authenticated hotel."""
        r = await auth_client.post("/api/v1/competitors", json={
            "name": f"Tamper Rival {uuid.uuid4().hex[:6]}",
            "url": "https://tamper.com",
            "hotel_id": str(uuid.uuid4()),  # attempted forge
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["hotel_id"] == seeded_hotel.id, (
            "Backend must use authenticated hotel_id, not the client-supplied one"
        )


class TestDeleteCompetitor:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.delete(f"/api/v1/competitors/{uuid.uuid4()}")
        assert r.status_code == 401

    async def test_cannot_delete_nonexistent_competitor(self, auth_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await auth_client.delete(f"/api/v1/competitors/{fake_id}")
        assert r.status_code in (403, 404)

    async def test_staff_cannot_delete_competitor(self, staff_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await staff_client.delete(f"/api/v1/competitors/{fake_id}")
        assert r.status_code == 403

    async def test_idor_cannot_delete_other_hotel_competitor(
        self, auth_client: AsyncClient
    ):
        """auth_client (hotel A) cannot delete a competitor owned by hotel B."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_competitor_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Delete Hotel",
            slug=f"other-delete-{uuid.uuid4().hex[:6]}",
        )
        other_competitor = Competitor(
            id=other_competitor_id,
            hotel_id=other_hotel_id,
            name="Protected Rival",
            url="https://protected-rival.com",
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_competitor)
            await session.commit()

        r = await auth_client.delete(f"/api/v1/competitors/{other_competitor_id}")
        assert r.status_code == 404
