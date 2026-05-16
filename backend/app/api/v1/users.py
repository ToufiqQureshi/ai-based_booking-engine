"""
Users Router
Current user profile aur management.
"""
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession, get_current_user
from app.models.user import UserRead, User
from typing import Annotated
from fastapi import Depends

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
async def get_users(current_user: CurrentUser, session: DbSession):
    """
    Get all users for the current hotel.
    Team management page ke liye.
    """
    from app.models.user import User
    from sqlmodel import select
    
    result = await session.execute(
        select(User).where(User.hotel_id == current_user.hotel_id)
    )
    return result.scalars().all()


from pydantic import BaseModel
from fastapi import HTTPException, status
from app.core import security

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
async def change_password(
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
