"""
Loyalty Tests
Covers:
  - GET /loyalty/program — auth guard, auto-creates on first call, shape
  - GET /loyalty/members — auth guard, returns paginated list
  - PUT /loyalty/program — OWNER/MANAGER can update; STAFF blocked
  - GET /loyalty/offers  — auth guard, empty list on fresh hotel
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.loyalty.loyalty_model import LoyaltyProgram

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

    async def test_unauthenticated_put_rejected(self, client: AsyncClient):
        r = await client.put("/api/v1/loyalty/program", json={"is_active": True})
        assert r.status_code == 401

    async def test_owner_can_update_program(self, auth_client: AsyncClient):
        """Owner PUT returns 200 and the updated program shape."""
        r = await auth_client.put("/api/v1/loyalty/program", json={"is_active": True, "program_name": "VIP Rewards"})
        assert r.status_code == 200
        data = r.json()
        for key in _PROGRAM_KEYS:
            assert key in data, f"PUT response missing key: '{key}'"

    async def test_put_invalid_payload_422(self, auth_client: AsyncClient):
        """PUT with a badly typed field must return 422."""
        r = await auth_client.put("/api/v1/loyalty/program", json={"milestone_bookings": "not_a_number"})
        assert r.status_code == 422

    async def test_tenant_isolation(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """GET returns own hotel's program, not another hotel's program."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_program_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Loyalty Hotel",
            slug=f"other-loyalty-{uuid.uuid4().hex[:6]}",
        )
        other_program = LoyaltyProgram(
            id=other_program_id,
            hotel_id=other_hotel_id,
            program_name="Other Hotel Program",
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_program)
            await session.commit()

        r = await auth_client.get("/api/v1/loyalty/program")
        assert r.status_code == 200
        data = r.json()
        assert data["hotel_id"] == seeded_hotel.id, (
            "Loyalty program must be scoped to the authenticated hotel"
        )
        assert data["id"] != other_program_id, (
            "Another hotel's program must not be returned"
        )


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
        assert data == []

    async def test_tenant_isolation(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Loyalty guests from another hotel must not appear in this hotel's list."""
        from tests.conftest import engine
        from app.bookings.booking import Booking, BookingStatus, Guest

        other_hotel_id = str(uuid.uuid4())
        other_guest_id = str(uuid.uuid4())
        other_guest_email = f"loyalty-other-{uuid.uuid4().hex[:6]}@test.com"

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Members Hotel",
            slug=f"other-members-{uuid.uuid4().hex[:6]}",
        )
        other_guest = Guest(
            id=other_guest_id,
            hotel_id=other_hotel_id,
            first_name="Loyalty",
            last_name="Other",
            email=other_guest_email,
            phone="9000000010",
        )
        from datetime import date
        other_booking = Booking(
            id=str(uuid.uuid4()),
            hotel_id=other_hotel_id,
            booking_number=f"BK{uuid.uuid4().hex[:8].upper()}",
            guest_id=other_guest_id,
            check_in=date(2030, 1, 1),
            check_out=date(2030, 1, 3),
            status=BookingStatus.CHECKED_OUT,
            total_amount=3000.0,
            rooms=[],
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_guest)
            session.add(other_booking)
            await session.commit()

        r = await auth_client.get("/api/v1/loyalty/guests")
        assert r.status_code == 200
        emails = [g.get("guest_email", "") for g in r.json()]
        assert other_guest_email not in emails, "Other hotel's loyalty guest leaked"


class TestLoyaltyOffers:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/loyalty/offers")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/loyalty/offers")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_hotel_returns_empty_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/loyalty/offers")
        assert r.status_code == 200
        assert r.json() == []

    async def test_create_offer_requires_owner_or_manager(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/loyalty/offers", json={
            "title": "Free Night",
            "description": "Stay 5 nights get 1 free",
            "offer_type": "free_night",
            "required_bookings": 5,
        })
        assert r.status_code == 403
