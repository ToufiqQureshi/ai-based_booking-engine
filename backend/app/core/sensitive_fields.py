"""
Sensitive field filtering for multi-tenant security.

In a multi-tenant hotel booking SaaS, the platform staff (super-admins) and
the per-hotel hoteliers see different slices of the same data. Hoteliers
MUST NOT see or modify:

  - AI provider credentials (api_key, base_url)
  - WhatsApp / Meta integration tokens (api_key, phone_number_id,
    business_account_id)
  - SMTP credentials (password) and Brevo API key
  - Internal quotas / counters (ai_whatsapp_credits, total_messages_sent)

These are platform-level concerns that affect cost, compliance (Meta
ToS, GDPR), and security (anyone with the WhatsApp token can send
messages on behalf of the hotel). If a hotelier leaves, revoking their
access MUST not require rotating these shared credentials.

Use `mask_hotel_for_hotelier()` on every response and
`strip_sensitive_from_update()` on every PATCH payload to enforce this
consistently.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, Optional, Set, Tuple

# Top-level Hotel table columns that are sensitive.
HOTEL_SENSITIVE_COLUMNS: Set[str] = {
    "ai_api_key",
    "ai_base_url",
    # is_paused / pause_reason / paused_at stay editable by super-admin only.
    # The hotelier cannot self-unpause; the mask keeps them visible to the
    # super-admin via a separate endpoint and to the hotelier read-only.
}

# HotelSettings (JSON column) keys that are sensitive.
HOTEL_SETTINGS_SENSITIVE_KEYS: Set[str] = {
    "whatsapp_api_key",
    "whatsapp_phone_number_id",
    "whatsapp_business_account_id",
    "brevo_api_key",
    "smtp_password",
    "smtp_username",
    "smtp_host",
    "smtp_port",
    # Internal counters / quotas — hotelier sees the value but can't edit.
    "ai_whatsapp_credits",
    "total_messages_sent",
}

# Fields that hotelier can READ but cannot PATCH.
HOTELIER_READ_ONLY: Set[str] = {
    "is_active",
    "is_paused",
    "pause_reason",
    "paused_at",
    "created_at",
    "updated_at",
    "ai_whatsapp_credits",
    "total_messages_sent",
}


def _mask_settings_for_hotelier(settings: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Replace sensitive values with boolean `has_*` flags so the hotelier
    can tell whether the platform has configured a given integration
    without seeing the secret itself."""
    if not isinstance(settings, dict):
        return {}
    masked: Dict[str, Any] = {}
    for k, v in settings.items():
        if k in HOTEL_SETTINGS_SENSITIVE_KEYS:
            # Replace secret with a presence flag.
            if k == "whatsapp_api_key":
                masked["has_whatsapp_api_key"] = bool(v)
            elif k == "whatsapp_phone_number_id":
                masked["has_whatsapp_phone_id"] = bool(v)
            elif k == "whatsapp_business_account_id":
                masked["has_whatsapp_business_id"] = bool(v)
            elif k == "brevo_api_key":
                masked["has_brevo_key"] = bool(v)
            elif k == "smtp_password":
                masked["has_smtp_password"] = bool(v)
            elif k in ("smtp_host", "smtp_port", "smtp_username"):
                masked["has_smtp_config"] = bool(v)
            elif k == "ai_whatsapp_credits":
                # Surface remaining credits (read-only useful for UI)
                masked["ai_whatsapp_credits"] = int(v) if isinstance(v, (int, float)) else 0
            elif k == "total_messages_sent":
                masked["total_messages_sent"] = int(v) if isinstance(v, (int, float)) else 0
            # drop the actual secret
        else:
            masked[k] = v
    return masked


