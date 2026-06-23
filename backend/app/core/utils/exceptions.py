import re
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

# Mirrors the allow_origins/allow_origin_regex configured on CORSMiddleware in
# main.py. A response built by a handler registered for the base `Exception`
# class is emitted by Starlette's ServerErrorMiddleware, which wraps OUTSIDE
# CORSMiddleware — so it never gets CORS headers applied automatically. Every
# unhandled exception therefore surfaced to the browser as an opaque "blocked
# by CORS policy" error instead of the real 500, hiding the actual failure.
# We add the headers here directly so the frontend can read the real error.
_PAGES_DEV_REGEX = re.compile(r"https://([a-zA-Z0-9-]+\.)?(staybooker|ai-based-booking-engine)\.pages\.dev")


def _resolve_cors_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if not origin:
        return None
    from app.core.utils.config import get_settings
    settings = get_settings()
    allowed = set(settings.CORS_ORIGINS) | {
        "https://staybooker.ai", "https://www.staybooker.ai",
        "https://superadmin.staybooker.ai", "https://www.superadmin.staybooker.ai",
        "https://app.staybooker.ai", "https://www.app.staybooker.ai",
    }
    if origin in allowed or _PAGES_DEV_REGEX.fullmatch(origin):
        return origin
    return None


async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global Exception: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later.", "type": "server_error"},
    )
    allowed_origin = _resolve_cors_origin(request)
    if allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response
