"""
Hotels Router
Hotel profile aur settings management.
Multi-tenant - har user apni hotel hi dekh/edit kar sakta hai.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from sqlmodel import select

from app.core.auth.deps import CurrentUser, DbSession, require_hotel_role
from app.brand_console.hotel import Hotel, HotelRead, HotelUpdate
from app.core.auth.sensitive_fields import (
    mask_hotel_for_hotelier,
    strip_sensitive_from_update,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hotels", tags=["Hotels"])


@router.get("/me")
async def get_my_hotel(current_user: CurrentUser, session: DbSession):
    """
    Current user ki hotel get karo.
    Dashboard aur settings page ke liye.

    Sensitive fields (AI keys, WhatsApp tokens, SMTP creds, Brevo key,
    internal quotas) are masked before the response is sent — see
    app.core.auth.sensitive_fields for the policy. Hoteliers see `has_*`
    flags and counters, never the secrets themselves.
    """
    if not current_user.hotel_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hotel associated with this user"
        )

    result = await session.execute(
        select(Hotel).where(Hotel.id == current_user.hotel_id)
    )
    hotel = result.scalar_one_or_none()

    if not hotel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hotel not found"
        )

    # Return a dict (not HotelRead instance) because we have extra
    # `has_*` fields and a masked settings object that the strict
    # HotelRead schema doesn't model. FastAPI + Pydantic v2 accepts
    # the dict for response_model purposes (extra="allow" default).
    return mask_hotel_for_hotelier(hotel)


@router.patch("/me", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_my_hotel(
    hotel_update: HotelUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Current user ki hotel update karo.
    Settings page se hotel details change karne ke liye.

    SECURITY: any attempt to PATCH sensitive fields (AI keys, WhatsApp
    tokens, SMTP/Brevo creds, internal counters, pause state) is
    silently stripped AND logged so we can detect a tampered client.
    """
    if not current_user.hotel_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hotel associated"
        )

    result = await session.execute(
        select(Hotel).where(Hotel.id == current_user.hotel_id)
    )
    hotel = result.scalar_one_or_none()

    if not hotel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hotel not found"
        )

    # Update only provided fields
    raw_update_data = hotel_update.model_dump(exclude_unset=True)

    # Strip sensitive fields. Raises ValueError for read-only fields.
    try:
        update_data, stripped = strip_sensitive_from_update(raw_update_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    if stripped:
        logger.warning(
            "Hotelier %s attempted to PATCH sensitive fields on hotel %s: %s",
            current_user.email, current_user.hotel_id, sorted(stripped),
        )

    # Save old slug BEFORE update so we can bust its cache key after commit
    old_slug = hotel.slug

    if "slug" in update_data and update_data["slug"]:
        new_slug = update_data["slug"].lower().strip()
        if new_slug != hotel.slug:
            existing = await session.execute(select(Hotel).where(Hotel.slug == new_slug))
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This URL Slug is already taken by another hotel property"
                )
            update_data["slug"] = new_slug

    for field, value in update_data.items():
        setattr(hotel, field, value)

    from datetime import datetime
    hotel.updated_at = datetime.utcnow()

    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)

    try:
        from app.core.cache.redis_client import redis_client
        from app.calendar import clear_availability_cache
        # Bust both old and new slug — covers slug-change scenario
        for slug in {old_slug, hotel.slug}:
            redis_client.delete_key(f"public:slug-to-id:{slug}")
            redis_client.delete_key(f"public:social-proof:{slug}")
        redis_client.delete_key(f"public:hotel-details:{hotel.id}")
        redis_client.delete_key(f"public:widget-config:{hotel.id}")
        redis_client.delete_key(f"public:slug-to-id:{hotel.id}")
        clear_availability_cache(hotel.id)
    except Exception:
        pass

    return mask_hotel_for_hotelier(hotel)



from pydantic import BaseModel
class TestEmailRequest(BaseModel):
    settings: dict
    test_email: str

@router.post("/{hotel_id}/test-email-connection")
async def test_email_connection(
    hotel_id: str,
    request: TestEmailRequest,
    current_user: CurrentUser,
    session: DbSession,
):
    if hotel_id != current_user.hotel_id and current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only test email settings for your own property",
        )
    # Validate test_email is a reasonable email address (basic check)
    test_email = request.test_email.strip()
    if "@" not in test_email or len(test_email) > 254:
        raise HTTPException(status_code=400, detail="Invalid test email address")

    # SECURITY: Never use client-supplied SMTP settings directly — that allows
    # open relay and SSRF. Load the hotel's own stored settings from the DB.
    from app.integration.integration import IntegrationSettings
    from sqlmodel import select as sql_select
    stored = (await session.execute(
        sql_select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
    )).scalar_one_or_none()
    if not stored:
        raise HTTPException(status_code=404, detail="Integration settings not found. Save your SMTP settings first.")

    from app.core.auth.vault import resolve_settings_secrets
    hotel_settings = await resolve_settings_secrets(stored, session)

    try:
        from app.services.email_service import EmailService
        email_svc = EmailService()
        html_content = "<html><body><h2>Test Connection Successful!</h2><p>Your email settings are working correctly.</p></body></html>"
        success = await email_svc._dispatch_hotel_email(
            hotel_settings=hotel_settings,
            to_emails=[test_email],
            subject="Test Email Connection - StayBooker",
            html_content=html_content,
        )
        if success:
            return {"status": "success", "message": "Test email sent successfully"}
        raise HTTPException(status_code=400, detail="Failed to send test email. Check your SMTP credentials.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("test-email-connection failed for hotel %s", hotel_id)
        raise HTTPException(status_code=500, detail="Email test failed. Check your SMTP settings.")


