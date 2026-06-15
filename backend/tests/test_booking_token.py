"""
Tests for the public-booking anti-automation token (defence in depth on top of
the IP rate-limit + idempotency lock). A minted token must verify; tampered,
empty, malformed, and expired tokens must be rejected.
"""
import time

from app.guest_booking.bookings import _mint_booking_token, _verify_booking_token


def test_minted_token_verifies():
    assert _verify_booking_token(_mint_booking_token()) is True


def test_rejects_missing_and_malformed():
    assert _verify_booking_token(None) is False
    assert _verify_booking_token("") is False
    assert _verify_booking_token("no-dot") is False
    assert _verify_booking_token("notanumber.deadbeef") is False


def test_rejects_tampered_signature():
    ts, _, _sig = _mint_booking_token().partition(".")
    assert _verify_booking_token(f"{ts}.deadbeef") is False


def test_rejects_expired_token(monkeypatch):
    # Token timestamped well outside the TTL window must fail.
    old_ts = str(int(time.time()) - 10_000)
    import app.guest_booking.bookings as b
    import hashlib
    import hmac
    sig = hmac.new(b.app_settings.SECRET_KEY.encode(), old_ts.encode(), hashlib.sha256).hexdigest()
    assert _verify_booking_token(f"{old_ts}.{sig}") is False
