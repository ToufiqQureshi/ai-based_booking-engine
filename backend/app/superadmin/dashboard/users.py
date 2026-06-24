"""
Super Admin — User management: list, create, update role/status, delete.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select

from app.core.auth.deps import DbSession
from app.core.utils.config import get_settings
from app.system.audit import AuditLog
from app.brand_console.hotel import Hotel
from app.guests.user import User, UserRole
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


class SuperAdminUserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str


class RoleUpdate(BaseModel):
    role: str


def _is_master_admin(user: User) -> bool:
    """A master admin is any user whose email is configured in MASTER_ADMIN_EMAILS.

    Master admins are the platform founders/owners. Limited-tier super-admin
    employees must never be able to demote, suspend, or delete them — that
    would lock the founders out of their own platform.
    """
    emails = get_settings().master_admin_email_set
    return bool(emails) and (user.email or "").lower().strip() in emails


def _find_supabase_user_by_email(supabase_client, email: str):
    """Best-effort lookup of an existing Supabase auth user by email.

    Used to recover from a partial-creation orphan: the Supabase auth account
    exists but the matching `public.users` row was never written (or was
    deleted), which otherwise makes the email impossible to re-add — Supabase
    rejects the create as "already registered" while our DB pre-check passes.
    Returns the auth user object or None.
    """
    email = (email or "").lower().strip()
    try:
        page = 1
        while page <= 20:  # bound the scan; platforms here are small
            users = supabase_client.auth.admin.list_users(page=page, per_page=200)
            # supabase-py may return a list or an object with `.users`.
            batch = getattr(users, "users", users) or []
            if not batch:
                break
            for u in batch:
                if (getattr(u, "email", "") or "").lower().strip() == email:
                    return u
            if len(batch) < 200:
                break
            page += 1
    except Exception as e:  # pragma: no cover - network/SDK variance
        logger.warning("Supabase user lookup by email failed: %s", e)
    return None


def _create_or_recover_supabase_user(supabase_client, email: str, password: str, metadata: dict) -> str:
    """Create a Supabase auth user, recovering from an orphaned auth account.

    If the email is already registered in Supabase Auth but has no platform
    row (the pre-check already guaranteed that), reuse the existing auth user
    and reset its password/metadata so the admin-provided credentials work.
    Returns the Supabase user id. Raises on unrecoverable failure.
    """
    try:
        sb_user = supabase_client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": metadata,
        })
        return sb_user.user.id
    except Exception as create_err:
        msg = str(create_err).lower()
        already = any(s in msg for s in ("already", "registered", "exists", "duplicate"))
        if not already:
            raise
        existing = _find_supabase_user_by_email(supabase_client, email)
        if not existing:
            raise
        # Re-attach: align the orphaned auth account with the new credentials.
        try:
            supabase_client.auth.admin.update_user_by_id(
                existing.id,
                {"password": password, "email_confirm": True, "user_metadata": metadata},
            )
        except Exception as upd_err:  # pragma: no cover - best effort
            logger.warning("Could not reset orphaned auth user %s: %s", existing.id, upd_err)
        logger.info("Recovered orphaned Supabase auth account for %s", email)
        return existing.id


@router.get("/users", response_model=List[dict])
async def list_users(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.read")),
    query: Optional[str] = None,
    role: Optional[str] = None,
    limit: Optional[int] = Query(None, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """List platform users.

    Read endpoints carry the same authz guard as writes (CLAUDE.md §8). A
    `role` filter is applied server-side so callers that only need a slice
    (e.g. the Core-Team view, which asks for SUPER_ADMIN) never receive other
    tenants' PII. `limit`/`offset` are optional to stay backward-compatible
    with the dashboard's aggregate counts, but bounded when supplied.
    """
    from sqlalchemy.orm import selectinload
    stmt = select(User).options(selectinload(User.hotel))
    if role:
        if role not in [r.value for r in UserRole]:
            raise HTTPException(status_code=400, detail="Invalid role filter")
        stmt = stmt.where(User.role == role)
    if query:
        stmt = stmt.where(User.email.ilike(f"%{query}%") | User.name.ilike(f"%{query}%"))
    stmt = stmt.order_by(User.created_at.desc())
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [
        {
            "id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "hotel_id": u.hotel_id,
            "hotel_name": u.hotel.name if u.hotel else "Platform / Super Admin",
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in result.scalars().all()
    ]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str, data: RoleUpdate, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    role = data.role
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")
    # A super-admin must not demote themselves — that would silently strip their
    # own access mid-session and can lock the last admin out.
    if user.id == super_admin.id and role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=400, detail="You cannot change your own super-admin role")
    # Master admins (platform founders) can only be modified by another master admin.
    if _is_master_admin(user) and not _is_master_admin(super_admin):
        raise HTTPException(status_code=403, detail="Only a master admin can change a master admin's role")
    # Prevent privilege escalation: only a master super-admin can promote to SUPER_ADMIN.
    # A limited-permission super-admin employee must not be able to elevate any user.
    if role == "SUPER_ADMIN" and not _is_master_admin(super_admin):
        raise HTTPException(status_code=403, detail="Only master admins can promote users to SUPER_ADMIN")
    old_role = user.role.value if hasattr(user.role, 'value') else str(user.role)
    user.role = UserRole(role)
    user.updated_at = datetime.utcnow()
    session.add(user)
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_USER_ROLE",
        description=f"Updated role for user '{user.email}' from '{old_role}' to '{role}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": f"User role updated to {role}"}


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str, request: Request, data: dict, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "is_active" not in data:
        raise HTTPException(status_code=400, detail="Missing 'is_active' in request body")
    new_active = bool(data["is_active"])
    # Don't let an admin suspend themselves out of the platform.
    if user.id == super_admin.id and not new_active:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")
    # Master admins (founders) can only be suspended by another master admin.
    if not new_active and _is_master_admin(user) and not _is_master_admin(super_admin):
        raise HTTPException(status_code=403, detail="Only a master admin can suspend a master admin")
    user.is_active = new_active
    user.updated_at = datetime.utcnow()
    session.add(user)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="UPDATE_USER_STATUS",
        description=f"Updated status for user '{user.email}': active={user.is_active}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "User status updated successfully", "is_active": user.is_active}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Never allow self-deletion or deletion of a master admin by a non-master.
    if user.id == super_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if _is_master_admin(user) and not _is_master_admin(super_admin):
        raise HTTPException(status_code=403, detail="Only a master admin can delete a master admin")

    if user.supabase_id:
        try:
            from app.core.db.supabase import get_supabase
            supabase_client = get_supabase()
            await asyncio.to_thread(supabase_client.auth.admin.delete_user, user.supabase_id)
        except Exception as e:
            logger.error("Failed to delete user %s from Supabase auth: %s", user.email, e)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="DELETE_USER",
        description=f"Deleted user '{user.email}' (Supabase ID: {user.supabase_id})",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(user)
    await session.commit()
    return {"message": "User account deleted successfully"}


@router.post("/employees")
async def create_staybooker_employee(
    request: Request, data: SuperAdminUserCreate, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """
    Add a new Staybooker employee as SUPER_ADMIN.
    Creating a SUPER_ADMIN is a privilege grant, so — like promote-to-SUPER_ADMIN
    — it is restricted to master admins. A limited-tier super-admin employee
    must not be able to mint new platform admins.
    """
    if not _is_master_admin(super_admin):
        raise HTTPException(status_code=403, detail="Only master admins can add Staybooker employees")

    import app.core.auth.security as security
    from app.core.db.supabase import get_supabase

    email = data.email.lower().strip()
    if (await session.execute(
        select(User).where(func.lower(User.email) == email)
    )).scalars().first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    supabase_client = get_supabase()

    try:
        supabase_id = await asyncio.to_thread(
            _create_or_recover_supabase_user,
            supabase_client, email, data.password,
            {"name": data.name, "is_staff": True},
        )
    except Exception as e:
        logger.error("Supabase employee account creation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create account. Please try again.")

    new_user = User(
        email=email,
        name=data.name,
        role=UserRole.SUPER_ADMIN,   # Always SUPER_ADMIN for Staybooker employees
        supabase_id=supabase_id,
        hashed_password=security.get_password_hash(data.password),
        hotel_id=None,               # No hotel — platform employee
        is_active=True,
    )
    session.add(new_user)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="CREATE_EMPLOYEE",
        description=f"Added Staybooker employee '{email}' as SUPER_ADMIN",
        ip_address=_get_client_ip(request),
    ))
    try:
        await session.commit()
        await session.refresh(new_user)
    except Exception as e:
        await session.rollback()
        try:
            supabase_client.auth.admin.delete_user(supabase_id)
        except Exception:
            pass
            
        error_str = str(e)
        if "ix_users_email" in error_str or "UniqueViolationError" in error_str:
            raise HTTPException(status_code=400, detail="A user with this email address already exists")
            
        logger.error("DB save failed for new employee: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save employee. Please try again.")

    return {
        "id": new_user.id,
        "email": new_user.email,
        "name": new_user.name,
        "role": new_user.role,
        "message": f"Employee account created. {email} can now login at superadmin.staybooker.ai",
    }


@router.post("/hotels/{hotel_id}/users")
async def create_hotel_user(
    hotel_id: str, data: SuperAdminUserCreate, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    """Create a new employee user for a hotel."""
    # Creating a SUPER_ADMIN via the hotel-user path would bypass the master-admin
    # gate on /employees, so block it here too.
    if data.role == UserRole.SUPER_ADMIN.value and not _is_master_admin(super_admin):
        raise HTTPException(status_code=403, detail="Only master admins can create SUPER_ADMIN users")
    import app.core.auth.security as security
    from app.core.db.supabase import get_supabase

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    email = data.email.lower().strip()
    if (await session.execute(
        select(User).where(func.lower(User.email) == email)
    )).scalars().first():
        raise HTTPException(status_code=400, detail="A user with this email address already exists")

    if data.role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")

    supabase_client = get_supabase()

    try:
        supabase_id = await asyncio.to_thread(
            _create_or_recover_supabase_user,
            supabase_client, email, data.password,
            {"name": data.name, "hotel_name": hotel.name},
        )
    except Exception as e:
        logger.error("Supabase Auth registration failed for hotel user: %s", e)
        raise HTTPException(status_code=500, detail="Account registration failed. Please try again.")

    # The on_auth_user_created trigger already inserted a stub row into public.users
    # the moment Supabase created the auth user. Find it and update it rather than
    # attempting a second INSERT (which would hit the supabase_id unique constraint).
    trigger_user = (await session.execute(
        select(User).where(User.supabase_id == supabase_id)
    )).scalars().first()

    if trigger_user:
        trigger_user.name = data.name
        trigger_user.email = email
        trigger_user.role = UserRole(data.role)
        trigger_user.hotel_id = hotel_id
        trigger_user.hashed_password = security.get_password_hash(data.password)
        trigger_user.is_active = True
        new_user = trigger_user
    else:
        new_user = User(
            email=email,
            name=data.name,
            role=UserRole(data.role),
            supabase_id=supabase_id,
            hashed_password=security.get_password_hash(data.password),
            hotel_id=hotel_id,
            is_active=True,
        )
        session.add(new_user)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="CREATE_USER",
        description=f"Created employee user '{new_user.email}' for hotel '{hotel.name}' with role '{data.role}'",
        ip_address=_get_client_ip(request),
    ))
    try:
        await session.commit()
        await session.refresh(new_user)
    except Exception as e:
        await session.rollback()
        try:
            supabase_client.auth.admin.delete_user(supabase_id)
        except Exception as cleanup_err:
            logger.warning("Supabase auth user %s could not be deleted during rollback: %s", supabase_id, cleanup_err)

        logger.exception("DB save failed for new hotel user %s", email)
        raise HTTPException(status_code=500, detail="Failed to save user. Please try again.")

    return {
        "id": new_user.id, "name": new_user.name, "email": new_user.email,
        "role": new_user.role, "hotel_id": new_user.hotel_id, "is_active": new_user.is_active,
        "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
    }


