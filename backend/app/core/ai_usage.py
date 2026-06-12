"""
AI-03: per-hotel, per-agent LLM token-usage accounting and quota enforcement.

Each agent type (hotelier / guest / whatsapp) has its own daily token budget
set by the superadmin per hotel in the Subscription model. Tokens are recorded
in Redis under ai_tokens:{agent_type}:{hotel_id}:{YYYYMMDD}.

Quota enforcement is async (needs a DB session for the limit) and fails open on
infrastructure errors so hoteliers are never blocked by Redis/DB issues.
"""
from __future__ import annotations

import hashlib
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


def _hash_id(value: str) -> str:
    """Hash a guest identifier (phone/email/IP) before storing it so the
    unique-participant set never holds raw PII (CLAUDE.md §8). Truncated
    sha256 keeps collision risk negligible at hotel-day scale."""
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()[:16]


def record_ai_usage(
    hotel_id: str,
    result,
    agent_type: str = "hotelier",
    user_identifier: Optional[str] = None,
) -> int:
    """Record one AI run: tokens, message count, and unique participant.

    Daily Redis keys (all expire after ~5 weeks):
      - ai_tokens:{agent}:{hotel}:{YYYYMMDD}  — cumulative tokens (billing)
      - ai_runs:{agent}:{hotel}:{YYYYMMDD}    — message-exchange counter
      - ai_users:{agent}:{hotel}:{YYYYMMDD}   — SET of hashed participant ids

    `user_identifier` is the guest's phone (WhatsApp), email/IP (guest chat),
    or staff user id (hotelier). Stored hashed so no raw PII lands in Redis.
    Returns tokens recorded (0 if unavailable). Never raises.
    """
    try:
        if not hotel_id:
            return 0
        r = redis_client.get_instance()
        tokens = extract_total_tokens(result)
        if not r:
            return tokens
        day = utcnow().strftime("%Y%m%d")

        # One pipeline round-trip for all three counters. Expiry is (re)set on
        # every write — cheap, and the date-stamped key stops growing once the
        # day rolls over, so it still ages out 35 days later.
        pipe = r.pipeline()

        runs_key = f"ai_runs:{agent_type}:{hotel_id}:{day}"
        pipe.incr(runs_key)
        pipe.expire(runs_key, _TOKEN_KEY_TTL)

        if user_identifier:
            users_key = f"ai_users:{agent_type}:{hotel_id}:{day}"
            pipe.sadd(users_key, _hash_id(user_identifier))
            pipe.expire(users_key, _TOKEN_KEY_TTL)

        if tokens > 0:
            tokens_key = f"ai_tokens:{agent_type}:{hotel_id}:{day}"
            pipe.incrby(tokens_key, tokens)
            pipe.expire(tokens_key, _TOKEN_KEY_TTL)

        pipe.execute()
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

        # Redis down: use the durable DB counter instead of guessing. This keeps
        # the quota accurate during a Redis outage (the in-process cap below is
        # only a last resort if the DB read also fails).
        db_used = await _read_today_tokens_db(session, agent_type, hotel_id)
        if db_used is not None:
            if db_used >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        f"Daily AI quota exceeded ({db_used:,}/{limit:,} tokens). "
                        "Please try again tomorrow or contact support to upgrade."
                    ),
                )
            return  # Within budget per the durable counter

    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("enforce_ai_token_quota failed for hotel %s agent %s: %s", hotel_id, agent_type, exc)
        return  # Fail open on unexpected errors

    # Redis AND DB both unavailable: conservative in-process fallback
    _enforce_inprocess_fallback(agent_type, hotel_id, day, limit)


async def _read_today_tokens_db(session, agent_type: str, hotel_id: str):
    """Return today's recorded tokens from the durable table, or None on error."""
    try:
        from sqlmodel import select
        from app.models.ai_usage import AIUsageDaily
        today = utcnow().date()
        row = (await session.execute(
            select(AIUsageDaily.total_tokens).where(
                AIUsageDaily.hotel_id == hotel_id,
                AIUsageDaily.agent_type == agent_type,
                AIUsageDaily.usage_date == today,
            )
        )).scalar_one_or_none()
        return int(row or 0)
    except Exception:
        return None


