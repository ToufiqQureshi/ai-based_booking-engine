"""
Rate Limiter Configuration
Uses slowapi/limits to prevent brute-force attacks.
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

from app.core.utils.config import get_settings

def get_real_ip(request: Request) -> str:
    # RL-2: X-Forwarded-For is "client, proxy1, proxy2, ...". The left-most entry
    # is client-supplied and trivially spoofable, so trusting it lets an attacker
    # dodge IP rate limits by rotating a fake header. When TRUSTED_PROXY_COUNT is
    # configured we instead take the entry added by our own outermost trusted
    # proxy (the real client as that proxy saw it). Default 0 = legacy behavior.
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
        if parts:
            trusted = max(0, get_settings().TRUSTED_PROXY_COUNT)
            if trusted > 0 and len(parts) > trusted:
                # The right-most `trusted` entries were appended by our proxies;
                # the client IP is the one immediately to their left.
                return parts[-(trusted + 1)]
            return parts[0]
    return request.client.host if request.client else "127.0.0.1"

# RL-1: back the limiter with Redis when available so limits are shared across
# workers/instances instead of being per-process in-memory (which resets on
# restart and is trivially defeated by horizontal scaling).
_settings = get_settings()
_storage_uri = _settings.REDIS_URL or None

# Initialize limiter with remote address key
limiter = Limiter(key_func=get_real_ip, storage_uri=_storage_uri)
