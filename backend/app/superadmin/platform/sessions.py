"""
Session tracking helpers — token revocation and active-session recording.

Sessions are tracked in Redis when users call authenticated endpoints.
Key: active_session:{user_id}:{session_token_prefix}
Value: JSON { user_id, email, role, hotel_id, ip, user_agent, last_seen, created_at }

The superadmin HTTP routes that once lived here (GET/DELETE /sessions) were
never mounted after the 2026-06-20 superadmin scope-trim and were deleted in
the 2026-07-02 production audit. Only these helpers are live — called from
app/core/auth/deps.py on every authenticated request. A future force-logout
feature can rebuild routes on top of the revoked_token:* keys.
"""
import json
import logging
from datetime import datetime

from app.core.cache.redis_client import redis_client

logger = logging.getLogger(__name__)

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
    except Exception as exc:
        logger.debug("record_session failed for user %s: %s", user_id, exc)


def is_token_revoked(token_prefix: str) -> bool:
    """Check if a token has been force-revoked by superadmin."""
    try:
        return redis_client.get_value(f"{REVOKED_PREFIX}{token_prefix}") is not None
    except Exception:
        return False
