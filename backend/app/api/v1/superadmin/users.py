"""
Super Admin — User management: list, create, update role/status, delete.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import select

from app.api.deps import DbSession
from app.models.audit import AuditLog
from app.models.hotel import Hotel
from app.models.user import User, UserRole
from .hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


class SuperAdminUserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str


@router.get("/users", response_model=List[dict])
async def list_users(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
    query: Optional[str] = None,
):
    from sqlalchemy.orm import selectinload
    stmt = select(User).options(selectinload(User.hotel))
    if query:
        stmt = stmt.where(User.email.ilike(f"%{query}%") | User.name.ilike(f"%{query}%"))
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
    user_id: str, role: str, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")
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
    super_admin: User = Depends(get_super_admin),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "is_active" not in data:
        raise HTTPException(status_code=400, detail="Missing 'is_active' in request body")
    user.is_active = bool(data["is_active"])
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

    if user.supabase_id:
        try:
            from app.core.supabase import get_supabase
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
    Only existing super admins can call this — no public signup allowed.
    """
    from app.core import security
    from app.core.supabase import get_supabase

    email = data.email.lower().strip()
    if (await session.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    supabase_client = get_supabase()

    def _create_sb_user():
        return supabase_client.auth.admin.create_user({
            "email": email,
            "password": data.password,
            "email_confirm": True,
            "user_metadata": {"name": data.name, "is_staff": True},
        })

    try:
        sb_user = await asyncio.to_thread(_create_sb_user)
        supabase_id = sb_user.user.id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Failed to save employee: {str(e)}")

    return {
        "id": new_user.id,
        "email": new_user.email,
        "name": new_user.name,
        "role": new_user.role,
        "message": f"Employee account created. {email} can now login at superadmin.staybooker.ai",
    }


@router.post("/hotels/{hotel_id}/users")
async def create_hotel_user(
    hotel_id: str, data: SuperAdminUserCreate, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Create a new employee user for a hotel."""
    from app.core import security
    from app.core.supabase import get_supabase

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    if (await session.execute(select(User).where(User.email == data.email.lower().strip()))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email address already exists")

    if data.role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")

    supabase_client = get_supabase()

    def _create_sb_user():
        return supabase_client.auth.admin.create_user({
            "email": data.email.lower().strip(),
            "password": data.password,
            "email_confirm": True,
            "user_metadata": {"name": data.name, "hotel_name": hotel.name},
        })

    try:
        sb_user = await asyncio.to_thread(_create_sb_user)
        supabase_id = sb_user.user.id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Supabase Auth registration failed: {str(e)}")

    new_user = User(
        email=data.email.lower().strip(),
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
        ip_address="127.0.0.1",
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
        raise HTTPException(status_code=500, detail=f"Failed to save user: {str(e)}")

    return {
        "id": new_user.id, "name": new_user.name, "email": new_user.email,
        "role": new_user.role, "hotel_id": new_user.hotel_id, "is_active": new_user.is_active,
        "created_at": new_user.created_at.isoformat() if new_user.created_at else None,
    }
