"""
Super Admin — Active session tracking and force-logout.

Sessions are tracked in Redis when users call authenticated endpoints.
Key: session:{user_id}:{session_token_prefix}
Value: JSON { user_id, email, role, hotel_id, ip, user_agent, last_seen, created_at }
"""
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from app.core.auth.deps import DbSession
from app.core.cache.redis_client import redis_client
from app.guests.user import User
from app.system.audit import AuditLog
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

SESSION_TTL = 60 * 60 * 24 * 7  # 7 days
REVOKED_PREFIX = "revoked_token:"
SESSION_PREFIX = "active_session:"


def record_session(user_id: str, token_prefix: str, data: dict) -> None:
    """Called from auth deps to track an active session."""
    key = f"{SESSION_PREFIX}{user_id}:{token_prefix}"
    try:
        redis_client.set_value(key, json.dumps({
            **data,
            "last_seen": datetime.utcnow().isoformat(),
        }), expire=SESSION_TTL)
    except Exception:
        pass


def is_token_revoked(token_prefix: str) -> bool:
    """Check if a token has been force-revoked by superadmin."""
    try:
        return redis_client.get_value(f"{REVOKED_PREFIX}{token_prefix}") is not None
    except Exception:
        return False


def _parse_sessions() -> list[dict]:
    r = redis_client.get_instance()
    sessions = []
    if r:
        try:
            keys = r.keys(f"{SESSION_PREFIX}*")
            for key in keys:
                raw = r.get(key)
                if raw:
                    try:
                        sessions.append(json.loads(raw))
                    except Exception:
                        pass
        except Exception:
            pass
    else:
        # In-memory fallback
        for key, (val, _) in redis_client._local_memory_cache.items():
            if key.startswith(SESSION_PREFIX):
                try:
                    sessions.append(json.loads(val))
                except Exception:
                    pass
    return sessions


@router.get("/sessions")
async def list_active_sessions(super_admin: User = Depends(require_permission("superadmin.sessions.read"))):
    """List all active user sessions tracked in Redis."""
    sessions = _parse_sessions()
    sessions.sort(key=lambda s: s.get("last_seen", ""), reverse=True)
    return {
        "total": len(sessions),
        "sessions": sessions,
    }


@router.delete("/sessions/{user_id}")
async def revoke_user_sessions(
    user_id: str,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.sessions.write")),
):
    """Force-logout all sessions for a user by revoking their token prefixes."""
    r = redis_client.get_instance()
    revoked = 0

    pattern = f"{SESSION_PREFIX}{user_id}:*"
    if r:
        try:
            keys = r.keys(pattern)
            for key in keys:
                # Extract token_prefix and mark as revoked for 7 days
                token_prefix = key.split(":")[-1]
                r.setex(f"{REVOKED_PREFIX}{token_prefix}", SESSION_TTL, "1")
                r.delete(key)
                revoked += 1
        except Exception as e:
            logger.error("Session revocation failed for user %s: %s", user_id, e)
    else:
        # In-memory fallback
        to_del = [k for k in redis_client._local_memory_cache if k.startswith(f"{SESSION_PREFIX}{user_id}:")]
        for k in to_del:
            token_prefix = k.split(":")[-1]
            redis_client.set_value(f"{REVOKED_PREFIX}{token_prefix}", "1", expire=SESSION_TTL)
            redis_client.delete_value(k)
            revoked += 1

    # Fetch user's email to make the log descriptive
    target_user = await session.get(User, user_id)
    target_email = target_user.email if target_user else user_id
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="REVOKE_SESSIONS",
        description=f"Force-revoked all {revoked} active sessions for user '{target_email}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()

    return {
        "status": "success",
        "user_id": user_id,
        "sessions_revoked": revoked,
        "message": f"All {revoked} sessions revoked. User will be logged out on next request.",
    }


