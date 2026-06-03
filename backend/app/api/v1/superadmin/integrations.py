"""
Super Admin — Per-hotel integration credentials (AI, WhatsApp, Email, pause state).
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import DbSession
from app.models.audit import AuditLog
from app.models.hotel import Hotel
from app.models.user import User
from .hotels import get_super_admin

logger = logging.getLogger(__name__)
router = APIRouter()


class HotelIntegrationsRead(BaseModel):
    hotel_id: str
    hotel_name: str
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key_preview: Optional[str] = None
    has_ai_api_key: bool = False
    has_whatsapp_api_key: bool = False
    whatsapp_api_key_preview: Optional[str] = None
    has_whatsapp_phone_id: bool = False
    has_whatsapp_business_id: bool = False
    has_brevo_key: bool = False
    brevo_key_preview: Optional[str] = None
    has_smtp_password: bool = False
    has_smtp_config: bool = False
    smtp_host: Optional[str] = None
    smtp_from_email: Optional[str] = None
    ai_whatsapp_credits: int = 0
    total_messages_sent: int = 0
    is_paused: bool = False
    pause_reason: Optional[str] = None
    paused_at: Optional[datetime] = None
    feature_ai_agent: bool = False
    feature_guest_bot: bool = False
    feature_ai_assistant: bool = False


class HotelIntegrationsUpdate(BaseModel):
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    whatsapp_api_key: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None
    brevo_api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    ai_whatsapp_credits: Optional[int] = None
    is_paused: Optional[bool] = None
    pause_reason: Optional[str] = None
    feature_ai_agent: Optional[bool] = None
    feature_guest_bot: Optional[bool] = None
    feature_ai_assistant: Optional[bool] = None


def _preview_secret(value: Optional[str]) -> Optional[str]:
    """Return a 4-char tail preview so admins can verify a key without seeing it."""
    if not value or not isinstance(value, str):
        return None
    return f"…{value[-4:]}" if len(value) > 4 else "•" * len(value)


@router.get("/hotels/{hotel_id}/integrations", response_model=HotelIntegrationsRead)
async def get_hotel_integrations(
    hotel_id: str,
    super_admin: User = Depends(get_super_admin),
    session: DbSession = None,
):
    """Read all integration credentials for a hotel (secrets masked)."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")

    from app.models.integration import IntegrationSettings
    int_settings = (await session.execute(
        select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
    )).scalar_one_or_none()

    s = hotel.settings if isinstance(hotel.settings, dict) else {}
    ai_key = int_settings.ai_api_key if int_settings else hotel.ai_api_key
    return HotelIntegrationsRead(
        hotel_id=hotel.id, hotel_name=hotel.name,
        ai_provider=int_settings.ai_provider if int_settings else hotel.ai_provider,
        ai_model=int_settings.ai_model if int_settings else hotel.ai_model,
        ai_base_url=int_settings.ai_base_url if int_settings else hotel.ai_base_url,
        ai_api_key_preview=_preview_secret(ai_key),
        has_ai_api_key=bool(ai_key),
        has_whatsapp_api_key=bool(s.get("whatsapp_api_key")),
        whatsapp_api_key_preview=_preview_secret(s.get("whatsapp_api_key")),
        has_whatsapp_phone_id=bool(s.get("whatsapp_phone_number_id")),
        has_whatsapp_business_id=bool(s.get("whatsapp_business_account_id")),
        has_brevo_key=bool(s.get("brevo_api_key")),
        brevo_key_preview=_preview_secret(s.get("brevo_api_key")),
        has_smtp_password=bool(s.get("smtp_password")),
        has_smtp_config=bool(s.get("smtp_host") and s.get("smtp_username")),
        smtp_host=s.get("smtp_host"),
        smtp_from_email=s.get("smtp_from_email"),
        ai_whatsapp_credits=int(s.get("ai_whatsapp_credits", 0) or 0),
        total_messages_sent=int(s.get("total_messages_sent", 0) or 0),
        is_paused=hotel.is_paused,
        pause_reason=hotel.pause_reason,
        paused_at=hotel.paused_at,
        feature_ai_agent=hotel.feature_ai_agent,
        feature_guest_bot=hotel.feature_guest_bot,
        feature_ai_assistant=hotel.feature_ai_assistant,
    )


@router.put("/hotels/{hotel_id}/integrations")
async def update_hotel_integrations(
    hotel_id: str,
    payload: HotelIntegrationsUpdate,
    super_admin: User = Depends(get_super_admin),
    session: DbSession = None,
):
    """Update hotel integration credentials. Empty string = clear field."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")

    updated: list[str] = []

    for field in ("ai_provider", "ai_model", "feature_ai_agent", "feature_guest_bot", "feature_ai_assistant"):
        val = getattr(payload, field)
        if val is not None:
            setattr(hotel, field, val)
            updated.append(field)

    if payload.ai_base_url is not None:
        hotel.ai_base_url = payload.ai_base_url or None
        updated.append("ai_base_url")
    if payload.ai_api_key is not None:
        hotel.ai_api_key = payload.ai_api_key or None
        updated.append("ai_api_key")
    if payload.is_paused is not None:
        from app.core.feature_flags import set_pause
        set_pause(hotel, payload.is_paused, payload.pause_reason)
        updated.append("is_paused")
    elif payload.pause_reason is not None:
        hotel.pause_reason = payload.pause_reason or None
        updated.append("pause_reason")

    settings = dict(hotel.settings) if isinstance(hotel.settings, dict) else {}
    changed = False
    for json_field in (
        "whatsapp_api_key", "whatsapp_phone_number_id", "whatsapp_business_account_id",
        "brevo_api_key", "smtp_host", "smtp_username", "smtp_password",
        "smtp_from_email", "ai_whatsapp_credits",
    ):
        val = getattr(payload, json_field, None)
        if val is None:
            continue
        settings[json_field] = val or None
        changed = True
        updated.append(json_field)
    if payload.smtp_port is not None:
        settings["smtp_port"] = payload.smtp_port
        changed = True
        updated.append("smtp_port")
    if changed:
        hotel.settings = settings

    from app.core.time import utcnow
    hotel.updated_at = utcnow()
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)

    try:
        from app.core.redis_client import redis_client
        for key in (f"public:hotel-details:{hotel.id}", f"public:widget-config:{hotel.id}",
                    f"public:slug-to-id:{hotel.slug}", f"public:social-proof:{hotel.slug}"):
            redis_client.delete_key(key)
    except Exception:
        pass

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="UPDATE_HOTEL_INTEGRATIONS",
        description=f"Updated {len(updated)} integration field(s) for hotel {hotel.name}: {', '.join(updated)}",
        ip_address="127.0.0.1",
    ))
    await session.commit()
    return {"status": "success", "message": f"Updated {len(updated)} field(s) for {hotel.name}", "fields_updated": updated}
