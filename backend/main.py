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

_log_level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=_log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.utils.config import get_settings
from app.core.db.database import init_db
from app.core.utils.limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded

# Import routers from the new structure
from app.auth import auth
from app.guests import users
from app.brand_console import hotels, properties, leads
from app.rooms import rooms, amenities
from app.bookings import bookings
from app.dashboard import dashboard, notifications
from app.rate_plans import rates, promos
from app.payments import payments
from app.calendar import router as availability_router
from app.analytics import reports
from app.guest_booking import router as public_router
from app.integration import router as integration_router
from app.system import upload, admin
from app.experiences import addons
from app.channel_manager import channel_manager
from app.ai_assistant import agent
from app.superadmin import router as superadmin_router
from app.marketing import google_ads
from app.loyalty import loyalty
from app.revenue import pricing as revenue_pricing
from app.revenue import recovery as revenue_recovery
from app.rate_shopper import competitors

from app.analytics.reports import router as analytics_router
from app.analytics.analytics import router as analytics_api_router
from app.analytics.public_report import router as public_report_router
from app.google_reviews.social_proof import router as social_proof_router
from app.guest_booking import sse as public_sse
from app.superadmin.chains.dashboard import router as chain_router
from app.system.ws import router as ws_router

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Staybooker API...")
    try:
        await init_db()
        logger.info("Database initialized successfully!")
    except Exception as e:
        logger.error(f"CRITICAL: Database connection failed during startup: {e}")

    if settings.ENABLE_SCHEDULER:
        try:
            from app.core.utils.scheduler import start_scheduler
            start_scheduler()
        except Exception as e:
            logger.error(f"Scheduler failed to start: {e}")

    yield

    try:
        from app.core.utils.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass
    logger.info("Shutting down...")

if settings.SENTRY_DSN:
    def _scrub_sentry_event(event, hint):
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
        send_default_pii=False,
        before_send=_scrub_sentry_event,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant Hotel Management API",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)

from app.core.utils.exceptions import global_exception_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

allowed_origins = list(settings.CORS_ORIGINS)
extra_origins = [
    "https://staybooker.ai",
    "https://www.staybooker.ai",
    "https://superadmin.staybooker.ai",
    "https://www.superadmin.staybooker.ai",
    "https://app.staybooker.ai",
    "https://www.app.staybooker.ai"
]
for origin in extra_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Cloudflare Pages serves previews on *.ai-based-booking-engine.pages.dev
    # (the project name), not *.staybooker.pages.dev — the old regex never
    # matched, so every PR-preview API call was blocked by CORS and login
    # failed. Allow both the production-style and the actual project domain.
    allow_origin_regex=r"https://([a-zA-Z0-9-]+\.)?(staybooker|ai-based-booking-engine)\.pages\.dev",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}

@app.get("/sentry-debug")
async def trigger_error():
    if not settings.DEBUG:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
    division_by_zero = 1 / 0
    return {"message": "Hello World"}

@app.middleware("http")
async def add_security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"

    if path.startswith("/api/v1"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    return response

API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(hotels.router, prefix=API_V1_PREFIX)
app.include_router(rooms.router, prefix=API_V1_PREFIX)
app.include_router(bookings.router, prefix=API_V1_PREFIX)
app.include_router(dashboard.router, prefix=API_V1_PREFIX)
app.include_router(rates.router, prefix=API_V1_PREFIX)
app.include_router(payments.router, prefix=API_V1_PREFIX)
app.include_router(availability_router, prefix=API_V1_PREFIX)
app.include_router(reports.router, prefix=API_V1_PREFIX)
app.include_router(public_router, prefix=API_V1_PREFIX)
app.include_router(superadmin_router, prefix=API_V1_PREFIX)
app.include_router(integration_router, prefix=API_V1_PREFIX)
app.include_router(upload.router, prefix=API_V1_PREFIX)
app.include_router(addons.router, prefix=API_V1_PREFIX)
app.include_router(channel_manager.router, prefix=API_V1_PREFIX)
app.include_router(amenities.router, prefix=API_V1_PREFIX)
app.include_router(properties.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)
app.include_router(agent.router, prefix=API_V1_PREFIX, tags=["AI Agent"])
app.include_router(promos.router, prefix=API_V1_PREFIX + "/promos", tags=["Promos"])
app.include_router(notifications.router, prefix=API_V1_PREFIX, tags=["Notifications"])
app.include_router(analytics_router, prefix=API_V1_PREFIX + "/analytics", tags=["Analytics"])
app.include_router(analytics_api_router, prefix=API_V1_PREFIX, tags=["Analytics"])
app.include_router(public_report_router, prefix=API_V1_PREFIX, tags=["Public Report"])
app.include_router(leads.router, prefix=API_V1_PREFIX + "/leads", tags=["Leads"])
app.include_router(google_ads.router, prefix=API_V1_PREFIX)

app.include_router(loyalty.router, prefix=API_V1_PREFIX + "/loyalty", tags=["Loyalty"])
app.include_router(revenue_pricing.router, prefix=API_V1_PREFIX + "/revenue/pricing-rules", tags=["Revenue - Dynamic Pricing"])
app.include_router(revenue_recovery.router, prefix=API_V1_PREFIX + "/revenue/recovery", tags=["Revenue - Recovery"])
app.include_router(social_proof_router, prefix=API_V1_PREFIX)
app.include_router(public_sse.router, prefix=API_V1_PREFIX)
app.include_router(chain_router, prefix=API_V1_PREFIX)
app.include_router(ws_router, prefix=API_V1_PREFIX)
app.include_router(competitors.router, prefix=API_V1_PREFIX)

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to Staybooker API",
        "docs": "/docs",
        "version": settings.APP_VERSION
    }
