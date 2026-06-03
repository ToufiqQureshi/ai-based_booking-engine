"""
Super Admin — Hotel management: list, update, delete, impersonate, social proof.
"""
import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.models.audit import AuditLog
from app.models.hotel import Hotel, HotelUpdate
from app.models.subscription import Subscription
from app.models.user import User, UserRole
import jwt

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting Railway/proxy forwarding headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")

PLAN_FEATURES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "core", "plan_features.json",
)


async def get_super_admin(current_user: CurrentUser):
    """Only Staybooker employees with SUPER_ADMIN role can access these endpoints."""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Staybooker staff only",
        )
    return current_user


def load_plan_features() -> dict:
    try:
        with open(PLAN_FEATURES_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error("Failed to load plan features from %s: %s", PLAN_FEATURES_PATH, e)
        raise HTTPException(status_code=500, detail="Plan features configuration error")


def save_plan_features(data: dict) -> bool:
    try:
        with open(PLAN_FEATURES_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception:
        return False


DEFAULT_ROLE_PERMISSIONS = {
    "OWNER": [
        "/dashboard", "/analytics", "/agent", "/rooms", "/rates", "/rate-shopper",
        "/availability", "/bookings", "/guests", "/payments", "/addons", "/amenities",
        "/channel-settings", "/integration", "/settings",
    ],
    "MANAGER": [
        "/dashboard", "/analytics", "/rooms", "/rates", "/amenities",
        "/availability", "/bookings", "/guests", "/payments", "/settings",
    ],
    "STAFF": ["/availability", "/bookings", "/guests"],
}


@router.get("/hotels", response_model=List[dict])
async def list_hotels(session: DbSession, super_admin: User = Depends(get_super_admin)):
    """List all hotels with owner and subscription details."""
    hotels = (await session.execute(select(Hotel))).scalars().all()
    if not hotels:
        return []

    hotel_ids = [h.id for h in hotels]

    # Batch fetch owners — 1 query instead of N
    owners_res = await session.execute(
        select(User).where(User.hotel_id.in_(hotel_ids), User.role == UserRole.OWNER)
    )
    owners_map: dict[str, User] = {u.hotel_id: u for u in owners_res.scalars().all()}

    # Batch fetch subscriptions — 1 query instead of N
    subs_res = await session.execute(
        select(Subscription).where(Subscription.hotel_id.in_(hotel_ids))
    )
    subs_map: dict[str, Subscription] = {s.hotel_id: s for s in subs_res.scalars().all()}

    final_result = []
    for hotel in hotels:
        owner = owners_map.get(hotel.id)
        sub = subs_map.get(hotel.id)
        settings_dict = hotel.settings or {}
        final_result.append({
            "id": hotel.id,
            "name": hotel.name,
            "slug": hotel.slug,
            "is_active": hotel.is_active,
            "is_paused": hotel.is_paused,
            "pause_reason": hotel.pause_reason,
            "settings": settings_dict,
            "owner_email": owner.email if owner else "N/A",
            "owner_name": owner.name if owner else "N/A",
            "feature_ai_agent": hotel.feature_ai_agent,
            "feature_guest_bot": hotel.feature_guest_bot,
            "feature_rate_shopper": hotel.feature_rate_shopper,
            "feature_new_booking": getattr(hotel, "feature_new_booking", True),
            "feature_color_palette": getattr(hotel, "feature_color_palette", True),
            "feature_custom_logo": getattr(hotel, "feature_custom_logo", True),
            "feature_custom_widget": getattr(hotel, "feature_custom_widget", True),
            "role_permissions": settings_dict.get("role_permissions", DEFAULT_ROLE_PERMISSIONS),
            "subscription": {
                "plan": sub.plan_name if sub else "None",
                "status": sub.status if sub else "inactive",
                "end_date": sub.end_date.isoformat() if sub and sub.end_date else None,
                "whatsapp_credits": sub.whatsapp_credits if sub else 1000,
                "sms_credits": sub.sms_credits if sub else 1000,
                "ai_usage_limit": sub.ai_usage_limit if sub else 50000,
            },
        })
    return final_result


@router.patch("/hotels/{hotel_id}/permissions")
async def update_role_permissions(
    hotel_id: str, permissions: dict, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    settings_dict = dict(hotel.settings or {})
    settings_dict["role_permissions"] = permissions
    hotel.settings = settings_dict
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)
    await session.commit()
    return {"message": "Permissions updated successfully", "role_permissions": permissions}


@router.patch("/hotels/{hotel_id}")
async def update_hotel_status(
    hotel_id: str, update_data: HotelUpdate, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Update hotel feature flags, slug, or active status."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    db_data = update_data.model_dump(exclude_unset=True)
    if "slug" in db_data and db_data["slug"]:
        new_slug = db_data["slug"].lower().strip()
        if new_slug != hotel.slug:
            if (await session.execute(select(Hotel).where(Hotel.slug == new_slug))).scalar_one_or_none():
                raise HTTPException(status_code=400, detail="This URL Slug is already taken")
            db_data["slug"] = new_slug
    for key, value in db_data.items():
        setattr(hotel, key, value)
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)
    return hotel


@router.delete("/hotels/{hotel_id}")
async def delete_hotel(
    hotel_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Permanently delete a hotel and all associated data."""
    from sqlalchemy import text
    from app.core.supabase import get_supabase

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    users_to_delete = (await session.execute(select(User).where(User.hotel_id == hotel_id))).scalars().all()

    deep_queries = [
        "DELETE FROM competitor_rates WHERE competitor_id IN (SELECT id FROM competitors WHERE hotel_id = :id)",
        "DELETE FROM analytics_events WHERE session_id IN (SELECT id FROM analytics_sessions WHERE hotel_id = :id)",
        "DELETE FROM room_amenity_links WHERE room_id IN (SELECT id FROM room_types WHERE hotel_id = :id)",
        "DELETE FROM booking_timeline WHERE booking_id IN (SELECT id FROM bookings WHERE hotel_id = :id)",
        "DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE hotel_id = :id)",
        "DELETE FROM payments WHERE hotel_id = :id",
    ]
    tables = [
        "channel_logs", "channel_room_mappings", "room_rates", "room_blocks", "room_rate_links",
        "bookings", "guests", "rate_plans", "room_types", "competitors", "analytics_sessions",
        "addons", "amenities", "api_keys", "channel_manager_settings",
        "integration_settings", "leads", "promo_codes", "user_hotel_links", "subscriptions",
    ]
    for q in deep_queries:
        try:
            async with session.begin_nested():
                await session.execute(text(q), {"id": hotel_id})
        except Exception as e:
            logger.warning("Deep cleanup failed: %s", e)
    for table in tables:
        try:
            async with session.begin_nested():
                await session.execute(text(f"DELETE FROM {table} WHERE hotel_id = :id"), {"id": hotel_id})
        except Exception as e:
            logger.warning("Failed to delete from %s: %s", table, e)
    try:
        async with session.begin_nested():
            await session.execute(text("DELETE FROM audit_logs WHERE hotel_id = :id"), {"id": hotel_id})
    except Exception as e:
        logger.warning("Failed to delete audit logs: %s", e)

    supabase_admin = get_supabase()
    for u in users_to_delete:
        if u.supabase_id:
            try:
                supabase_admin.auth.admin.delete_user(u.supabase_id)
            except Exception as e:
                logger.warning("Could not delete auth user %s: %s", u.supabase_id, e)
        try:
            async with session.begin_nested():
                await session.delete(u)
        except Exception as e:
            logger.error("Failed to delete user %s: %s", u.email, e)

    try:
        await session.delete(hotel)
        session.add(AuditLog(
            user_id=super_admin.id, user_email=super_admin.email,
            action="DELETE_HOTEL",
            description=f"Permanently deleted hotel '{hotel.name}' (Slug: {hotel.slug})",
            ip_address=_get_client_ip(request),
        ))
        await session.commit()
        return {"message": "Hotel and all associated data deleted successfully"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete hotel: {str(e)}")


@router.post("/impersonate/{hotel_id}")
async def impersonate_hotel(
    hotel_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Generate a login token to access a hotel as its owner."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    users = (await session.execute(
        select(User).where(User.hotel_id == hotel_id, User.is_active == True)
    )).scalars().all()
    if not users:
        raise HTTPException(status_code=400, detail="No active users found for this hotel")

    target_user = next((u for u in users if u.role == UserRole.OWNER), users[0])
    settings = get_settings()
    secret = settings.SUPABASE_JWT_SECRET or settings.SECRET_KEY
    payload = {
        "sub": target_user.supabase_id or target_user.id,
        "email": target_user.email,
        "role": target_user.role.value if hasattr(target_user.role, "value") else str(target_user.role),
        "type": "access",
        "user_metadata": {"name": target_user.name, "hotel_name": hotel.name, "impersonated_by": super_admin.email},
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="IMPERSONATE",
        description=f"Super admin impersonated hotel '{hotel.name}' via user '{target_user.email}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"access_token": token, "token_type": "Bearer", "target_email": target_user.email, "target_name": target_user.name, "hotel_name": hotel.name}


@router.post("/social-proof/refresh")
async def refresh_social_proof_stats(
    request: Request,
    session: DbSession,
    hotel_id: Optional[str] = None,
    super_admin: User = Depends(get_super_admin),
):
    """Recompute social proof cache for one or all hotels."""
    from app.core.social_proof_refresh import refresh_all_social_proof_stats, refresh_one_hotel_now

    if hotel_id:
        ok = await refresh_one_hotel_now(session, hotel_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Hotel not found")
        session.add(AuditLog(
            user_id=super_admin.id, user_email=super_admin.email,
            action="REFRESH_SOCIAL_PROOF",
            description=f"Refreshed social proof cache for hotel {hotel_id}",
            ip_address=_get_client_ip(request),
        ))
        await session.commit()
        return {"status": "success", "hotel_id": hotel_id}

    summary = await refresh_all_social_proof_stats(session)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="REFRESH_SOCIAL_PROOF_ALL",
        description=f"Refreshed social proof cache for {summary['hotels_total']} hotels",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"status": "success", **summary}
