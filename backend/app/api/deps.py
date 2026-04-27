"""
Authentication Dependencies
Protected routes ke liye current user retrieve karta hai.
"""
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.core.supabase import verify_supabase_token
from app.models.user import User
from sqlalchemy.orm import selectinload
import logging
import json
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)

# OAuth2 scheme - Frontend Authorization header se token extract karega
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)]
) -> User:
    """
    Token verify karke current user return karta hai.
    Supabase Native Auth support ke saath. Optimized with Redis caching for verification.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check if the token payload is cached in Redis to skip the expensive decoding
    cache_key = f"auth_payload:{token}"
    payload = None
    r = redis_client.get_instance()
    try:
        cached_payload = r.get(cache_key)
        if cached_payload:
            payload = json.loads(cached_payload)
    except Exception as e:
        logger.warning(f"Redis cache read failed during auth token verification: {e}")

    # Supabase Token verify karo (Returns payload now)
    if not payload:
        payload = await verify_supabase_token(token)
        if payload:
            try:
                r.setex(cache_key, 600, json.dumps(payload)) # Cache valid token for 10 minutes
            except Exception as e:
                logger.warning(f"Redis cache write failed during auth token cache: {e}")
    if payload is None:
        logger.error("Token verification failed in get_current_user")
        raise credentials_exception
    
    supabase_id = payload.get("sub")
    email = payload.get("email")
    logger.info(f"Auth Attempt: supabase_id={supabase_id}, email={email}")
    
    # 1. User database se fetch karo using supabase_id
    query = select(User).where(User.supabase_id == supabase_id).options(selectinload(User.hotel))
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    # 2. Fallback: Agar ID se nahi mila, toh email se check karo (Linking logic)
    if user is None:
        logger.info(f"User not found by ID {supabase_id}, checking by email {email}")
        if email:
            query = select(User).where(User.email == email).options(selectinload(User.hotel))
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            
            if user:
                logger.info(f"Linking existing user {email} with Supabase ID {supabase_id}")
                user.supabase_id = supabase_id
                session.add(user)
                await session.commit()
                await session.refresh(user)
            else:
                logger.info(f"User not found by email {email} either.")

    # 3. Last Resort: Agar email se bhi nahi mila, toh Auto-Registration (First time login)
    if user is None:
        logger.info(f"Starting auto-registration for {email}")
        from app.models.hotel import Hotel
        import uuid
        
        name = payload.get("user_metadata", {}).get("name", email.split("@")[0] if email else "User")
        
        try:
            # Check unique email again to avoid race conditions
            if email:
                query = select(User).where(User.email == email)
                check_res = await session.execute(query)
                if check_res.scalar_one_or_none():
                    logger.error(f"Race condition: email {email} exists but lookup failed earlier")
                    raise Exception(f"Email {email} already exists but linking failed")

            # Default Hotel banao
            hotel = Hotel(name=f"{name}'s Hotel", slug=f"hotel-{str(uuid.uuid4())[:8]}")
            session.add(hotel)
            await session.flush()
            
            # User banao
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                name=name,
                hashed_password="SUPABASE_AUTH",
                role="owner",
                hotel_id=hotel.id,
                supabase_id=supabase_id,
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            logger.info(f"Auto-registration successful for {email}")
        except Exception as e:
            logger.error(f"Auto-Sync Error for {email}: {str(e)}")
            raise credentials_exception



    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is deactivated"
        )
    
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Shortcut dependency for active user"""
    return current_user


# Type alias for cleaner route signatures
CurrentUser = Annotated[User, Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]
