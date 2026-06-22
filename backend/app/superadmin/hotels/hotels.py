"""
Super Admin — Hotel management: list, update, delete, impersonate, social proof.
"""
import json
import logging
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlmodel import select

from app.core.auth.deps import CurrentUser, DbSession
from app.core.auth.vault import store_settings_secret, store_column_secret
from app.core.utils.config import get_settings
from app.system.audit import AuditLog
from app.brand_console.hotel import Hotel, HotelUpdate
from app.superadmin.subscriptions.subscription import Subscription
from app.guests.user import User, UserRole
import jwt

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_client_ip(request: Request) -> str:
    """Extract real client IP, respecting Railway/proxy forwarding headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")

# __file__ = backend/app/superadmin/hotels/hotels.py
#   dirname x3 -> backend/app, then join core/plan_features.json.
# (Previously had a 4th dirname resolving to backend/core/... which does not
# exist, so every subscription / plan-feature load raised FileNotFoundError and
# returned 500.)
PLAN_FEATURES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "core", "utils", "plan_features.json",
)


async def get_super_admin(current_user: CurrentUser):
    """Only Staybooker employees with SUPER_ADMIN role can access these endpoints."""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Staybooker staff only",
        )
    return current_user


async def get_effective_permissions(user: User, session) -> dict:
    """Resolve a super admin's effective sub-role and permission list.

    Founders / platform owners have no SuperAdminRole record and get full
    ("*") access — this keeps existing super admins unrestricted. Employees
    granted a limited sub-role (finance/support/ops/viewer) are confined to
    that tier's permissions.
    """
    from app.superadmin.platform.platform_model import SuperAdminRole

    role = (await session.execute(
        select(SuperAdminRole).where(SuperAdminRole.user_id == user.id)
    )).scalar_one_or_none()

    if not role or not role.is_active:
        return {"tier": "owner", "permissions": ["*"], "is_owner": True}

    perms = role.permissions or []
    is_owner = role.role_tier == "owner" or "*" in perms
    return {"tier": role.role_tier, "permissions": perms, "is_owner": is_owner}


def permission_granted(permissions: list[str], required: str) -> bool:
    """Check if a permission list satisfies a required permission.

    Supports full wildcard ("*"), exact match, and category wildcards such
    as "superadmin.hotels.*" granting "superadmin.hotels.read".
    """
    if not required:
        return True
    if "*" in permissions or required in permissions:
        return True
    parts = required.split(".")
    for i in range(len(parts) - 1, 0, -1):
        if ".".join(parts[:i] + ["*"]) in permissions:
            return True
    return False


def require_permission(required: str):
    """Dependency factory: enforce a specific super-admin permission."""
    async def _checker(
        session: DbSession,
        super_admin: User = Depends(get_super_admin),
    ) -> User:
        eff = await get_effective_permissions(super_admin, session)
        if not permission_granted(eff["permissions"], required):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your admin role does not permit this action ({required})",
            )
        return super_admin
    return _checker


@router.get("/me/access")
async def my_access(session: DbSession, super_admin: User = Depends(get_super_admin)):
    """Return the current admin's effective sub-role + allowed nav tabs.

    The frontend uses this to hide tabs an employee should not see.
    """
    from app.superadmin.platform.platform_model import TAB_PERMISSIONS

    eff = await get_effective_permissions(super_admin, session)
    allowed_tabs = [
        tab for tab, perm in TAB_PERMISSIONS.items()
        if permission_granted(eff["permissions"], perm)
    ]
    return {**eff, "allowed_tabs": allowed_tabs}


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
        "/dashboard", "/analytics", "/agent", "/rooms", "/rates",
        "/availability", "/bookings", "/guests", "/payments", "/addons", "/amenities",
        "/channel-settings", "/integration", "/settings",
    ],
    "MANAGER": [
        "/dashboard", "/analytics", "/rooms", "/rates", "/amenities",
        "/availability", "/bookings", "/guests", "/payments", "/settings",
    ],
    "STAFF": ["/availability", "/bookings", "/guests"],
}

# hotel.settings keys whose values are secrets (or vault references to secrets).
# These are stripped from any settings payload returned to the client.
_SECRET_RESPONSE_KEYS = {
    "whatsapp_api_key", "whatsapp_api_key_vault_id",
    "brevo_api_key",
    "smtp_password", "smtp_password_vault_id",
    "razorpay_key_secret", "razorpay_key_secret_vault_id",
    "ai_api_key", "ai_api_key_vault_id",
}

# Secret fields written via the super-admin integrations form. When the client
# sends this sentinel it means "leave the stored secret unchanged" (the form
# never receives the real value, so a blank submit must not wipe it).
#
# A blank/None value is *also* treated as "keep" — the integrations form has no
# dedicated "clear secret" control, so an empty field always means the admin
# simply didn't re-type the secret. Wiping a configured key on a blank submit
# is the bug that silently blanked stored SMTP/Brevo credentials and made
# booking emails fall back to the platform default sender. To intentionally
# remove a secret the client must send the explicit CLEAR sentinel.
SECRET_KEEP_SENTINEL = "__KEEP__"
SECRET_CLEAR_SENTINEL = "__CLEAR__"
_SETTINGS_SECRET_FIELDS = {"whatsapp_api_key", "brevo_api_key", "smtp_password", "razorpay_key_secret"}


@router.get("/hotels", response_model=List[dict])
async def list_hotels(session: DbSession, super_admin: User = Depends(require_permission("superadmin.hotels.read"))):
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
        # Never ship raw secrets to the client (even to a super admin). Strip the
        # plaintext keys + their vault references from the settings copy we return,
        # and expose only booleans saying whether each integration is configured.
        safe_settings = {k: v for k, v in settings_dict.items() if k not in _SECRET_RESPONSE_KEYS}
        safe_settings["has_smtp_password"] = bool(settings_dict.get("smtp_password") or settings_dict.get("smtp_password_vault_id"))
        safe_settings["has_razorpay_secret"] = bool(settings_dict.get("razorpay_key_secret") or settings_dict.get("razorpay_key_secret_vault_id"))
        final_result.append({
            "id": hotel.id,
            "name": hotel.name,
            "slug": hotel.slug,
            "is_active": hotel.is_active,
            "is_paused": hotel.is_paused,
            "pause_reason": hotel.pause_reason,
            "settings": safe_settings,
            "owner_email": owner.email if owner else "N/A",
            "owner_name": owner.name if owner else "N/A",
            # Non-secret AI config is safe to send; the key itself is never returned.
            "ai_provider": getattr(hotel, "ai_provider", "groq"),
            "ai_model": getattr(hotel, "ai_model", "llama-3.1-70b-versatile"),
            "ai_base_url": getattr(hotel, "ai_base_url", None),
            "ai_max_tokens": getattr(hotel, "ai_max_tokens", None),
            # "<secret>_set" flags so the UI can show "configured" without the value.
            "ai_api_key_set": bool(getattr(hotel, "ai_api_key", None) or getattr(hotel, "ai_api_key_vault_id", None)),
            "whatsapp_api_key_set": bool(settings_dict.get("whatsapp_api_key") or settings_dict.get("whatsapp_api_key_vault_id")),
            "brevo_api_key_set": bool(settings_dict.get("brevo_api_key")),
            "feature_ai_agent": hotel.feature_ai_agent,
            "feature_guest_bot": hotel.feature_guest_bot,
            "feature_new_booking": getattr(hotel, "feature_new_booking", True),
            "feature_color_palette": getattr(hotel, "feature_color_palette", True),
            "feature_custom_logo": getattr(hotel, "feature_custom_logo", True),
            "feature_custom_widget": getattr(hotel, "feature_custom_widget", True),
            "feature_google_ads": getattr(hotel, "feature_google_ads", False),
            "feature_ai_assistant": getattr(hotel, "feature_ai_assistant", False),
            "role_permissions": settings_dict.get("role_permissions", DEFAULT_ROLE_PERMISSIONS),
            "subscription": {
                "plan": sub.plan_name if sub else "None",
                "status": sub.status if sub else "inactive",
                "end_date": sub.end_date.isoformat() if sub and sub.end_date else None,
                "whatsapp_credits": sub.whatsapp_credits if sub else 1000,
                "sms_credits": sub.sms_credits if sub else 1000,
                "ai_hotelier_daily_limit": sub.ai_hotelier_daily_limit if sub else 50000,
                "ai_guest_chat_daily_limit": sub.ai_guest_chat_daily_limit if sub else 100000,
                "ai_whatsapp_daily_limit": sub.ai_whatsapp_daily_limit if sub else 100000,
            },
        })
    return final_result


@router.patch("/hotels/{hotel_id}/permissions")
async def update_role_permissions(
    hotel_id: str, permissions: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
):
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    settings_dict = dict(hotel.settings or {})
    settings_dict["role_permissions"] = permissions
    hotel.settings = settings_dict
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="UPDATE_ROLE_PERMISSIONS",
        description=f"Updated role permission configuration for hotel '{hotel.name}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "Permissions updated successfully", "role_permissions": permissions}


@router.patch("/hotels/{hotel_id}")
async def update_hotel_status(
    hotel_id: str, update_data: HotelUpdate, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
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
            
    # ── Secrets: store via Vault (encrypted), never plain setattr/merge. Pop
    #    them out of db_data so the generic loop below handles only non-secrets.
    #    A SECRET_KEEP_SENTINEL value means "unchanged" — the form never sees the
    #    real secret, so a blank/sentinel submit must not wipe it. ──
    secret_changes = []

    if "ai_api_key" in db_data:
        ai_key_val = db_data.pop("ai_api_key")
        if ai_key_val == SECRET_CLEAR_SENTINEL:
            await store_column_secret(
                session, hotel, "ai_api_key", "ai_api_key_vault_id",
                None, f"hotel_{hotel_id}_ai_api_key",
            )
            secret_changes.append("ai_api_key")
        elif ai_key_val == SECRET_KEEP_SENTINEL or not ai_key_val:
            pass  # blank or KEEP — leave the stored secret untouched
        else:
            await store_column_secret(
                session, hotel, "ai_api_key", "ai_api_key_vault_id",
                ai_key_val, f"hotel_{hotel_id}_ai_api_key",
            )
            secret_changes.append("ai_api_key")

    if "settings" in db_data and isinstance(db_data["settings"], dict):
        incoming = db_data.pop("settings")
        merged = dict(hotel.settings or {})
        for k, v in incoming.items():
            if k in _SETTINGS_SECRET_FIELDS:
                if v == SECRET_CLEAR_SENTINEL:
                    merged = await store_settings_secret(session, merged, k, None, hotel_id)
                    secret_changes.append(k)
                elif v == SECRET_KEEP_SENTINEL or not v:
                    # Blank or KEEP — never wipe a stored secret. The form never
                    # receives the real value, so an empty field means "unchanged".
                    continue
                else:
                    merged = await store_settings_secret(session, merged, k, v, hotel_id)
                    secret_changes.append(k)
            else:
                merged[k] = v  # non-secret settings: shallow-merge as before
        hotel.settings = merged

    changes = []
    for key, value in db_data.items():
        old_val = getattr(hotel, key, None)
        if old_val != value:
            changes.append(f"{key}: {old_val} -> {value}")

    for key, value in db_data.items():
        setattr(hotel, key, value)
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)

    # Audit secret updates by field name only — never the value.
    all_changes = changes + [f"{k}: <updated>" for k in secret_changes]
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="UPDATE_HOTEL",
        description=f"Updated hotel '{hotel.name}': {', '.join(all_changes)}" if all_changes else f"Updated hotel '{hotel.name}' status/settings",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(hotel)
    # Return the hotel but strip secrets: the raw model would leak the AI key and
    # any settings secret. Keep all non-secret fields (feature flags, etc.) so
    # existing callers are unaffected; expose only "<key>_set" booleans.
    h_settings = hotel.settings or {}
    data = hotel.model_dump()
    data.pop("ai_api_key", None)
    data.pop("ai_api_key_vault_id", None)
    data["settings"] = {k: v for k, v in h_settings.items() if k not in _SECRET_RESPONSE_KEYS}
    data["settings"]["has_smtp_password"] = bool(h_settings.get("smtp_password") or h_settings.get("smtp_password_vault_id"))
    data["settings"]["has_razorpay_secret"] = bool(h_settings.get("razorpay_key_secret") or h_settings.get("razorpay_key_secret_vault_id"))
    data["ai_api_key_set"] = bool(hotel.ai_api_key or getattr(hotel, "ai_api_key_vault_id", None))
    data["whatsapp_api_key_set"] = bool(h_settings.get("whatsapp_api_key") or h_settings.get("whatsapp_api_key_vault_id"))
    data["brevo_api_key_set"] = bool(h_settings.get("brevo_api_key"))
    return data


@router.delete("/hotels/{hotel_id}")
async def delete_hotel(
    hotel_id: str, request: Request, session: DbSession,
    background_tasks: BackgroundTasks,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
):
    """Permanently delete a hotel and all associated data."""
    from sqlalchemy import text
    from app.core.db.supabase import get_supabase
    from app.core.storage import delete_media_objects
    from app.rooms.room import RoomType

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    # Snapshot all media (hotel + every room) BEFORE the cascade deletes so we
    # can purge it from storage afterwards — otherwise deleting a hotel orphans
    # all its images forever. Best-effort; failures here never block the delete.
    media_to_clean = list(hotel.photos or []) + list(getattr(hotel, "videos", None) or [])
    try:
        room_media_rows = (await session.execute(
            select(RoomType.photos, RoomType.videos).where(RoomType.hotel_id == hotel_id)
        )).all()
        for photos, videos in room_media_rows:
            media_to_clean.extend(photos or [])
            media_to_clean.extend(videos or [])
    except Exception as e:
        logger.warning("Could not snapshot room media for hotel %s: %s", hotel_id, e)

    users_to_delete = (await session.execute(select(User).where(User.hotel_id == hotel_id))).scalars().all()

    deep_queries = [
        "DELETE FROM analytics_events WHERE session_id IN (SELECT id FROM analytics_sessions WHERE hotel_id = :id)",
        "DELETE FROM room_amenity_links WHERE room_id IN (SELECT id FROM room_types WHERE hotel_id = :id)",
        "DELETE FROM booking_timeline WHERE booking_id IN (SELECT id FROM bookings WHERE hotel_id = :id)",
        "DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE hotel_id = :id)",
        "DELETE FROM payments WHERE hotel_id = :id",
    ]
    tables = [
        "channel_logs", "channel_room_mappings", "room_rates", "room_blocks", "room_rate_links",
        "bookings", "guests", "rate_plans", "room_types", "analytics_sessions",
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
        # Purge hotel + room media from storage after the response (best-effort).
        if media_to_clean:
            background_tasks.add_task(delete_media_objects, media_to_clean)
        return {"message": "Hotel and all associated data deleted successfully"}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete hotel: {str(e)}")


@router.post("/impersonate/{hotel_id}")
async def impersonate_hotel(
    hotel_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
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
    # SECURITY: impersonation tokens MUST be short-lived. Without an `exp` a
    # leaked impersonation token would be a permanent owner-level credential.
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    payload = {
        "sub": target_user.supabase_id or target_user.id,
        "email": target_user.email,
        "role": target_user.role.value if hasattr(target_user.role, "value") else str(target_user.role),
        "type": "access",
        "impersonation": True,
        "impersonated_by": super_admin.email,
        "iat": now,
        "exp": now + timedelta(minutes=30),
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
    super_admin: User = Depends(require_permission("superadmin.hotels.read")),
):
    """Recompute social proof cache for one or all hotels."""
    from app.google_reviews.social_proof_refresh import refresh_all_social_proof_stats, refresh_one_hotel_now

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


@router.post("/media/sweep-orphans")
async def sweep_orphan_media(
    request: Request,
    session: DbSession,
    grace_hours: int = 24,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
):
    """Manually run the orphaned-media sweep (also runs daily on a schedule).

    Removes hotel-assets objects that no room/hotel references and that are
    older than `grace_hours`. Lets the admin reclaim storage on demand instead
    of waiting for the next scheduled run.
    """
    from app.core.storage import sweep_orphaned_media
    grace = max(0, min(int(grace_hours), 24 * 30))  # clamp 0..30 days
    result = await sweep_orphaned_media(grace_hours=grace)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="SWEEP_ORPHAN_MEDIA",
        description=(
            f"Orphan-media sweep — scanned {result.get('scanned')}, "
            f"deleted {result.get('deleted')} (grace {grace}h)"
        ),
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"status": "success", **result}


