"""
Super-admin per-hotel integrations: secret handling guards.

These pin the security contract for the super-admin Integrations tab:
  1. Raw API keys (AI / WhatsApp / Brevo) are NEVER returned to the client —
     not in the PATCH response, not in the hotel list. Only "<key>_set"
     booleans are exposed.
  2. A "__KEEP__" sentinel on a secret field means "leave the stored secret
     untouched", so opening the tab and saving can't wipe a configured key
     (the form never receives the real value to send back).
"""
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.database import engine
from app.brand_console.hotel import Hotel

PATCH = "/api/v1/superadmin/hotels"


async def _make_hotel() -> Hotel:
    h = Hotel(id=str(uuid.uuid4()), name="Sec Test Hotel", slug=f"sec-{uuid.uuid4().hex[:8]}")
    async with AsyncSession(engine) as s:
        s.add(h)
        await s.commit()
        await s.refresh(h)
    return h


@pytest.mark.asyncio
async def test_secrets_never_returned_but_set_flags_exposed(super_admin_client):
    hotel = await _make_hotel()
    r = await super_admin_client.patch(f"{PATCH}/{hotel.id}", json={
        "ai_api_key": "gsk_secret_ai_123",
        "ai_model": "llama-3.1-8b-instant",
        "settings": {
            "whatsapp_api_key": "EAA_secret_wa_456",
            "whatsapp_phone_number_id": "123456",
            "brevo_api_key": "xkeysib-secret_789",
        },
    })
    assert r.status_code == 200, r.text
    # Raw secrets must not appear anywhere in the PATCH response.
    assert "gsk_secret_ai_123" not in r.text
    assert "EAA_secret_wa_456" not in r.text
    assert "xkeysib-secret_789" not in r.text

    lr = await super_admin_client.get(PATCH)
    assert lr.status_code == 200
    # Nor anywhere in the (all-hotels) list response.
    assert "gsk_secret_ai_123" not in lr.text
    assert "EAA_secret_wa_456" not in lr.text
    assert "xkeysib-secret_789" not in lr.text

    row = next(h for h in lr.json() if h["id"] == hotel.id)
    assert row["ai_api_key_set"] is True
    assert row["whatsapp_api_key_set"] is True
    assert row["brevo_api_key_set"] is True
    # Non-secret config still surfaces.
    assert row["ai_model"] == "llama-3.1-8b-instant"
    assert row["settings"].get("whatsapp_phone_number_id") == "123456"
    # Secret values/refs are stripped from the returned settings.
    assert "whatsapp_api_key" not in row["settings"]
    assert "brevo_api_key" not in row["settings"]


@pytest.mark.asyncio
async def test_keep_sentinel_preserves_existing_secret(super_admin_client):
    hotel = await _make_hotel()
    # Configure a key first.
    await super_admin_client.patch(f"{PATCH}/{hotel.id}", json={
        "settings": {"whatsapp_api_key": "EAA_keep_me"},
    })
    # Re-save with the KEEP sentinel + change a non-secret field.
    r = await super_admin_client.patch(f"{PATCH}/{hotel.id}", json={
        "ai_api_key": "__KEEP__",
        "settings": {"whatsapp_api_key": "__KEEP__", "whatsapp_phone_number_id": "999"},
    })
    assert r.status_code == 200, r.text

    async with AsyncSession(engine) as s:
        h = await s.get(Hotel, hotel.id)
        stored = (h.settings or {})
        # The secret survives (plaintext fallback on SQLite, or a vault ref).
        assert stored.get("whatsapp_api_key") or stored.get("whatsapp_api_key_vault_id")
        assert stored.get("whatsapp_phone_number_id") == "999"


@pytest.mark.asyncio
async def test_empty_clears_unset_secret_without_error(super_admin_client):
    hotel = await _make_hotel()
    # Saving with blank secrets on a fresh hotel must not error or set anything.
    r = await super_admin_client.patch(f"{PATCH}/{hotel.id}", json={
        "ai_api_key": None,
        "settings": {"whatsapp_api_key": None, "brevo_api_key": None},
    })
    assert r.status_code == 200, r.text
    assert r.json()["ai_api_key_set"] is False
    assert r.json()["whatsapp_api_key_set"] is False
    assert r.json()["brevo_api_key_set"] is False
