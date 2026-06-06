"""
AI-03: lightweight per-hotel LLM token-usage accounting.

There was previously zero visibility into per-tenant LLM spend, so a runaway
hotel (or an abuse spike) was undetectable and accurate billing impossible.
After each agent run we read the Agno RunResponse metrics and accumulate a
per-hotel, per-day token counter in Redis. This is best-effort and must never
break a request — all failures are swallowed.

Inspect usage with:  GET ai_tokens:{hotel_id}:{YYYYMMDD}
"""
from __future__ import annotations

import logging

from app.core.redis_client import redis_client
from app.core.time import utcnow

logger = logging.getLogger(__name__)

# Keep daily counters for ~5 weeks so monthly cost can be aggregated.
_TOKEN_KEY_TTL = 86400 * 35


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


def record_ai_usage(hotel_id: str, result) -> int:
    """Accumulate this run's token usage onto the hotel's daily counter.

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
        key = f"ai_tokens:{hotel_id}:{day}"
        new_total = r.incrby(key, tokens)
        if new_total == tokens:  # first write today -> set expiry
            r.expire(key, _TOKEN_KEY_TTL)
        return tokens
    except Exception as exc:  # pragma: no cover - telemetry must never break a request
        logger.debug("record_ai_usage failed for hotel %s: %s", hotel_id, exc)
        return 0
