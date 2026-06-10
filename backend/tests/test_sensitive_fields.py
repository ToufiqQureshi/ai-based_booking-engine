"""
Security regression tests for multi-tenant secret masking.

A hotelier must NEVER receive platform-level secrets (WhatsApp/Meta tokens,
SMTP password, Razorpay secret, AI provider key) in any settings payload — only
a boolean `has_*` presence flag. A leaked Razorpay secret was a real Critical
bug; these tests pin that the masking layer keeps it from regressing.
"""
from app.core.sensitive_fields import (
    _is_sensitive_settings_key,
    _mask_settings_for_hotelier,
)


def test_sensitive_keys_detected():
    for key in (
        "whatsapp_api_key",
        "smtp_password",
        "razorpay_key_secret",
        "ai_api_key",
    ):
        assert _is_sensitive_settings_key(key) is True, key


def test_non_sensitive_keys_pass_through():
    for key in ("check_in_time", "cancellation_policy", "tax_rate", "currency"):
        assert _is_sensitive_settings_key(key) is False, key


def test_mask_never_leaks_secret_values():
    settings = {
        "whatsapp_api_key": "wa-SECRET-123",
        "smtp_password": "smtp-SECRET-456",
        "razorpay_key_secret": "rzp-SECRET-789",
        "check_in_time": "14:00",
        "currency": "INR",
    }
    masked = _mask_settings_for_hotelier(settings)

    # Secrets and their raw keys must be gone.
    flat = str(masked)
    assert "wa-SECRET-123" not in flat
    assert "smtp-SECRET-456" not in flat
    assert "rzp-SECRET-789" not in flat
    assert "whatsapp_api_key" not in masked
    assert "smtp_password" not in masked
    assert "razorpay_key_secret" not in masked

    # Presence flags must be exposed instead.
    assert masked.get("has_whatsapp_api_key") is True
    assert masked.get("has_smtp_password") is True
    assert masked.get("has_razorpay_secret") is True

    # Non-sensitive config is preserved verbatim.
    assert masked["check_in_time"] == "14:00"
    assert masked["currency"] == "INR"


def test_mask_handles_empty_and_none():
    assert _mask_settings_for_hotelier(None) == {}
    assert _mask_settings_for_hotelier({}).get("has_whatsapp_api_key") is None
