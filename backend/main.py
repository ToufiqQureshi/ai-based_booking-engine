"""
Main Application Entry Point
FastAPI app initialization with all routers.
Production-ready with CORS, lifespan events, security headers.
"""
from contextlib import asynccontextmanager
import sys
import os
import asyncio
import logging

# Configure structured logging. LOG-02: level is configurable via LOG_LEVEL
# (default INFO) so production can run at WARNING to reduce PII in logs and
# log-egress cost without a code change.
_log_level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=_log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Windows specific: Fix asyncio loop policy
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.core.limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded

# Import routers
from app.api.v1 import auth, users, hotels, rooms, bookings, dashboard, rates, payments, availability, reports, public, integration, upload, addons, channel_manager, amenities, properties, competitors, admin, agent, promos, notifications, analytics, leads, superadmin, google_ads, loyalty
from app.api.v1.social_proof import router as social_proof_router
from app.api.v1.public import sse as public_sse
from app.api.v1.chain.dashboard import router as chain_router



settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup aur shutdown events handle karta hai.
    Database tables create hote hain startup par.
    """
    # Startup: Database initialize karo
    logger.info("Starting Staybooker API...")
    try:
        await init_db()
        logger.info("Database initialized successfully!")
    except Exception as e:
        logger.error(f"CRITICAL: Database connection failed during startup: {e}")
        # We don't re-raise here so the app can at least boot and serve /health
        # If it crashes here, Railway gives 502 Bad Gateway.
    yield
    # Shutdown: Cleanup if needed
    logger.info("Shutting down...")


# Initialize Sentry SDK if DSN is provided
if settings.SENTRY_DSN:
    def _scrub_sentry_event(event, hint):
        """LOG-01: strip secrets/PII before events leave for Sentry.

        Request bodies (incl. integration payloads with raw API/payment keys)
        and Authorization headers can otherwise be shipped to a third party.
        """
        try:
            req = event.get("request") or {}
            headers = req.get("headers") or {}
            for h in list(headers):
                if h.lower() in ("authorization", "cookie", "x-api-key"):
                    headers[h] = "[scrubbed]"
            if "data" in req:
                req["data"] = "[scrubbed]"
        except Exception:
            pass
        return event

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        send_default_pii=False,  # do not attach user PII/IP/cookies by default
        before_send=_scrub_sentry_event,
        traces_sample_rate=0.1,  # 10% in production — 1.0 causes performance overhead
        profiles_sample_rate=0.1,
    )

# FastAPI app create karo
# INF-06: only expose the interactive API docs in DEBUG. In production the
# full API surface should not be publicly enumerable.
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant Hotel Management API",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)


from app.core.exceptions import global_exception_handler

# Connect Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Prepare CORS Origins (Settings + SuperAdmin subdomains)
allowed_origins = list(settings.CORS_ORIGINS)
extra_origins = [
    "https://superadmin.staybooker.ai",
    "https://www.superadmin.staybooker.ai"
]
for origin in extra_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)



# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Server health check"""
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/sentry-debug")
async def trigger_error():
    if not settings.DEBUG:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
    division_by_zero = 1 / 0
    return {"message": "Hello World"}


# Cache-Control and Advanced Enterprise Security Headers middleware
@app.middleware("http")
async def add_security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # Security Headers (OWASP Recommended)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"

    # Disable browser-side caching for all API endpoints to prevent stale data / tenant leakage on property switch.
    # Backend-side caching is still handled via @cache_response decorators.
    if path.startswith("/api/v1"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    return response


# API Version 1 routers include karo
API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(hotels.router, prefix=API_V1_PREFIX)
app.include_router(rooms.router, prefix=API_V1_PREFIX)
app.include_router(bookings.router, prefix=API_V1_PREFIX)
app.include_router(dashboard.router, prefix=API_V1_PREFIX)
app.include_router(rates.router, prefix=API_V1_PREFIX)
app.include_router(payments.router, prefix=API_V1_PREFIX)
app.include_router(availability.router, prefix=API_V1_PREFIX)
app.include_router(reports.router, prefix=API_V1_PREFIX)
app.include_router(public.router, prefix=API_V1_PREFIX)
app.include_router(integration.router, prefix=API_V1_PREFIX)
app.include_router(upload.router, prefix=API_V1_PREFIX)
app.include_router(addons.router, prefix=API_V1_PREFIX)
app.include_router(channel_manager.router, prefix=API_V1_PREFIX)
app.include_router(amenities.router, prefix=API_V1_PREFIX)
app.include_router(properties.router, prefix=API_V1_PREFIX)
app.include_router(competitors.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)
app.include_router(agent.router, prefix=API_V1_PREFIX, tags=["AI Agent"])
app.include_router(promos.router, prefix=API_V1_PREFIX + "/promos", tags=["Promos"])
app.include_router(notifications.router, prefix=API_V1_PREFIX, tags=["Notifications"])
app.include_router(analytics.router, prefix=API_V1_PREFIX + "/analytics", tags=["Analytics"])
app.include_router(leads.router, prefix=API_V1_PREFIX + "/leads", tags=["Leads"])
app.include_router(google_ads.router, prefix=API_V1_PREFIX)
app.include_router(superadmin.router, prefix=API_V1_PREFIX)
app.include_router(loyalty.router, prefix=API_V1_PREFIX + "/loyalty", tags=["Loyalty"])
app.include_router(social_proof_router, prefix=API_V1_PREFIX)
app.include_router(public_sse.router, prefix=API_V1_PREFIX)
app.include_router(chain_router, prefix=API_V1_PREFIX)


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root - basic info"""
    return {
        "message": "Welcome to Staybooker API",
        "docs": "/docs",
        "version": settings.APP_VERSION
    }
