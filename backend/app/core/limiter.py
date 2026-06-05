"""
Rate Limiter Configuration
Uses slowapi/limits to prevent brute-force attacks.
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

from app.core.config import get_settings

def get_real_ip(request: Request) -> str:
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

# RL-1: back the limiter with Redis when available so limits are shared across
# workers/instances instead of being per-process in-memory (which resets on
# restart and is trivially defeated by horizontal scaling).
_settings = get_settings()
_storage_uri = _settings.REDIS_URL or None

# Initialize limiter with remote address key
limiter = Limiter(key_func=get_real_ip, storage_uri=_storage_uri)
