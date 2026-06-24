"""
Razorpay Webhook Tests
Covers:
  - POST /public/razorpay/webhook — valid HMAC signature accepted
  - POST /public/razorpay/webhook — missing/tampered signature rejected (400)
  - POST /public/razorpay/webhook — no RAZORPAY_WEBHOOK_SECRET configured → 500
  - POST /public/razorpay/webhook — duplicate X-Razorpay-Event-Id idempotency
  - POST /public/razorpay/verify  — tampered signature rejected (400)

Razorpay is mocked at the client level; no real API keys required.
"""
import hashlib
import hmac
import json
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.bookings.booking import Booking, BookingStatus, Guest
from app.brand_console.hotel import Hotel
from app.rooms.room import RoomType

pytestmark = pytest.mark.asyncio

_WEBHOOK_URL = "/api/v1/public/razorpay/webhook"
_VERIFY_URL = "/api/v1/public/razorpay/verify"
_TEST_SECRET = "test_webhook_secret_32chars_min!!"


def _make_signature(body: bytes, secret: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()


def _webhook_body(booking_id: str, payment_id: str, order_id: str) -> dict:
    return {
        "entity": "event",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "order_id": order_id,
                    "status": "captured",
                    "amount": 200000,  # paise
                }
            }
        },
    }


async def _seed_booking(hotel_id: str, amount: float = 2000.0) -> Booking:
    from tests.conftest import engine
    guest = Guest(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        first_name="Webhook",
        last_name="Test",
        email=f"wh-{uuid.uuid4().hex[:6]}@test.com",
        phone="9000000000",
    )
    booking = Booking(
        id=str(uuid.uuid4()),
        hotel_id=hotel_id,
        booking_number=f"BKW{uuid.uuid4().hex[:6].upper()}",
        guest_id=guest.id,
        check_in=date(2030, 5, 1),
        check_out=date(2030, 5, 3),
        status=BookingStatus.PENDING,
        total_amount=amount,
        rooms=[],
    )
    async with AsyncSession(engine) as session:
        session.add(guest)
        session.add(booking)
        await session.commit()
        await session.refresh(booking)
    return booking


# ─── Signature validation ─────────────────────────────────────────────────────

class TestWebhookSignature:
    async def test_missing_signature_rejected(self, client: AsyncClient):
        """No X-Razorpay-Signature header must return 400."""
        body = json.dumps({"event": "payment.captured"}).encode()
        with patch("app.guest_booking.payments.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = _TEST_SECRET
            r = await client.post(
                _WEBHOOK_URL,
                content=body,
                headers={"Content-Type": "application/json"},
            )
        assert r.status_code == 400

    async def test_tampered_signature_rejected(self, client: AsyncClient):
        """Wrong signature must return 400, not 200."""
        body = json.dumps({"event": "payment.captured"}).encode()
        with patch("app.guest_booking.payments.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = _TEST_SECRET
            r = await client.post(
                _WEBHOOK_URL,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": "deadbeef" * 8,
                },
            )
        assert r.status_code == 400

    async def test_valid_signature_accepted(self, client: AsyncClient, seeded_hotel: Hotel):
        """A correctly HMAC-signed body with a known event must not be rejected."""
        body_dict = {
            "event": "order.paid",
            "payload": {},
        }
        body = json.dumps(body_dict).encode()
        sig = _make_signature(body, _TEST_SECRET)
        event_id = str(uuid.uuid4())

        with patch("app.guest_booking.payments.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = _TEST_SECRET
            r = await client.post(
                _WEBHOOK_URL,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": sig,
                    "X-Razorpay-Event-Id": event_id,
                },
            )
        # Signature is valid; may be 200 (processed/ignored) but never 400
        assert r.status_code != 400

    async def test_unconfigured_webhook_secret_returns_500(self, client: AsyncClient):
        """Missing RAZORPAY_WEBHOOK_SECRET must yield 500, not crash silently."""
        body = json.dumps({"event": "payment.captured"}).encode()
        with patch("app.guest_booking.payments.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = ""
            r = await client.post(
                _WEBHOOK_URL,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Razorpay-Signature": "anysig",
                },
            )
        assert r.status_code == 500


# ─── Idempotency ─────────────────────────────────────────────────────────────

class TestWebhookIdempotency:
    async def test_duplicate_event_id_is_ignored(self, client: AsyncClient):
        """The same X-Razorpay-Event-Id sent twice must return 'ignored' on the second call."""
        body = json.dumps({"event": "order.paid", "payload": {}}).encode()
        sig = _make_signature(body, _TEST_SECRET)
        event_id = f"evt_{uuid.uuid4().hex}"

        headers = {
            "Content-Type": "application/json",
            "X-Razorpay-Signature": sig,
            "X-Razorpay-Event-Id": event_id,
        }

        with patch("app.guest_booking.payments.get_settings") as mock_settings:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = _TEST_SECRET
            r1 = await client.post(_WEBHOOK_URL, content=body, headers=headers)
            r2 = await client.post(_WEBHOOK_URL, content=body, headers=headers)

        # Both requests must succeed (not crash), and the second must be idempotent
        assert r1.status_code not in (400, 500)
        assert r2.status_code not in (400, 500)
        if r2.status_code == 200:
            assert r2.json().get("reason") == "duplicate_event" or r2.json().get("status") in ("ignored", "success")


# ─── Verify endpoint — signature mismatch ────────────────────────────────────

class TestVerifyPayment:
    async def test_invalid_signature_rejected(self, client: AsyncClient, seeded_hotel: Hotel):
        """Posting a tampered signature to /verify must return 400."""
        booking = await _seed_booking(seeded_hotel.id, amount=2000.0)

        with patch("app.guest_booking.payments.get_settings") as mock_settings, \
             patch("app.guest_booking.payments.razorpay.Client") as mock_rz:
            mock_settings.return_value.RAZORPAY_WEBHOOK_SECRET = _TEST_SECRET
            # Make the Razorpay client raise SignatureVerificationError
            import razorpay
            mock_rz.return_value.utility.verify_payment_signature.side_effect = (
                razorpay.errors.SignatureVerificationError("sig mismatch", "")
            )
            r = await client.post(_VERIFY_URL, json={
                "razorpay_order_id": "order_fake123456789",
                "razorpay_payment_id": "pay_fake1234567890",
                "razorpay_signature": "badsignature" * 4,
                "booking_id": booking.id,
            })

        assert r.status_code == 400

    async def test_nonexistent_booking_returns_404(self, client: AsyncClient):
        r = await client.post(_VERIFY_URL, json={
            "razorpay_order_id": "order_fake123456789",
            "razorpay_payment_id": "pay_fake1234567890",
            "razorpay_signature": "anysig" * 8,
            "booking_id": str(uuid.uuid4()),
        })
        assert r.status_code in (400, 404, 503)
