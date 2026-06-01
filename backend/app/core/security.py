"""
Security Utilities
JWT Token generation aur verification yahan hoti hai.
Password hashing bhi yahan handle hota hai.
"""
from datetime import datetime, timedelta, timezone
from typing import Any
# Migrated from python-jose to PyJWT in P4.7 — jose has known CVEs
# (CVE-2024-33663 algorithm confusion, CVE-2024-33664 DoS) and is
# unmaintained. PyJWT is the actively-maintained alternative with
# the same algorithm support (HS256/RS256/ES256).
import jwt
from jwt import InvalidTokenError as JWTError
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# Password hashing context - bcrypt use kar rahe hain (industry standard)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """
    Access token banata hai jo short-lived hota hai.
    Subject usually user_id hota hai.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: str | Any) -> str:
    """
    Refresh token banata hai jo long-lived hota hai.
    Isse new access token lene ke liye use karte hain.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_reset_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """
    Password reset token banata hai.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15) # Default 15 mins

    to_encode = {"exp": expire, "sub": str(subject), "type": "reset"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> str | None:
    """
    Token verify karta hai aur subject (user_id) return karta hai.
    Agar invalid hai toh None return karta hai.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        token_type_in_payload = payload.get("type")
        if token_type_in_payload != token_type:
            return None
        subject: str = payload.get("sub")
        if subject is None:
            return None
        return subject
    except JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    User ka password verify karta hai.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Password ko hash karta hai storage ke liye.
    """
    return pwd_context.hash(password)
