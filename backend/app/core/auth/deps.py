"""
Authentication Dependencies
Protected routes ke liye current user retrieve karta hai.
"""
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.db.database import get_session
from app.core.db.supabase import verify_supabase_token
from app.guests.user import User
from sqlalchemy.orm import selectinload
import logging
import json
from app.core.cache.redis_client import redis_client

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
        if r:
            cached_payload = r.get(cache_key)
            if cached_payload:
                payload = json.loads(cached_payload)
    except Exception as e:
        logger.warning(f"Redis cache read failed during auth token verification: {e}")

    # Supabase Token verify karo (Returns payload now)
    if not payload:
        payload = await verify_supabase_token(token)
        if payload and r:
            try:
                # SECURITY: cap the cache TTL at the token's own expiry. Caching a
                # decoded payload bypasses re-verification (incl. the exp check),
                # so a cached entry must never outlive the token itself.
                import time as _time
                exp = payload.get("exp")
                ttl = 600
                if isinstance(exp, (int, float)):
                    ttl = int(min(600, max(0, exp - _time.time())))
                if ttl > 0:
                    r.setex(cache_key, ttl, json.dumps(payload))
            except Exception as e:
                logger.warning(f"Redis cache write failed during auth token cache: {e}")
    if payload is None:
        logger.warning("Token verification failed in get_current_user (likely expired/invalid token)")
        raise credentials_exception
    
    supabase_id = payload.get("sub")
    email = payload.get("email")
    # PII (email/supabase_id) is logged at DEBUG only — at INFO this fires on
    # every authenticated request, leaking PII into logs and inflating egress.
    logger.debug(f"Auth Attempt: supabase_id={supabase_id}, email={email}")
    
    # 1. User database se fetch karo using supabase_id
    query = select(User).where(User.supabase_id == supabase_id).options(selectinload(User.hotel))
    result = await session.execute(query)
    user = result.scalar_one_or_none()
    
    # 2. Fallback: Agar ID se nahi mila, toh email se check karo (Linking logic)
    if user is None:
        logger.debug(f"User not found by ID {supabase_id}, checking by email {email}")
        if email:
            query = select(User).where(User.email == email).options(selectinload(User.hotel))
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            
            if user:
                logger.debug(f"Linking existing user {email} with Supabase ID {supabase_id}")
                user.supabase_id = supabase_id
                session.add(user)
                await session.commit()
                await session.refresh(user)
    # Auto-heal: User exists but missing hotel_id (Multi-property migration)
    if user and not user.hotel_id and user.role != "SUPER_ADMIN":
        from app.bookings.links import UserHotelLink
        from app.brand_console.hotel import Hotel
        import uuid
        
        # 1. Check if user already has links via the new multi-property system
        link_query = select(UserHotelLink).where(UserHotelLink.user_id == user.id)
        links_res = await session.execute(link_query)
        links = links_res.scalars().all()
        
        if links:
            # If links exist, just use the first one as active context
            logger.debug(f"Auto-healing user {email}: Setting hotel_id from existing UserHotelLink")
            user.hotel_id = links[0].hotel_id
            session.add(user)
            await session.commit()
            await session.refresh(user)
        else:
            # 2. Truly orphaned user (legacy signup or corrupted state) - Create default hotel
            logger.debug(f"Auto-healing missing hotel for user {email}: Creating new default hotel")
            hotel_name = payload.get("user_metadata", {}).get("hotel_name", f"{user.name or 'My'}'s Hotel")
            hotel_slug = f"hotel-{str(uuid.uuid4())[:8]}"
            hotel = Hotel(name=hotel_name, slug=hotel_slug)
            session.add(hotel)
            await session.flush()

            user.hotel_id = hotel.id
            # Also create the link for the new hotel
            new_link = UserHotelLink(user_id=user.id, hotel_id=hotel.id, role=user.role)
            session.add(new_link)

            session.add(user)
            await session.commit()
            await session.refresh(user)

    # 3. Last Resort: Agar email se bhi nahi mila, toh Auto-Registration (First time login)
    if user is None:
        # Check if the supabase_id actually exists in auth.users schema.
        # If it doesn't, it means the user was deleted/purged by superadmin.
        try:
            from sqlalchemy import text
            auth_check = await session.execute(
                text("SELECT id FROM auth.users WHERE id = :sub_id"),
                {"sub_id": supabase_id}
            )
            if not auth_check.scalar():
                logger.warning(f"Auto-registration blocked: Supabase Auth user {supabase_id} does not exist in auth.users")
                raise credentials_exception
        except Exception as e:
            if isinstance(e, HTTPException) and e.status_code == status.HTTP_401_UNAUTHORIZED:
                raise e
            logger.warning(f"Failed to query auth.users schema during auto-registration check: {e}")

        logger.debug(f"Starting auto-registration for {email}")
        from app.brand_console.hotel import Hotel
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
            hotel_name = payload.get("user_metadata", {}).get("hotel_name", f"{name}'s Hotel")
            hotel = Hotel(name=hotel_name, slug=f"hotel-{str(uuid.uuid4())[:8]}")
            session.add(hotel)
            await session.flush()
            
            # User banao
            from app.guests.user import UserRole
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                name=name,
                hashed_password="SUPABASE_AUTH",
                role=UserRole.OWNER,
                hotel_id=hotel.id,
                supabase_id=supabase_id,
                is_active=True
            )
            session.add(user)
            await session.commit()
            # Explicitly load hotel to avoid MissingGreenlet error in get_current_active_user
            await session.refresh(user, ["hotel"])
            logger.debug(f"Auto-registration successful for {email}")
        except Exception as e:
            logger.error(f"Auto-Sync Error for {email}: {str(e)}")
            raise credentials_exception



    
    # 4. Master Admin Auto-Promotion - configured via MASTER_ADMIN_EMAILS env var
    from app.core.utils.config import get_settings
    settings = get_settings()
    admin_emails = settings.master_admin_email_set
    effective_email = (email or user.email or "").lower().strip()

    if admin_emails and effective_email in admin_emails and user.role != "SUPER_ADMIN":
        from app.guests.user import UserRole
        user.role = UserRole.SUPER_ADMIN
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info("MASTER ADMIN AUTO-PROMOTED (user_id=%s)", user.id)

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    """Shortcut dependency for active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is deactivated")
    if current_user.hotel and not current_user.hotel.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hotel is deactivated")

    # Check if token has been force-revoked by superadmin
    token_prefix = token[:16] if token else ""
    try:
        from app.superadmin.platform.sessions import is_token_revoked, record_session
        if is_token_revoked(token_prefix):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked by admin")
        # Record active session (best-effort, non-blocking)
        record_session(current_user.id, token_prefix, {
            "user_id": current_user.id,
            "email": current_user.email,
            "role": str(current_user.role),
            "hotel_id": current_user.hotel_id,
        })
    except HTTPException:
        raise
    except Exception:
        pass  # Never block auth because of session tracking failure

    try:
        import sentry_sdk
        sentry_sdk.set_user({
            "id": str(current_user.id),
            "role": str(current_user.role),
        })
        if current_user.hotel_id:
            sentry_sdk.set_tag("hotel_id", str(current_user.hotel_id))
    except Exception:
        pass

    return current_user


# Type alias for cleaner route signatures
CurrentUser = Annotated[User, Depends(get_current_active_user)]
DbSession = Annotated[AsyncSession, Depends(get_session)]


def require_hotel_role(*allowed_roles: str):
    """Dependency factory enforcing intra-tenant role tiers (OWNER/MANAGER/STAFF).

    Without this, any authenticated hotel user — including STAFF — could perform
    full hotel-admin actions via the API (the frontend sidebar was the only gate).
    SUPER_ADMIN (including impersonation) is always allowed. Use on mutating
    config endpoints, e.g.:

        @router.post("/", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
    """
    allowed = {r.upper() for r in allowed_roles}

    async def _dep(current_user: CurrentUser) -> User:
        role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        if role == "SUPER_ADMIN" or role in allowed:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action requires one of roles: {sorted(allowed)}",
        )

    return _dep
