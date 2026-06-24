"""
Marketing / Leads Tests
Covers:
  - GET /leads/  — auth guard, returns paginated list, tenant-scoped
  - PATCH /leads/:id — IDOR guard (cannot patch another hotel's lead)
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.brand_console.lead import Lead

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
        """Fresh hotel has no leads — must return [] not crash."""
        r = await auth_client.get("/api/v1/leads/")
        assert r.status_code == 200
        assert r.json() == []

    async def test_pagination_params_accepted(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/leads/?limit=5&offset=0")
        assert r.status_code == 200


class TestLeadIsolation:
    async def test_idor_cannot_patch_other_hotel_lead(self, auth_client: AsyncClient):
        """auth_client (hotel A) patching a lead owned by hotel B must get 404."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_lead_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Lead Hotel",
            slug=f"other-lead-{uuid.uuid4().hex[:6]}",
        )
        other_lead = Lead(
            id=other_lead_id,
            hotel_id=other_hotel_id,
            guest_name="Other Guest",
            guest_phone="9000000099",
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_lead)
            await session.commit()

        r = await auth_client.patch(f"/api/v1/leads/{other_lead_id}?status=contacted")
        assert r.status_code == 404
