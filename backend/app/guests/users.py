"""
Users Router
Current user profile aur management.
"""
from fastapi import APIRouter, Request
import logging

from app.core.deps import CurrentUser, DbSession, get_current_user
from app.core.limiter import limiter
from app.guests.user import UserRead, User
from typing import Annotated
from fastapi import Depends, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(current_user: Annotated[User, Depends(get_current_user)]):
    """
    Get logged in user's profile.
    Frontend isko use karta hai auth state verify karne ke liye.
    Returns user even if inactive (suspended) so frontend can show correct screen.
    """
    return current_user


@router.get("", response_model=list[UserRead])
async def get_users(
    current_user: CurrentUser,
    session: DbSession,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    """
    Get all users for the current hotel.
    Team management page ke liye.
    """
    from app.guests.user import User
    from sqlmodel import select

    result = await session.execute(
        select(User)
        .where(User.hotel_id == current_user.hotel_id)
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


from pydantic import BaseModel
from fastapi import HTTPException, status
from app.core import security

class TeamMemberCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str

@router.post("", response_model=UserRead)
@limiter.limit("10/hour")
async def create_team_member(
    request: Request,
    data: TeamMemberCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Add a new team member to the hotel.
    """
    from app.guests.user import UserRole, User
    from sqlmodel import select
    
    if current_user.role not in [UserRole.OWNER, UserRole.MANAGER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to add team members")
        
    existing_stmt = select(User).where(User.email == data.email.lower().strip())
    res_existing = await session.execute(existing_stmt)
    if res_existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists")
        
    from app.core.supabase import get_supabase
    supabase_client = get_supabase()
    
    from app.brand_console.hotel import Hotel
    hotel = await session.get(Hotel, current_user.hotel_id)
    hotel_name = hotel.name if hotel else "Hotel"
    
    try:
        sb_user = supabase_client.auth.admin.create_user({
            "email": data.email.lower().strip(),
            "password": data.password,
            "email_confirm": True,
            "user_metadata": {
                "name": data.name,
                "hotel_name": hotel_name
            }
        })
        supabase_id = sb_user.user.id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )
        
    if data.role not in [r.value for r in UserRole]:
        try:
            supabase_client.auth.admin.delete_user(supabase_id)
        except Exception as cleanup_err:
            logger.warning(
                "Supabase auth user %s could not be deleted during rollback (invalid role): %s",
                supabase_id, cleanup_err,
            )
        raise HTTPException(status_code=400, detail="Invalid role")

    if current_user.role == UserRole.MANAGER and data.role == UserRole.OWNER.value:
        try:
            supabase_client.auth.admin.delete_user(supabase_id)
        except Exception as cleanup_err:
            logger.warning(
                "Supabase auth user %s could not be deleted during rollback (forbidden role escalation): %s",
                supabase_id, cleanup_err,
            )
        raise HTTPException(status_code=403, detail="Managers cannot create owners")
        
    new_user = User(
        id=supabase_id,
        email=data.email.lower().strip(),
        hashed_password="",
        name=data.name,
        role=UserRole(data.role),
        hotel_id=current_user.hotel_id
    )
    
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    
    return new_user

class UserUpdateProfile(BaseModel):
    name: str | None = None

@router.patch("/me", response_model=UserRead)
async def update_current_user(
    update_data: UserUpdateProfile,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Update logged in user's profile info (Name).
    """
    if update_data.name:
        current_user.name = update_data.name
    
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    return current_user


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str

@router.patch("/me/password")
@limiter.limit("5/hour")
async def change_password(
    request: Request,
    password_data: UserChangePassword,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Change user password.
    """
    # 1. Verify current password
    if not security.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )
    
    # 2. Update with new password hash
    current_user.hashed_password = security.get_password_hash(password_data.new_password)
    
    session.add(current_user)
    await session.commit()
    
    return {"message": "Password updated successfully"}

