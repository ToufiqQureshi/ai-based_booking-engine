"""
AI-03: per-hotel, per-agent LLM token-usage accounting and quota enforcement.

Each agent type (hotelier / guest / whatsapp) has its own daily token budget
set by the superadmin per hotel in the Subscription model. Tokens are recorded
in Redis under ai_tokens:{agent_type}:{hotel_id}:{YYYYMMDD}.

Quota enforcement is async (needs a DB session for the limit) and fails open on
infrastructure errors so hoteliers are never blocked by Redis/DB issues.
"""
from __future__ import annotations

import logging
import threading
from typing import Optional

from fastapi import HTTPException, status

from app.core.redis_client import redis_client
from app.core.time import utcnow

logger = logging.getLogger(__name__)

# Keep daily counters for ~5 weeks so monthly cost can be aggregated.
_TOKEN_KEY_TTL = 86400 * 35

# In-process fallback when Redis is down: track request counts per agent+hotel.
# Effective per-process cap = limit / _APPROX_TOKENS_PER_REQ, so across N workers
# the worst-case overage is N × that value before Redis recovers.
_APPROX_TOKENS_PER_REQ = 500
_fb_lock = threading.Lock()
_fb_counts: dict[str, int] = {}
_fb_day: Optional[str] = None


def _enforce_inprocess_fallback(agent_type: str, hotel_id: str, day: str, limit: int) -> None:
    """Conservative in-process cap used only when Redis is unreachable."""
    global _fb_day
    with _fb_lock:
        if _fb_day != day:
            _fb_day = day
            _fb_counts.clear()
        key = f"{agent_type}:{hotel_id}"
        count = _fb_counts.get(key, 0) + 1
        _fb_counts[key] = count
    # Per-process cap: limit / tokens_per_req keeps request count bounded;
    # divide by 10 as a safety margin for multi-worker deployments.
    per_process_cap = max(5, limit // (_APPROX_TOKENS_PER_REQ * 10))
    if count > per_process_cap:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI token quota exceeded. Please try again tomorrow.",
        )


def _coerce_number(value) -> float:
    """Agno metrics fields can be a scalar or a per-message list; normalise."""
    if isinstance(value, (list, tuple)):
        return float(sum(v for v in value if isinstance(v, (int, float))))
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def _get(metrics, key):
    if isinstance(metrics, dict):
        return metrics.get(key)
    return getattr(metrics, key, None)


def extract_total_tokens(result) -> int:
    """Pull total token count out of an Agno RunResponse (best-effort)."""
    metrics = getattr(result, "metrics", None)
    if metrics is None:
        return 0
    total = _coerce_number(_get(metrics, "total_tokens"))
    if not total:
        total = _coerce_number(_get(metrics, "input_tokens")) + _coerce_number(_get(metrics, "output_tokens"))
    return int(total)


def record_ai_usage(hotel_id: str, result, agent_type: str = "hotelier") -> int:
    """Accumulate this run's token usage for the given agent type.

    Redis key: ai_tokens:{agent_type}:{hotel_id}:{YYYYMMDD}
    Returns the number of tokens recorded (0 if unavailable). Never raises.
    """
    try:
        if not hotel_id:
            return 0
        tokens = extract_total_tokens(result)
        if tokens <= 0:
            return 0
        r = redis_client.get_instance()
        if not r:
            return tokens
        day = utcnow().strftime("%Y%m%d")
        key = f"ai_tokens:{agent_type}:{hotel_id}:{day}"
        new_total = r.incrby(key, tokens)
        if new_total == tokens:  # first write today -> set expiry
            r.expire(key, _TOKEN_KEY_TTL)
        return tokens
    except Exception as exc:  # pragma: no cover - telemetry must never break a request
        logger.debug("record_ai_usage failed for hotel %s agent %s: %s", hotel_id, agent_type, exc)
        return 0


async def enforce_ai_token_quota(agent_type: str, hotel_id: str, session) -> None:
    """Block the request if today's token spend has hit the per-agent subscription limit.

    agent_type must be one of: "hotelier", "guest", "whatsapp".
    Fails open on Redis unavailability or DB errors — infrastructure issues must
    never block legitimate users.
    """
    try:
        from sqlmodel import select
        from app.models.subscription import Subscription

        sub = (await session.execute(
            select(Subscription).where(Subscription.hotel_id == hotel_id)
        )).scalar_one_or_none()

        if not sub:
            return  # No subscription record = no limit to enforce

        limit_map = {
            "hotelier": sub.ai_hotelier_daily_limit,
            "guest":    sub.ai_guest_chat_daily_limit,
            "whatsapp": sub.ai_whatsapp_daily_limit,
        }
        limit = limit_map.get(agent_type, 0)
        if limit <= 0:
            return  # 0 = unlimited

        day = utcnow().strftime("%Y%m%d")
        r = redis_client.get_instance()

        if r:
            raw = r.get(f"ai_tokens:{agent_type}:{hotel_id}:{day}")
            used = int(raw) if raw else 0
            if used >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Daily AI quota exceeded ({used:,}/{limit:,} tokens). "
                        "Please try again tomorrow or contact support to upgrade."
                    ),
                )
            return  # Within budget

    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("enforce_ai_token_quota failed for hotel %s agent %s: %s", hotel_id, agent_type, exc)
        return  # Fail open on unexpected errors

    # Redis unavailable: conservative in-process fallback
    _enforce_inprocess_fallback(agent_type, hotel_id, day, limit)
