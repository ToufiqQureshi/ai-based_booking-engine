"""
Per-hotel accounting for ScrapingBee API requests.

We buy this scraping capability from ScrapingBee and surface it to hoteliers
as the OTA Analytics / Rate Shopper feature. Every request costs credits
(premium_proxy + JS rendering = 25 credits each). Without visibility, a chatty
hotel or a scraper bug is invisible until the bill arrives.

Mirrors the pattern in `app.core.ai_usage`: best-effort Redis daily counters
that must never break a request — all failures are swallowed.

Inspect with:  GET scrapingbee_requests:{hotel_id}:{YYYYMMDD}
"""
from __future__ import annotations

import logging
from datetime import timedelta

from app.core.redis_client import redis_client
from app.core.time import utcnow

logger = logging.getLogger(__name__)

# Keep daily counters for ~5 weeks so monthly usage can be reviewed.
_USAGE_KEY_TTL = 86400 * 35


def record_scrapingbee_request(hotel_id: str, count: int = 1) -> None:
    """Increment today's ScrapingBee request counter for a hotel. Never raises."""
    try:
        if not hotel_id or count <= 0:
            return
        r = redis_client.get_instance()
        if not r:
            return
        day = utcnow().strftime("%Y%m%d")
        key = f"scrapingbee_requests:{hotel_id}:{day}"
        new_total = r.incrby(key, count)
        if new_total == count:  # first write today → set expiry
            r.expire(key, _USAGE_KEY_TTL)
    except Exception as exc:
        logger.debug("record_scrapingbee_request failed for hotel %s: %s", hotel_id, exc)


def get_usage_summary(hotel_id: str, days: int = 30) -> dict:
    """
    Return a hotelier-facing summary of ScrapingBee usage: today's count,
    a rolling N-day total, and a daily breakdown (oldest → newest).
    Best-effort — returns zeros if Redis is unavailable.
    """
    empty = {"today": 0, "last_30_days": 0, "daily": []}
    try:
        if not hotel_id:
            return empty
        r = redis_client.get_instance()
        if not r:
            return empty

        today = utcnow().date()
        days = max(1, min(days, 90))
        dates = [today - timedelta(days=i) for i in range(days)]
        keys = [f"scrapingbee_requests:{hotel_id}:{d.strftime('%Y%m%d')}" for d in dates]

        values = r.mget(keys)
        daily = []
        total = 0
        for d, raw in zip(dates, values):
            n = int(raw) if raw else 0
            total += n
            daily.append({"date": d.isoformat(), "requests": n})

        return {
            "today": daily[0]["requests"] if daily else 0,
            "last_30_days": total,
            "daily": list(reversed(daily)),  # oldest → newest for charting
        }
    except Exception as exc:
        logger.debug("get_usage_summary failed for hotel %s: %s", hotel_id, exc)
        return empty
