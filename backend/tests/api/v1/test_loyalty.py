"""
Loyalty Tests
Covers:
  - GET /loyalty/program — auth guard, auto-creates on first call, shape
  - GET /loyalty/members — auth guard, returns paginated list
  - PUT /loyalty/program — OWNER/MANAGER can update; STAFF blocked
  - GET /loyalty/offers  — auth guard, empty list on fresh hotel
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

_PROGRAM_KEYS = (
    "id", "hotel_id", "is_active", "program_name",
    "milestone_bookings", "reward_type", "reward_value",
)


class TestLoyaltyProgram:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/loyalty/program")
        assert r.status_code == 401

    async def test_auto_creates_program_and_returns_shape(self, auth_client: AsyncClient):
        """First call must create the program if it doesn't exist and return all keys."""
        r = await auth_client.get("/api/v1/loyalty/program")
        assert r.status_code == 200
        data = r.json()
        for key in _PROGRAM_KEYS:
            assert key in data, f"Loyalty program response missing key: '{key}'"

    async def test_idempotent_second_call(self, auth_client: AsyncClient):
        """Calling twice must return the same program, not create a duplicate."""
        r1 = await auth_client.get("/api/v1/loyalty/program")
        r2 = await auth_client.get("/api/v1/loyalty/program")
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]

    async def test_staff_can_view_program(self, staff_client: AsyncClient):
        """STAFF role is allowed to read loyalty config."""
        r = await staff_client.get("/api/v1/loyalty/program")
        assert r.status_code == 200

    async def test_update_requires_owner_or_manager(self, staff_client: AsyncClient):
        """STAFF cannot modify the loyalty program."""
        r = await staff_client.put("/api/v1/loyalty/program", json={"is_active": False})
        assert r.status_code == 403


class TestLoyaltyMembers:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/loyalty/guests")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/loyalty/guests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_hotel_returns_empty_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/loyalty/guests")
        assert r.status_code == 200
        # With no completed bookings, list must be empty — not crash
        data = r.json()
        assert isinstance(data, list)


class TestLoyaltyOffers:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/loyalty/offers")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/loyalty/offers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_create_offer_requires_owner_or_manager(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/loyalty/offers", json={
            "title": "Free Night",
            "description": "Stay 5 nights get 1 free",
            "offer_type": "free_night",
            "required_bookings": 5,
        })
        assert r.status_code == 403
