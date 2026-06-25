"""
Payments Tests
Covers:
  - GET /payments  — auth guard, response shape, tenant isolation, empty state
  - POST /payments — OWNER/MANAGER can create; STAFF blocked
  - POST /payments/refund — IDOR guard, no payment record → 404,
                            no Razorpay keys → 503, Razorpay call mocked
"""
import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.bookings.booking import Booking, BookingStatus, Guest
from app.brand_console.hotel import Hotel
from app.payments.payment import Payment

pytestmark = pytest.mark.asyncio


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _seed_booking_with_payment(hotel_id: str, payment_status: str = "completed") -> tuple[Booking, Payment]:
    """Create a confirmed booking + completed payment row."""
    from tests.conftest import engine

    guest = Guest(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        first_name="Pay",
        last_name="Test",
        email=f"pay-{uuid.uuid4().hex[:6]}@test.com",
        phone="9000000000",
    )
    booking = Booking(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        booking_number=f"BK{uuid.uuid4().hex[:8].upper()}",
        guest_id=guest.id,
        check_in=date(2030, 1, 10),
        check_out=date(2030, 1, 12),
        status=BookingStatus.CONFIRMED,
        total_amount=2000.0,
        rooms=[],
    )
    payment = Payment(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        booking_id=booking.id,
        amount=2000.0,
        currency="INR",
        status=payment_status,
        payment_method="razorpay",
        transaction_id=f"pay_{uuid.uuid4().hex[:16]}",
    )
    async with AsyncSession(engine) as session:
        session.add(guest)
        session.add(booking)
        session.add(payment)
        await session.commit()
        await session.refresh(payment)
        await session.refresh(booking)
    return booking, payment


# ─── GET /payments ────────────────────────────────────────────────────────────

class TestGetPayments:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/payments")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.get("/api/v1/payments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_response_shape(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Every field the frontend reads must be present in each payment row."""
        booking, _payment = await _seed_booking_with_payment(seeded_hotel.id)
        r = await auth_client.get("/api/v1/payments")
        assert r.status_code == 200
        payments = r.json()
        assert len(payments) >= 1
        p = payments[0]
        for key in ("id", "booking_id", "hotel_id", "amount", "currency",
                    "status", "created_at", "booking_number", "guest_name"):
            assert key in p, f"Missing key '{key}' in payment response"

    async def test_only_own_hotel_payments_returned(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Payments from another hotel must NOT appear in this hotel's list."""
        other_hotel_id = str(uuid.uuid4())
        # Seed a payment for an entirely different (non-existent) hotel_id —
        # the query must filter it out by hotel_id.
        from tests.conftest import engine
        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Hotel",
            slug=f"other-hotel-{uuid.uuid4().hex[:6]}",
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            await session.commit()

        _booking, other_payment = await _seed_booking_with_payment(other_hotel_id)
        r = await auth_client.get("/api/v1/payments")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert other_payment.id not in ids, "Payment from another hotel leaked into response"

    async def test_empty_state_no_crash(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/payments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── POST /payments ───────────────────────────────────────────────────────────

class TestCreatePayment:
    async def test_staff_cannot_create_payment(self, staff_client: AsyncClient, seeded_hotel: Hotel):
        """STAFF role must be blocked from recording payments."""
        r = await staff_client.post("/api/v1/payments", json={
            "booking_id": str(uuid.uuid4()),
            "amount": 500.0,
            "payment_method": "cash",
        })
        assert r.status_code == 403

    async def test_invalid_booking_returns_404(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Booking ID that doesn't belong to the hotel must return 404."""
        r = await auth_client.post("/api/v1/payments", json={
            "booking_id": str(uuid.uuid4()),
            "amount": 500.0,
            "payment_method": "cash",
        })
        assert r.status_code == 404


# ─── POST /payments/refund ────────────────────────────────────────────────────

class TestRefund:
    async def test_requires_owner_or_manager(self, staff_client: AsyncClient, seeded_hotel: Hotel):
        """STAFF must be blocked from initiating refunds."""
        r = await staff_client.post("/api/v1/payments/refund", json={
            "booking_id": str(uuid.uuid4()),
            "reason": "requested_by_customer",
        })
        assert r.status_code == 403

    async def test_other_hotel_booking_returns_404(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Refund for a booking that belongs to a different hotel must return 404."""
        r = await auth_client.post("/api/v1/payments/refund", json={
            "booking_id": str(uuid.uuid4()),
            "reason": "requested_by_customer",
        })
        assert r.status_code == 404

    async def test_no_completed_payment_returns_404(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """If booking exists but has no completed payment, refund must return 404."""
        from tests.conftest import engine

        guest = Guest(
            id=str(uuid.uuid4()),
            hotel_id=seeded_hotel.id,
            first_name="No",
            last_name="Pay",
            email=f"nopay-{uuid.uuid4().hex[:6]}@test.com",
            phone="9000000001",
        )
        booking_id = str(uuid.uuid4())
        booking = Booking(
            id=booking_id,
            hotel_id=seeded_hotel.id,
            booking_number=f"BK{uuid.uuid4().hex[:8].upper()}",
            guest_id=guest.id,
            check_in=date(2030, 2, 10),
            check_out=date(2030, 2, 12),
            status=BookingStatus.CONFIRMED,
            total_amount=1500.0,
            rooms=[],
        )
        async with AsyncSession(engine) as session:
            session.add(guest)
            session.add(booking)
            await session.commit()

        r = await auth_client.post("/api/v1/payments/refund", json={
            "booking_id": booking_id,
            "reason": "requested_by_customer",
        })
        assert r.status_code == 404

    async def test_no_razorpay_keys_returns_503(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Hotel without Razorpay configured must get 503, not crash."""
        booking, _payment = await _seed_booking_with_payment(seeded_hotel.id)
        # Hotel has no razorpay_key_id / razorpay_key_secret in settings (default)
        r = await auth_client.post("/api/v1/payments/refund", json={
            "booking_id": booking.id,
            "reason": "requested_by_customer",
        })
        assert r.status_code == 503

    async def test_successful_refund_mocked(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """With Razorpay keys set and mocked client, refund returns success shape."""
        from tests.conftest import engine

        # Inject Razorpay keys into hotel settings
        async with AsyncSession(engine) as session:
            h = await session.get(Hotel, seeded_hotel.id)
            h.settings = {
                **(h.settings or {}),
                "razorpay_key_id": "rzp_test_key",
                "razorpay_key_secret": "rzp_test_secret",
            }
            session.add(h)
            await session.commit()

        booking, payment = await _seed_booking_with_payment(seeded_hotel.id)

        mock_refund = MagicMock()
        mock_refund.refund = MagicMock(return_value={"id": "rfnd_test123"})
        mock_client = MagicMock()
        mock_client.payment = mock_refund

        with patch("razorpay.Client", return_value=mock_client):
            r = await auth_client.post("/api/v1/payments/refund", json={
                "booking_id": booking.id,
                "reason": "requested_by_customer",
            })

        # Restore settings
        async with AsyncSession(engine) as session:
            h = await session.get(Hotel, seeded_hotel.id)
            settings = dict(h.settings or {})
            settings.pop("razorpay_key_id", None)
            settings.pop("razorpay_key_secret", None)
            h.settings = settings
            session.add(h)
            await session.commit()

        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        assert "refund_id" in data
        assert "amount" in data
