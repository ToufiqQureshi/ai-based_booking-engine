"""
Public Hotel & Room Search Tests
Covers:
  - GET /public/hotels/{slug}                    — returns hotel info for the widget
  - GET /public/hotels/{slug}/rooms              — returns available rooms for a date range
  - POST /public/bookings/cancel-request         — wrong email rejected
"""
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.bookings.booking import Booking, BookingStatus, Guest
from app.brand_console.hotel import Hotel
from app.rooms.room import RoomType

pytestmark = pytest.mark.asyncio


def _future(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


# ─── Hotel Info (public, no auth) ────────────────────────────────────────────

class TestPublicHotelInfo:
    async def test_nonexistent_slug_returns_404(self, client: AsyncClient):
        r = await client.get("/api/v1/public/hotels/no-such-hotel-xyz-abc")
        assert r.status_code == 404

    async def test_valid_slug_returns_hotel_info(self, client: AsyncClient, seeded_hotel: Hotel):
        r = await client.get(f"/api/v1/public/hotels/{seeded_hotel.slug}")
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "name" in data

    async def test_raw_api_key_not_leaked_in_public_response(self, client: AsyncClient, seeded_hotel: Hotel):
        """Raw API key values must never appear in the public hotel endpoint."""
        r = await client.get(f"/api/v1/public/hotels/{seeded_hotel.slug}")
        assert r.status_code == 200
        data = r.json()
        # Verify that if keys appear, they are masked booleans — not raw strings
        # Raw secret keys would be non-null strings; the API must return null or boolean
        settings = data.get("settings") or {}
        for secret_field in ("razorpay_key_secret", "whatsapp_api_key"):
            val = settings.get(secret_field)
            # If the field is present in the response, it must be masked (None or bool)
            assert not isinstance(val, str) or val == "", (
                f"Raw secret '{secret_field}' value leaked in public response"
            )


# ─── Room Search (public, no auth) ───────────────────────────────────────────

class TestPublicRoomSearch:
    async def test_nonexistent_hotel_returns_404(self, client: AsyncClient):
        r = await client.get(
            "/api/v1/public/hotels/no-such-hotel-xyz-abc/rooms"
            f"?check_in={_future(5)}&check_out={_future(6)}"
        )
        assert r.status_code == 404

    async def test_valid_hotel_returns_room_list(self, client: AsyncClient, seeded_hotel: Hotel):
        r = await client.get(
            f"/api/v1/public/hotels/{seeded_hotel.slug}/rooms"
            f"?check_in={_future(5)}&check_out={_future(6)}"
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_missing_dates_returns_422(self, client: AsyncClient, seeded_hotel: Hotel):
        r = await client.get(f"/api/v1/public/hotels/{seeded_hotel.slug}/rooms")
        assert r.status_code == 422


# ─── Public cancel: wrong email blocked ──────────────────────────────────────

class TestPublicCancel:
    async def test_cancel_request_wrong_email_rejected(
        self, client: AsyncClient, seeded_hotel: Hotel
    ):
        """Cancel request with a non-matching email must be rejected."""
        from tests.conftest import engine

        guest = Guest(
            id=str(uuid.uuid4()),
            hotel_id=seeded_hotel.id,
            first_name="Cancel",
            last_name="Me",
            email="cancel-me@test.com",
            phone="9111111111",
        )
        booking_id = str(uuid.uuid4())
        booking = Booking(
            id=booking_id,
            hotel_id=seeded_hotel.id,
            booking_number=f"BKCANCEL{uuid.uuid4().hex[:4].upper()}",
            guest_id=guest.id,
            check_in=date.today() + timedelta(days=30),
            check_out=date.today() + timedelta(days=32),
            status=BookingStatus.CONFIRMED,
            total_amount=2000.0,
            rooms=[],
        )
        async with AsyncSession(engine) as session:
            session.add(guest)
            session.add(booking)
            await session.commit()

        r = await client.post(
            "/api/v1/public/bookings/cancel-request",
            json={
                "booking_id": booking_id,
                "email": "wrong-email@attacker.com",
            },
        )
        assert r.status_code in (400, 403, 404, 422)


# ─── Paused Hotel (Bug #1 Regression) ──────────────────────────────────────────

class TestPublicHotelPause:
    async def test_regression_paused_hotel_blocks_new_bookings(self, client: AsyncClient, seeded_hotel: Hotel):
        """Regression test for Bug #1: Paused hotel must block public bookings/chat."""
        from tests.conftest import engine
        from sqlalchemy.ext.asyncio import AsyncSession
        from app.core.cache.redis_client import redis_client
        
        # Pause the hotel
        async with AsyncSession(engine) as session:
            db_hotel = await session.get(Hotel, seeded_hotel.id)
            db_hotel.is_paused = True
            await session.commit()
            
        r = await client.get(
            f"/api/v1/public/hotels/{seeded_hotel.slug}/rooms"
            f"?check_in={_future(5)}&check_out={_future(6)}"
        )
        assert r.status_code == 403

        # Unpause the hotel to not break other tests using seeded_hotel
        async with AsyncSession(engine) as session:
            db_hotel = await session.get(Hotel, seeded_hotel.id)
            db_hotel.is_paused = False
            await session.commit()
