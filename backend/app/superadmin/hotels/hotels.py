"""
Super Admin — Hotel management: list, update, delete, impersonate, social proof.
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlmodel import select

from app.core.auth.deps import CurrentUser, DbSession
from app.core.auth.vault import store_settings_secret, store_column_secret, resolve_column_secret
from app.core.utils.config import get_settings
from app.system.audit import AuditLog
from app.brand_console.hotel import Hotel, HotelUpdate, HotelSettings
from app.superadmin.subscriptions.subscription import Subscription
from app.guests.user import User, UserRole
from app.core.db.supabase import get_supabase
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
        "/integration", "/settings",
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


def _secret_hint(value: Optional[str]) -> Optional[str]:
    """Return a masked, non-secret preview of a credential for the admin UI.

    Industry-standard "show last few + first few" pattern (Stripe/AWS style) so
    platform staff can RECOGNISE which key is stored without it being the raw
    value — this is what stops them re-entering a key they already configured.
    The middle is a fixed-width mask so the real length isn't leaked. Stored as
    a separate `<field>_hint` key (never a secret) and surfaced only to the
    super-admin views, never to hoteliers.
    """
    if not value:
        return None
    v = str(value)
    if len(v) <= 4:
        return "•" * len(v)
    if len(v) <= 9:
        return v[0] + "•" * 6 + v[-1]
    return v[:4] + "•" * 6 + v[-4:]


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
    # Masked previews (e.g. ai_api_key_hint) collected as secrets are written,
    # then merged into hotel.settings below. Safe to persist + return.
    secret_hints: dict = {}

    if "ai_api_key" in db_data:
        ai_key_val = db_data.pop("ai_api_key")
        if ai_key_val == SECRET_CLEAR_SENTINEL:
            await store_column_secret(
                session, hotel, "ai_api_key", "ai_api_key_vault_id",
                None, f"hotel_{hotel_id}_ai_api_key",
            )
            secret_changes.append("ai_api_key")
            secret_hints["ai_api_key_hint"] = None
        elif ai_key_val == SECRET_KEEP_SENTINEL or not ai_key_val:
            pass  # blank or KEEP — leave the stored secret untouched
        else:
            await store_column_secret(
                session, hotel, "ai_api_key", "ai_api_key_vault_id",
                ai_key_val, f"hotel_{hotel_id}_ai_api_key",
            )
            secret_changes.append("ai_api_key")
            secret_hints["ai_api_key_hint"] = _secret_hint(ai_key_val)

    if "settings" in db_data and isinstance(db_data["settings"], dict):
        incoming = db_data.pop("settings")
        merged = dict(hotel.settings or {})
        for k, v in incoming.items():
            if k in _SETTINGS_SECRET_FIELDS:
                if v == SECRET_CLEAR_SENTINEL:
                    merged = await store_settings_secret(session, merged, k, None, hotel_id)
                    merged[f"{k}_hint"] = None
                    secret_changes.append(k)
                elif v == SECRET_KEEP_SENTINEL or not v:
                    # Blank or KEEP — never wipe a stored secret. The form never
                    # receives the real value, so an empty field means "unchanged".
                    continue
                else:
                    merged = await store_settings_secret(session, merged, k, v, hotel_id)
                    merged[f"{k}_hint"] = _secret_hint(v)
                    secret_changes.append(k)
            else:
                merged[k] = v  # non-secret settings: shallow-merge as before
        hotel.settings = merged

    # Persist any hints produced outside the settings block (e.g. the AI key,
    # handled above) even when the payload carried no `settings` object.
    if secret_hints:
        merged_settings = dict(hotel.settings or {})
        merged_settings.update(secret_hints)
        hotel.settings = merged_settings

    changes = []
    for key, value in db_data.items():
        old_val = getattr(hotel, key, None)
        if old_val != value:
            changes.append(f"{key}: {old_val} -> {value}")

    for key, value in db_data.items():
        setattr(hotel, key, value)
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)

    # Sync AI config changes to integration_settings so they take priority
    # over any previous hotelier-configured values.
    ai_fields_changed = set(db_data.keys()) & {
        "ai_provider", "ai_model", "ai_base_url", "ai_max_tokens"
    }
    ai_key_changed = "ai_api_key" in secret_changes

    if ai_fields_changed or ai_key_changed:
        from app.integration.integration import IntegrationSettings
        from sqlmodel import select as _select
        int_res = await session.execute(
            _select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
        )
        int_settings = int_res.scalar_one_or_none()
        if int_settings is not None:
            for f in ai_fields_changed:
                setattr(int_settings, f, db_data[f])
            if ai_key_changed:
                # Mirror the secret to integration_settings vault so it has priority
                new_key = await resolve_column_secret(
                    session, hotel, "ai_api_key", "ai_api_key_vault_id"
                )
                if new_key is not None:
                    await store_column_secret(
                        session, int_settings, "ai_api_key", "ai_api_key_vault_id",
                        new_key, f"hotel_{hotel_id}_int_ai_api_key",
                    )
            session.add(int_settings)

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
    from app.core.storage import delete_media_objects
    from app.rooms.room import RoomType

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    hotel_name = hotel.name
    hotel_slug = hotel.slug

    # Snapshot media BEFORE deletes so we can purge storage afterwards.
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

    # Snapshot Supabase auth IDs BEFORE deletes so we can purge them after commit.
    # Calling supabase.auth.admin.delete_user() while the DB transaction is still
    # open causes Supabase-side cascades to race with our own SQL deletes on the
    # users table, which is the root cause of the DeadlockDetectedError.
    supabase_id_rows = (await session.execute(
        select(User.supabase_id).where(
            User.hotel_id == hotel_id, User.supabase_id.isnot(None)
        )
    )).all()
    supabase_ids = [r[0] for r in supabase_id_rows]

    # --- All deletes run flat in a single transaction (no begin_nested savepoints).
    #
    # The original code wrapped each delete in begin_nested(), which created
    # savepoints.  SQLAlchemy's ORM cascade on session.delete(hotel) then issued
    # DELETE FROM users WHERE users.id = $1 while a savepoint still held a row
    # lock from DELETE FROM users WHERE hotel_id = :id — circular lock → deadlock.
    #
    # Fix: pure raw SQL throughout; session.delete() is never called so ORM
    # cascades never fire.  Supabase auth deletion happens as a background task
    # AFTER the transaction commits.
    try:
        # Child rows that reference tables deleted below — must go first.
        await session.execute(text("DELETE FROM analytics_events WHERE session_id IN (SELECT id FROM analytics_sessions WHERE hotel_id = :id)"), {"id": hotel_id})
        await session.execute(text("DELETE FROM room_amenity_links WHERE room_id IN (SELECT id FROM room_types WHERE hotel_id = :id)"), {"id": hotel_id})
        await session.execute(text("DELETE FROM booking_timeline WHERE booking_id IN (SELECT id FROM bookings WHERE hotel_id = :id)"), {"id": hotel_id})
        await session.execute(text("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE hotel_id = :id)"), {"id": hotel_id})
        await session.execute(text("DELETE FROM payments WHERE hotel_id = :id"), {"id": hotel_id})
        # Dependent tables (all parameterised — no f-strings).
        await session.execute(text("DELETE FROM room_rates WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM room_blocks WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM room_rate_links WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM bookings WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM guests WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM rate_plans WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM room_types WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM analytics_sessions WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM addons WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM amenities WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM api_keys WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM integration_settings WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM leads WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM promo_codes WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM user_hotel_links WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM subscriptions WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM audit_logs WHERE hotel_id = :id"), {"id": hotel_id})
        # Users and hotel row last — raw SQL avoids ORM cascade that caused the deadlock.
        await session.execute(text("DELETE FROM users WHERE hotel_id = :id"), {"id": hotel_id})
        await session.execute(text("DELETE FROM hotels WHERE id = :id"), {"id": hotel_id})


        session.add(AuditLog(
            user_id=super_admin.id, user_email=super_admin.email,
            action="DELETE_HOTEL",
            description=f"Permanently deleted hotel '{hotel_name}' (Slug: {hotel_slug})",
            ip_address=_get_client_ip(request),
        ))
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete hotel: {str(e)}")

    # Post-commit cleanup (best-effort, non-blocking).
    # Supabase auth deletes happen here so they never interfere with our transaction.
    def _delete_supabase_users(ids: list) -> None:
        supabase_admin = get_supabase()
        for sid in ids:
            try:
                supabase_admin.auth.admin.delete_user(sid)
            except Exception as exc:
                logger.warning("Could not delete Supabase auth user %s: %s", sid, exc)

    if supabase_ids:
        background_tasks.add_task(_delete_supabase_users, supabase_ids)
    if media_to_clean:
        background_tasks.add_task(delete_media_objects, media_to_clean)

    return {"message": "Hotel and all associated data deleted successfully"}


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


# ──────────────────────────────────────────────────────────────────────────────
# Hotel Provisioning — Superadmin creates a hotel + invites the owner
# ──────────────────────────────────────────────────────────────────────────────

PLAN_DEFAULTS = {
    "Basic":      {"days": 30,  "amount": 1999.0,  "whatsapp_credits": 500,  "ai_hotelier_daily_limit": 20000,  "ai_guest_chat_daily_limit": 50000,  "ai_whatsapp_daily_limit": 50000},
    "Pro":        {"days": 30,  "amount": 4999.0,  "whatsapp_credits": 2000, "ai_hotelier_daily_limit": 50000,  "ai_guest_chat_daily_limit": 100000, "ai_whatsapp_daily_limit": 100000},
    "Enterprise": {"days": 365, "amount": 49999.0, "whatsapp_credits": 10000,"ai_hotelier_daily_limit": 200000, "ai_guest_chat_daily_limit": 500000, "ai_whatsapp_daily_limit": 500000},
}


class ProvisionHotelRequest(BaseModel):
    """Superadmin hotel provisioning schema."""
    hotel_name: str
    owner_name: str
    owner_email: EmailStr
    plan_name: str = "Basic"  # Basic | Pro | Enterprise
    redirect_url: Optional[str] = None  # Where hotelier lands after setting password


def _generate_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")


@router.post("/hotels/provision", status_code=201)
async def provision_hotel(
    payload: ProvisionHotelRequest,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
):
    """
    One-shot hotel provisioning:
    1. Create Hotel row
    2. Create User row (OWNER role, linked to hotel)
    3. Create Subscription row
    4. Supabase admin.invite_user_by_email() → hotelier gets "Set Password" email
    5. Audit log

    No migration needed — uses existing tables.
    """
    plan = payload.plan_name.strip().title()
    if plan not in PLAN_DEFAULTS:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {list(PLAN_DEFAULTS.keys())}")

    # ── Duplicate email check ──────────────────────────────────────────────────
    existing_user = (await session.execute(
        select(User).where(User.email == str(payload.owner_email))
    )).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    # ── 1. Create Hotel ────────────────────────────────────────────────────────
    base_slug = _generate_slug(payload.hotel_name)
    slug = base_slug
    suffix = 1
    while (await session.execute(select(Hotel).where(Hotel.slug == slug))).scalar_one_or_none():
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    hotel = Hotel(
        name=payload.hotel_name,
        slug=slug,
        settings=HotelSettings().model_dump(),
        is_active=True,
    )
    session.add(hotel)
    await session.flush()  # get hotel.id before linking user

    # ── 2. Create User ─────────────────────────────────────────────────────────
    user_row = User(
        id=str(uuid.uuid4()),
        email=str(payload.owner_email),
        name=payload.owner_name,
        role=UserRole.OWNER,
        hotel_id=hotel.id,
        hashed_password="__supabase_managed__",  # password fully managed by Supabase Auth
        is_active=True,
    )
    session.add(user_row)

    # ── 3. Create Subscription ────────────────────────────────────────────────
    plan_cfg = PLAN_DEFAULTS[plan]
    subscription = Subscription(
        hotel_id=hotel.id,
        plan_name=plan,
        status="active",
        payment_status="paid",
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + timedelta(days=plan_cfg["days"]),
        amount=plan_cfg["amount"],
        currency="INR",
        whatsapp_credits=plan_cfg["whatsapp_credits"],
        ai_hotelier_daily_limit=plan_cfg["ai_hotelier_daily_limit"],
        ai_guest_chat_daily_limit=plan_cfg["ai_guest_chat_daily_limit"],
        ai_whatsapp_daily_limit=plan_cfg["ai_whatsapp_daily_limit"],
    )
    session.add(subscription)

    # ── 4. Supabase invite ─────────────────────────────────────────────────────
    # invite_user_by_email() creates the Supabase Auth user and sends a
    # "You've been invited — set your password" email automatically.
    supabase = get_supabase()
    _settings = get_settings()
    redirect_url = payload.redirect_url or f"{_settings.FRONTEND_URL.rstrip('/')}/reset-password"
    try:
        invite_resp = supabase.auth.admin.invite_user_by_email(
            str(payload.owner_email),
            options={
                "data": {
                    "name": payload.owner_name,
                    "hotel_id": hotel.id,
                },
                "redirect_to": redirect_url,
            },
        )
        # Link Supabase user id to our user row immediately if available
        if invite_resp and invite_resp.user and invite_resp.user.id:
            user_row.supabase_id = invite_resp.user.id
    except Exception as exc:
        # Roll back DB records if Supabase invite fails — we cannot have a hotel
        # with no way for the owner to log in.
        await session.rollback()
        logger.error("Supabase invite failed for %s: %s", payload.owner_email, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Supabase invite email failed: {exc}. Please check Supabase SMTP settings.",
        )

    # ── 5. Audit log ───────────────────────────────────────────────────────────
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel.id,
        action="PROVISION_HOTEL",
        description=(
            f"Provisioned hotel '{hotel.name}' (slug={slug}, plan={plan}) "
            f"for owner '{payload.owner_name}' <{payload.owner_email}>. "
            f"Supabase invite sent."
        ),
        ip_address=_get_client_ip(request),
    ))

    await session.commit()

    return {
        "message": f"Hotel '{hotel.name}' provisioned. Invite email sent to {payload.owner_email}.",
        "hotel_id": hotel.id,
        "hotel_slug": slug,
        "owner_email": str(payload.owner_email),
        "plan": plan,
        "subscription_end_date": subscription.end_date.isoformat(),
    }