async def persist_ai_usage_db(
    hotel_id: str,
    result,
    agent_type: str = "hotelier",
    user_identifier: Optional[str] = None,
) -> None:
    """Durably record one AI run in Postgres (source of truth for the dashboard).

    Opens its own short-lived session so it never entangles the request's
    transaction, and swallows every error — usage telemetry must never break a
    guest reply or webhook. Portable UPSERT works on both Postgres and SQLite.
    """
    try:
        if not hotel_id:
            return
        from sqlalchemy import update
        from sqlalchemy.exc import IntegrityError
        from app.core.database import async_session
        from app.models.ai_usage import AIUsageDaily, AIUsageParticipant

        tokens = extract_total_tokens(result) or 0
        today = utcnow().date()

        async with async_session() as s:
            # 1. Unique participant — insert-or-ignore; new insert => new person.
            is_new_user = False
            if user_identifier:
                participant = AIUsageParticipant(
                    hotel_id=hotel_id,
                    agent_type=agent_type,
                    usage_date=today,
                    user_hash=_hash_id(user_identifier),
                )
                s.add(participant)
                try:
                    await s.commit()
                    is_new_user = True
                except IntegrityError:
                    await s.rollback()  # already counted today

            # 2. Aggregate row — atomic increment; insert if the day's row is new.
            res = await s.execute(
                update(AIUsageDaily)
                .where(
                    AIUsageDaily.hotel_id == hotel_id,
                    AIUsageDaily.agent_type == agent_type,
                    AIUsageDaily.usage_date == today,
                )
                .values(
                    total_tokens=AIUsageDaily.total_tokens + tokens,
                    message_count=AIUsageDaily.message_count + 1,
                    unique_users=AIUsageDaily.unique_users + (1 if is_new_user else 0),
                    updated_at=utcnow(),
                )
            )
            if res.rowcount == 0:
                s.add(AIUsageDaily(
                    hotel_id=hotel_id,
                    agent_type=agent_type,
                    usage_date=today,
                    total_tokens=tokens,
                    message_count=1,
                    unique_users=1 if is_new_user else 0,
                ))
                try:
                    await s.commit()
                except IntegrityError:
                    # Lost the insert race — re-apply as an increment.
                    await s.rollback()
                    await s.execute(
                        update(AIUsageDaily)
                        .where(
                            AIUsageDaily.hotel_id == hotel_id,
                            AIUsageDaily.agent_type == agent_type,
                            AIUsageDaily.usage_date == today,
                        )
                        .values(
                            total_tokens=AIUsageDaily.total_tokens + tokens,
                            message_count=AIUsageDaily.message_count + 1,
                            unique_users=AIUsageDaily.unique_users + (1 if is_new_user else 0),
                            updated_at=utcnow(),
                        )
                    )
                    await s.commit()
            else:
                await s.commit()
    except Exception as exc:  # pragma: no cover - telemetry must never break a request
        logger.debug("persist_ai_usage_db failed for hotel %s agent %s: %s", hotel_id, agent_type, exc)


async def read_ai_usage_db(hotel_id: str, days: int) -> dict:
    """Read durable usage for the last `days` days, grouped by agent type.

    Returns {agent_type: {"daily_tokens": {iso_date: tokens}, "messages_today": n,
    "unique_users_today": n}} — the dashboard's source of truth.
    """
    from sqlmodel import select
    from datetime import timedelta
    from app.core.database import async_session
    from app.models.ai_usage import AIUsageDaily

    today = utcnow().date()
    start = today - timedelta(days=days - 1)
    agents = ("hotelier", "guest", "whatsapp")
    out = {
        a: {"daily_tokens": {(today - timedelta(days=i)).isoformat(): 0 for i in range(days)},
            "messages_today": 0, "unique_users_today": 0}
        for a in agents
    }

    async with async_session() as s:
        rows = (await s.execute(
            select(AIUsageDaily).where(
                AIUsageDaily.hotel_id == hotel_id,
                AIUsageDaily.usage_date >= start,
            )
        )).scalars().all()

    for row in rows:
        bucket = out.get(row.agent_type)
        if bucket is None:
            continue
        iso = row.usage_date.isoformat()
        if iso in bucket["daily_tokens"]:
            bucket["daily_tokens"][iso] = row.total_tokens
        if row.usage_date == today:
            bucket["messages_today"] = row.message_count
            bucket["unique_users_today"] = row.unique_users
    return out
