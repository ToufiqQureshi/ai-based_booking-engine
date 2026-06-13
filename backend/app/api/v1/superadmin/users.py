"""
Super Admin — User management: list, create, update role/status, delete.
"""
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
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
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0)
):
    """List all users in the system (paginated)."""
    from sqlalchemy.orm import selectinload
    stmt = select(User).options(selectinload(User.hotel))
    if query:
        stmt = stmt.where(User.email.ilike(f"%{query}%") | User.name.ilike(f"%{query}%"))

    stmt = stmt.offset(offset).limit(limit).order_by(User.created_at.desc())
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
    user_id: str,
    role_data: dict,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    new_role = role_data.get("role")
    if new_role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail="Invalid role")

    user.role = new_role
    user.updated_at = datetime.utcnow()
    session.add(user)
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_USER_ROLE",
        description=f"Updated role for user {user.email}: {old_role} -> {new_role}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "User role updated successfully"}


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: dict,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_active = status_data.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active field is required")

    user.is_active = is_active
    user.updated_at = datetime.utcnow()
    session.add(user)

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_USER_STATUS",
        description=f"Updated status for user {user.email}: {'Active' if is_active else 'Inactive'}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "User status updated successfully"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.users.write")),
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == super_admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    email = user.email
    await session.delete(user)

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="DELETE_USER",
        description=f"Deleted user {email}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "User deleted successfully"}
