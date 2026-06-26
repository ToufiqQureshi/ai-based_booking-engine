"""
Rate Plans Tests
Covers:
  - GET /rates/plans — auth guard, returns list, tenant isolation
  - POST /rates/plans — STAFF blocked, owner can create, 422 on bad input, tampered hotel_id ignored
  - IDOR: non-existent plan returns 404
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.rate_plans.rates_model import RatePlan

pytestmark = pytest.mark.asyncio


class TestGetRatePlans:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/rates/plans")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/rates/plans")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_state_no_crash(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/rates/plans")
        assert r.status_code == 200

    async def test_isolation_other_hotel_plan_excluded(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Plans from another hotel must not appear in our list."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_plan_id = str(uuid.uuid4())
        own_plan_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Rate Hotel",
            slug=f"other-rate-{uuid.uuid4().hex[:6]}",
        )
        other_plan = RatePlan(
            id=other_plan_id,
            hotel_id=other_hotel_id,
            name="Other Hotel Plan",
            meal_plan="EP",
            price_adjustment=0.0,
        )
        own_plan = RatePlan(
            id=own_plan_id,
            hotel_id=seeded_hotel.id,
            name=f"Own Plan {uuid.uuid4().hex[:6]}",
            meal_plan="CP",
            price_adjustment=100.0,
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_plan)
            session.add(own_plan)
            await session.commit()

        r = await auth_client.get("/api/v1/rates/plans")
        assert r.status_code == 200
        plan_ids = [p["id"] for p in r.json()]
        assert own_plan_id in plan_ids, "Own hotel's plan must appear in the list"
        assert other_plan_id not in plan_ids, "Other hotel's plan must not appear"


class TestRatePlanWrite:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.post("/api/v1/rates/plans", json={"name": "Anon Plan", "meal_plan": "EP"})
        assert r.status_code == 401

    async def test_staff_cannot_create_rate_plan(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/rates/plans", json={
            "name": "Hack Plan", "meal_plan": "EP",
        })
        assert r.status_code == 403

    async def test_owner_can_create_rate_plan(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Owner POST returns 200/201 with id, hotel_id, name."""
        r = await auth_client.post("/api/v1/rates/plans", json={
            "name": f"New Plan {uuid.uuid4().hex[:6]}",
            "meal_plan": "MAP",
            "price_adjustment": 200.0,
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert "id" in data
        assert "hotel_id" in data
        assert "name" in data
        assert data["hotel_id"] == seeded_hotel.id

    async def test_invalid_payload_422(self, auth_client: AsyncClient):
        """POST with missing required fields returns 422."""
        r = await auth_client.post("/api/v1/rates/plans", json={})
        assert r.status_code == 422

    async def test_tampered_hotel_id_ignored(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Client cannot forge hotel_id — backend must use authenticated hotel."""
        forged_hotel_id = str(uuid.uuid4())
        r = await auth_client.post("/api/v1/rates/plans", json={
            "name": f"Tamper Plan {uuid.uuid4().hex[:6]}",
            "meal_plan": "EP",
            "hotel_id": forged_hotel_id,  # attempted forge — backend must ignore
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert data["hotel_id"] == seeded_hotel.id, (
            "Backend must use authenticated hotel_id, not the client-supplied one"
        )