def mask_hotel_for_hotelier(hotel: Any) -> Dict[str, Any]:
    """Return a dict representation of a Hotel with all sensitive fields
    removed or masked. Use this for any /hotels/me response.

    The returned dict is compatible with the HotelRead Pydantic schema
    (no extra keys that would fail strict validation), and is safe to
    hand to a hotelier without leaking platform credentials.
    """
    # Accept either an ORM instance or a plain dict.
    try:
        if hasattr(hotel, "model_dump") and callable(hotel.model_dump):
            base = hotel.model_dump()
        elif hasattr(hotel, "dict") and callable(hotel.dict):
            base = hotel.dict()
        elif isinstance(hotel, dict):
            base = dict(hotel)
        else:
            base = dict(hotel)
    except Exception:
        # Last-resort: pull known columns off the ORM instance directly.
        base = {
            "id": getattr(hotel, "id", None),
            "name": getattr(hotel, "name", None),
            "slug": getattr(hotel, "slug", None),
            "description": getattr(hotel, "description", None),
            "star_rating": getattr(hotel, "star_rating", None),
            "logo_url": getattr(hotel, "logo_url", None),
            "primary_color": getattr(hotel, "primary_color", None),
            "amenities": getattr(hotel, "amenities", []),
            "address": getattr(hotel, "address", {}),
            "contact": getattr(hotel, "contact", {}),
            "settings": getattr(hotel, "settings", {}),
            "photos": getattr(hotel, "photos", []),
            "created_at": getattr(hotel, "created_at", None),
            "updated_at": getattr(hotel, "updated_at", None),
        }
        # Add feature flags explicitly
        for f in (
            "feature_rate_shopper", "feature_ai_agent", "feature_guest_bot",
            "feature_ai_assistant", "feature_new_booking", "feature_color_palette",
            "feature_custom_logo", "feature_custom_widget", "feature_google_ads",
        ):
            if hasattr(hotel, f):
                base[f] = getattr(hotel, f)

    # Drop top-level sensitive columns entirely (not part of HotelRead either).
    for col in HOTEL_SENSITIVE_COLUMNS:
        base.pop(col, None)
    # Also drop is_paused / pause_reason / paused_at from the hotelier view.
    # Hotelier should never know whether they're paused (that's an admin
    # tool). They'll find out when they try to PATCH and get a 423.
    for col in ("is_paused", "pause_reason", "paused_at", "is_active"):
        base.pop(col, None)

    # Surface presence flags for AI integration without exposing the key.
    base["has_ai_key"] = bool(getattr(hotel, "ai_api_key", None))
    base["ai_provider"] = getattr(hotel, "ai_provider", None)
    base["ai_model"] = getattr(hotel, "ai_model", None)

    # Mask the settings JSON.
    if isinstance(base.get("settings"), dict):
        base["settings"] = _mask_settings_for_hotelier(base["settings"])

    return base


def strip_sensitive_from_update(
    update: Dict[str, Any],
) -> Tuple[Dict[str, Any], Set[str]]:
    """Remove sensitive fields from a hotelier-initiated update payload.

    Returns the cleaned payload and the set of stripped keys (for logging
    / audit). Raises ValueError on keys that explicitly cannot be changed
    by the hotelier (read-only fields).
    """
    if not isinstance(update, dict):
        return {}, set()

    forbidden: Set[str] = set()
    for col in HOTELIER_READ_ONLY:
        if col in update:
            forbidden.add(col)

    if forbidden:
        raise ValueError(
            f"These fields are managed by your platform admin and cannot be "
            f"updated from the hotelier dashboard: {sorted(forbidden)}"
        )

    cleaned: Dict[str, Any] = {}
    stripped: Set[str] = set()
    for k, v in update.items():
        if k in HOTEL_SENSITIVE_COLUMNS:
            stripped.add(k)
            continue
        if k == "settings" and isinstance(v, dict):
            cleaned_v = {
                sk: sv
                for sk, sv in v.items()
                if sk not in HOTEL_SETTINGS_SENSITIVE_KEYS
            }
            stripped_settings = set(v.keys()) - set(cleaned_v.keys())
            stripped.update(stripped_settings)
            cleaned["settings"] = cleaned_v
            continue
        cleaned[k] = v
    return cleaned, stripped
