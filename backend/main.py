"""
Main Application Entry Point
FastAPI app initialization with all routers.
Production-ready with CORS, lifespan events, security headers.
"""
from contextlib import asynccontextmanager
import sys
import asyncio
import logging

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Windows specific: Fix asyncio loop policy
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.core.limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded

# Import routers
from app.api.v1 import auth, users, hotels, rooms, bookings, dashboard, rates, payments, availability, reports, public, integration, upload, addons, channel_manager, amenities, properties, competitors, admin, agent, promos, notifications, analytics



settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup aur shutdown events handle karta hai.
    Database tables create hote hain startup par.
    """
    # Startup: Database initialize karo
    logger.info("Starting Hotelier Hub API...")
    await init_db()
    logger.info("Database initialized successfully!")
    yield
    # Shutdown: Cleanup if needed
    logger.info("Shutting down...")


# FastAPI app create karo
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-tenant Hotel Management API",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


from app.core.exceptions import global_exception_handler

# Connect Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

# CORS Middleware - Frontend ko allow karna hai
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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


# Cache-Control middleware for performance
@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # Cacheable read-only endpoints (60 seconds)
    cacheable_prefixes = [
        "/api/v1/dashboard",
        "/api/v1/rooms",
        "/api/v1/reports",
        "/api/v1/analytics",
        "/api/v1/amenities",
    ]
    is_cacheable = any(path.startswith(p) for p in cacheable_prefixes)

    if request.method == "GET" and is_cacheable and response.status_code == 200:
        response.headers["Cache-Control"] = "private, max-age=60"
    elif path.startswith("/api/v1/auth") or path.startswith("/api/v1/users"):
        response.headers["Cache-Control"] = "no-store"

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


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root - basic info"""
    return {
        "message": "Welcome to Hotelier Hub API",
        "docs": "/docs",
        "version": settings.APP_VERSION
    }
