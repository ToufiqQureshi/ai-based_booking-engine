"""
Guest Tests
Covers:
  - GET /bookings/guests — auth guard, paginated list, response shape,
                           tenant isolation (only own hotel's guests returned)
  - GET /bookings/guest-stats — auth guard, numeric fields, empty state
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.bookings.booking import Booking, BookingStatus, Guest
from app.brand_console.hotel import Hotel

pytestmark = pytest.mark.asyncio


async def _seed_guest_and_booking(hotel_id: str) -> Guest:
    """Seed a confirmed booking + guest for a given hotel."""
    from tests.conftest import engine

    guest = Guest(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        first_name="Test",
        last_name="Guest",
        email=f"guest-{uuid.uuid4().hex[:6]}@hotel.com",
        phone="9000000000",
    )
    from datetime import date
    booking = Booking(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        booking_number=f"BK{uuid.uuid4().hex[:8].upper()}",
        guest_id=guest.id,
        check_in=date(2030, 3, 1),
        check_out=date(2030, 3, 3),
        status=BookingStatus.CONFIRMED,
        total_amount=3000.0,
        rooms=[],
    )
    async with AsyncSession(engine) as session:
        session.add(guest)
        session.add(booking)
        await session.commit()
        await session.refresh(guest)
    return guest


class TestGetGuests:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/bookings/guests")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.get("/api/v1/bookings/guests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_hotel_no_crash(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/bookings/guests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_pagination_params_accepted(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/bookings/guests?limit=5&offset=0")
        assert r.status_code == 200

    async def test_tenant_isolation(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """A guest belonging to another hotel must NOT appear in the response."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_hotel = Hotel(
            id=other_hotel_id,
            name="Isolation Hotel",
            slug=f"isolation-{uuid.uuid4().hex[:6]}",
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            await session.commit()

        other_guest = await _seed_guest_and_booking(other_hotel_id)
        r = await auth_client.get("/api/v1/bookings/guests")
        assert r.status_code == 200
        guest_emails = [g["email"] for g in r.json()]
        assert other_guest.email not in guest_emails, (
            "Guest from another hotel leaked into response"
        )


class TestGuestStats:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/bookings/guests/stats")
        assert r.status_code == 401

    async def test_returns_numeric_fields(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/bookings/guests/stats")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        # All numeric counters must be >= 0
        for key, val in data.items():
            if isinstance(val, (int, float)):
                assert val >= 0, f"Negative value for '{key}': {val}"
