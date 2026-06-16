"""
Authentication Router
Login, Signup, Refresh token endpoints.
Frontend ke auth.ts aur client.ts se match karta hai.
"""
from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
import re
import uuid
import logging

from app.core.db.database import get_session
from app.core.utils.limiter import limiter
# Authentication is handled by Supabase, local token generation is no longer needed.
from app.core.utils.config import get_settings
from app.guests.user import User, UserCreate, UserRead, UserRole
from app.brand_console.hotel import Hotel
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def generate_slug(name: str) -> str:
    """Hotel name se URL-friendly slug banata hai"""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    return slug


class RegisterRequest(BaseModel):
    """Naya hotel aur profile setup karne ke liye schema"""
    name: str # User ka naam
    hotel_name: str # Hotel ka naam


from app.core.auth.deps import get_current_user
from app.core.db.supabase import get_supabase

@router.post("/onboarding")
async def complete_onboarding(
    request: Request,
    hotel_data: RegisterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)]
):
    """
    Onboarding: Pehle se logged-in user ke liye hotel initialize karta hai.
    """
    try:
        if current_user.hotel_id:
            # Update existing hotel name rather than crashing
            result = await session.execute(select(Hotel).where(Hotel.id == current_user.hotel_id))
            hotel = result.scalar_one_or_none()
            if hotel:
                hotel.name = hotel_data.hotel_name
                session.add(hotel)
                await session.commit()
                await session.refresh(current_user)
                return {
                    "message": "Onboarding updated successfully",
                    "user": UserRead.model_validate(current_user).model_dump(),
                    "hotel": hotel
                }
        
        # 1. Create Hotel
        hotel_slug = generate_slug(hotel_data.hotel_name)
        # Check slug uniqueness
        slug_check = await session.execute(select(Hotel).where(Hotel.slug == hotel_slug))
        if slug_check.scalar_one_or_none():
            hotel_slug = f"{hotel_slug}-{str(uuid.uuid4())[:8]}"

        hotel = Hotel(name=hotel_data.hotel_name, slug=hotel_slug)
        session.add(hotel)
        await session.flush()
        
        # 2. Link user to hotel
        current_user.hotel_id = hotel.id
        session.add(current_user)
        await session.commit()
        await session.refresh(current_user)
        
        return {
            "message": "Onboarding completed successfully",
            "user": UserRead.model_validate(current_user).model_dump(),
            "hotel": hotel
        }
    except Exception as e:
        logger.error(f"Onboarding Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




