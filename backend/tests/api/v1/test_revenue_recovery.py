"""
Abandoned-booking recovery — sweep logic, dedup, opt-in gating, hotelier endpoints.

Senders (_send_recovery_email / _send_recovery_whatsapp) are monkeypatched so no
real email/WhatsApp goes out and the test asserts on sweep bookkeeping.
"""
import uuid
from datetime import datetime, timedelta, date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.database import engine
from app.brand_console.hotel import Hotel
from app.bookings.booking import Booking, BookingStatus, Guest
import app.revenue.recovery as recovery

pytestmark = pytest.mark.asyncio


async def _make_hotel(recovery_enabled: bool) -> Hotel:
    hotel = Hotel(
        id=str(uuid.uuid4()),
        name="Recovery Test Hotel",
        slug=f"rec-{uuid.uuid4().hex[:8]}",
        settings={"recovery_enabled": recovery_enabled},
    )
    async with AsyncSession(engine) as s:
        s.add(hotel)
        await s.commit()
        await s.refresh(hotel)
    return hotel


async def _make_abandoned_booking(hotel_id: str, *, age_minutes: int = 60,
                                   status=BookingStatus.PENDING, paid: float = 0.0) -> Booking:
    guest = Guest(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        first_name="Asha",
        last_name="Guest",
        email=f"asha-{uuid.uuid4().hex[:6]}@example.com",
        phone="+919999999999",
    )
    booking = Booking(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        guest_id=guest.id,
        booking_number=f"BK{uuid.uuid4().hex[:10]}",
        check_in=date(2026, 7, 1),
        check_out=date(2026, 7, 4),
        status=status,
        total_amount=6000.0,
        paid_amount=paid,
        rooms=[{"room_type_id": "x", "price": 6000}],
        created_at=datetime.utcnow() - timedelta(minutes=age_minutes),
    )
    async with AsyncSession(engine) as s:
        s.add(guest)
        s.add(booking)
        await s.commit()
        await s.refresh(booking)
    return booking


async def _get_booking(booking_id: str) -> Booking:
    async with AsyncSession(engine) as s:
        return await s.get(Booking, booking_id)


@pytest.fixture(autouse=True)
def _stub_senders(monkeypatch):
    """Stub the real email/WhatsApp senders so tests never hit the network."""
    sent = {"email": 0, "whatsapp": 0}

    async def fake_email(guest, hotel, booking):
        sent["email"] += 1
        return True

    async def fake_wa(guest, hotel, booking):
        sent["whatsapp"] += 1
        return True

    monkeypatch.setattr(recovery, "_send_recovery_email", fake_email)
    monkeypatch.setattr(recovery, "_send_recovery_whatsapp", fake_wa)
    return sent


class TestRecoverySweep:
    async def test_nudges_enabled_hotel(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=True)
        booking = await _make_abandoned_booking(hotel.id)

        result = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert result["nudged"] == 1
        assert _stub_senders["email"] == 1

        refreshed = await _get_booking(booking.id)
        assert refreshed.recovery_sent_at is not None

    async def test_does_not_double_send(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=True)
        await _make_abandoned_booking(hotel.id)

        first = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert first["nudged"] == 1
        second = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert second["nudged"] == 0  # already stamped, skipped

    async def test_disabled_hotel_skipped(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=False)
        await _make_abandoned_booking(hotel.id)

        result = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert result["nudged"] == 0
        assert result["skipped_disabled"] == 1

    async def test_force_overrides_disabled(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=False)
        await _make_abandoned_booking(hotel.id)

        result = await recovery.run_abandoned_recovery(hotel_id=hotel.id, force=True)
        assert result["nudged"] == 1

    async def test_too_recent_not_swept(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=True)
        await _make_abandoned_booking(hotel.id, age_minutes=5)  # inside grace window

        result = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert result["nudged"] == 0

    async def test_paid_booking_not_swept(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=True)
        await _make_abandoned_booking(hotel.id, paid=6000.0)

        result = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert result["nudged"] == 0

    async def test_confirmed_booking_not_swept(self, _stub_senders):
        hotel = await _make_hotel(recovery_enabled=True)
        await _make_abandoned_booking(hotel.id, status=BookingStatus.CONFIRMED)

        result = await recovery.run_abandoned_recovery(hotel_id=hotel.id)
        assert result["nudged"] == 0


class TestRecoveryEndpoints:
    async def test_run_now_requires_auth(self, client):
        r = await client.post("/api/v1/revenue/recovery/run")
        assert r.status_code == 401

    async def test_abandoned_list_requires_auth(self, client):
        r = await client.get("/api/v1/revenue/recovery/abandoned")
        assert r.status_code == 401

    async def test_run_now_authed(self, auth_client, _stub_senders):
        r = await auth_client.post("/api/v1/revenue/recovery/run")
        assert r.status_code == 200
        assert "nudged" in r.json()


class TestBookingLink:
    """Regression: the resume link was hardcoded to https://staybooker.ai/book,
    ignoring FRONTEND_URL — a staging/self-hosted deploy would email guests
    prod links. It must follow config, with the per-hotel override intact."""

    async def test_link_uses_frontend_url_config(self):
        from app.core.utils.config import get_settings

        hotel = await _make_hotel(recovery_enabled=True)
        expected_base = get_settings().FRONTEND_URL.rstrip("/")
        assert recovery._booking_link(hotel) == f"{expected_base}/book/{hotel.slug}/rooms"

    async def test_per_hotel_override_still_wins(self):
        hotel = await _make_hotel(recovery_enabled=True)
        hotel.settings = {**hotel.settings, "public_booking_base_url": "https://book.myhotel.example"}
        assert recovery._booking_link(hotel) == f"https://book.myhotel.example/{hotel.slug}/rooms"
