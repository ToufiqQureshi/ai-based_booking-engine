"""
Shared helper for bumping the SSE rate_version signal.
Stores both the version timestamp and (optionally) which room_type changed,
so the public booking page can refresh only the affected room's prices
instead of doing a full page reload.
"""
import time
import logging
from app.core.cache.redis_client import redis_client

logger = logging.getLogger(__name__)


def bump_rate_version(hotel_id: str, room_type_id: str | None = None) -> None:
    """
    Signal the SSE stream that prices changed.
    - room_type_id: specific room that changed. None = all rooms (bulk op, rate plan change).
    """
    try:
        redis_client.set_value(f"rate_version:{hotel_id}", str(int(time.time())), expire=86400)
        # Store which room changed with a short TTL so SSE can pick it up within 2s.
        value = room_type_id if room_type_id else "ALL"
        redis_client.set_value(f"rate_changed_room:{hotel_id}", value, expire=10)
    except Exception:
        pass


def bump_hotel_version(hotel_id: str) -> None:
    """
    Signal the SSE stream that hotel configuration (settings, addons, room metadata) changed.
    Triggers a full refresh of hotel info on the booking page.
    """
    try:
        redis_client.set_value(f"hotel_version:{hotel_id}", str(int(time.time())), expire=86400)
    except Exception:
        pass
