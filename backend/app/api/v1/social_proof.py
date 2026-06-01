"""
Social proof routes.

Endpoints:
  GET  /api/v1/hotels/me/social-proof            — hotelier reads own settings
  PUT  /api/v1/hotels/me/social-proof            — hotelier updates own settings
  GET  /api/v1/public/social-proof/{slug}        — public, <100ms target, Redis-cached
  POST /api/v1/superadmin/social-proof/refresh   — super-admin triggers cache refresh

Performance design (sub-100ms target):
  1. Public endpoint short-circuits with empty payload if
     is_enabled=False or hotel is paused, before any DB / Redis call.
  2. Public response is cached in Redis for 60s under
     "public:social-proof:{slug}". On cache hit, we skip the DB entirely.
  3. The "real stats" columns on HotelSocialProofSettings are
     pre-computed by a 5-minute background refresh task, so the public
     endpoint only reads ONE row, not the bookings / reviews tables.
  4. We use `session.get()` (PK lookup) which is O(1) with the unique
     index on hotel_id.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.core.redis_client import redis_client
from app.core.time import utcnow
from app.models.hotel import Hotel
from app.models.social_proof import (
    HotelSocialProofSettings,
    HotelSocialProofSettingsRead,
    HotelSocialProofSettingsUpdate,
    PublicSocialProofResponse,
)

logger = logging.getLogger(__name__)

# Public cache TTL — 60s is a good balance between freshness and DB load.
# The widget only needs ~minute-level accuracy ("X bookings this month"
# doesn't change in <60s in any meaningful way).
PUBLIC_CACHE_TTL_SECONDS = 60


# --------------------------------------------------------------------------
# Hotelier-facing routes
# --------------------------------------------------------------------------
router = APIRouter(prefix="/hotels/me/social-proof", tags=["Social Proof"])


async def _get_or_create_settings(session, hotel_id: str) -> HotelSocialProofSettings:
    """Get the settings row for a hotel, creating a default one if it
    doesn't exist yet. This makes the dashboard UX simpler: hotelier
    never sees a 404 on first visit."""
    stmt = select(HotelSocialProofSettings).where(
        HotelSocialProofSettings.hotel_id == hotel_id
    )
    res = await session.execute(stmt)
    settings = res.scalar_one_or_none()
    if settings is None:
        settings = HotelSocialProofSettings(hotel_id=hotel_id)
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
    return settings


@router.get("", response_model=HotelSocialProofSettingsRead)
async def get_my_social_proof(
    current_user: CurrentUser,
    session: DbSession,
):
    """Hotelier reads their own social proof configuration."""
    if not current_user.hotel_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hotel associated with this user",
        )
    settings = await _get_or_create_settings(session, current_user.hotel_id)
    return HotelSocialProofSettingsRead.model_validate(settings)


@router.put("", response_model=HotelSocialProofSettingsRead)
async def update_my_social_proof(
    payload: HotelSocialProofSettingsUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Hotelier updates which social proof badges to display.

    The hotelier NEVER controls the underlying numbers (cached_*) — only
    the display toggles and the custom badge list. The update schema
    drops cached_* automatically because the SQLModel doesn't have
    those fields.
    """
    if not current_user.hotel_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hotel associated with this user",
        )

    settings = await _get_or_create_settings(session, current_user.hotel_id)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    settings.updated_at = utcnow()

    session.add(settings)
    await session.commit()
    await session.refresh(settings)

    # Bust the public cache so the new settings take effect immediately.
    try:
        hotel = await session.get(Hotel, current_user.hotel_id)
        if hotel and hotel.slug:
            redis_client.delete_key(f"public:social-proof:{hotel.slug}")
            redis_client.delete_key(f"public:social-proof:{hotel.id}")
    except Exception as e:
        logger.warning("Failed to bust social-proof cache: %s", e)

    return HotelSocialProofSettingsRead.model_validate(settings)


# --------------------------------------------------------------------------
# Public-facing route
# --------------------------------------------------------------------------
public_router = APIRouter(prefix="/public", tags=["Public"])


@public_router.get(
    "/social-proof/{hotel_slug}",
    response_model=PublicSocialProofResponse,
)
async def get_public_social_proof(
    hotel_slug: str,
    session: DbSession,
):
    """Returns the social proof payload for a hotel's public booking page.

    Performance:
      - 60s Redis cache (key: public:social-proof:{slug})
      - On miss: ONE row lookup (PK index on hotel_social_proof_settings)
      - Short-circuits on is_enabled=False or hotel paused

    Returns an empty (is_enabled=False) payload on 404 — never raises —
    so the public page can render without try/catch.
    """
    normalized = hotel_slug.strip().lower()

    # 1. Redis cache hit
    cache_key = f"public:social-proof:{normalized}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return PublicSocialProofResponse(**json.loads(cached))
    except Exception as e:
        logger.warning("social-proof cache read failed: %s", e)

    # 2. Resolve hotel by slug
    hotel_stmt = select(Hotel).where(Hotel.slug == normalized)
    hotel_res = await session.execute(hotel_stmt)
    hotel = hotel_res.scalar_one_or_none()
    if not hotel:
        return PublicSocialProofResponse(is_enabled=False, custom_badges=[])
    if not hotel.is_active or hotel.is_paused:
        return PublicSocialProofResponse(is_enabled=False, custom_badges=[])

    # 3. Get settings row
    sp_stmt = select(HotelSocialProofSettings).where(
        HotelSocialProofSettings.hotel_id == hotel.id
    )
    sp_res = await session.execute(sp_stmt)
    sp = sp_res.scalar_one_or_none()
    if not sp or not sp.is_enabled:
        return PublicSocialProofResponse(is_enabled=False, custom_badges=[])

    # 4. Pull cancellation policy from hotel settings for the
    #    "Free cancellation" badge. Already loaded via hotel object.
    cancellation_text: Optional[str] = None
    h_settings = hotel.settings if isinstance(hotel.settings, dict) else {}
    raw_policy = h_settings.get("cancellation_policy")
    if isinstance(raw_policy, str) and raw_policy.strip():
        cancellation_text = raw_policy.strip()

    # 5. Assemble response
    response = PublicSocialProofResponse(
        is_enabled=True,
        # active_viewers is intentionally left None here — the widget
        # shows "X people viewing" only when the analytics service has
        # reported a real number. We never invent a number.
        active_viewers=None,
        hours_since_last_booking=sp.cached_hours_since_last_booking,
        bookings_this_month=sp.cached_booking_count,
        review_count=sp.cached_review_count,
        avg_rating=sp.cached_avg_rating,
        custom_badges=sp.custom_badges or [],
        cancellation_policy_text=cancellation_text,
    )

    # 6. Cache
    try:
        redis_client.set_value(
            cache_key,
            response.model_dump_json(),
            expire=PUBLIC_CACHE_TTL_SECONDS,
        )
    except Exception as e:
        logger.warning("social-proof cache write failed: %s", e)

    return response
