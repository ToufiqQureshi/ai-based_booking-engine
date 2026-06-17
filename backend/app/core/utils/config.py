from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List, Optional
import json


class Settings(BaseSettings):
    # App Info
    APP_NAME: str = "Staybooker API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False  # SECURITY: Default to False for production
    
    # Database - Supabase (Production Cloud)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/hotelier_hub"

    # Connection pool sizing (per worker). Keep
    # DB_POOL_SIZE * WEB_CONCURRENCY * replicas <= Supabase connection limit.
    # With WEB_CONCURRENCY=2 (default): 2 workers × (3 + 2) = 10 connections max.
    # Supabase free tier allows 60 direct connections — this stays well within.
    # Increase DB_POOL_SIZE in Railway env vars if you scale to more workers.
    DB_POOL_SIZE: int = 3
    DB_MAX_OVERFLOW: int = 2
    DB_POOL_RECYCLE: int = 1800   # recycle idle connections every 30 min
    DB_POOL_TIMEOUT: int = 10     # fail fast (was 30s) so requests don't pile up

    # Background scheduler (APScheduler). Runs periodic jobs (social-proof
    # refresh, subscription-expiry) guarded by a Redis lock so only one
    # worker/replica runs each tick. Disable with ENABLE_SCHEDULER=false.
    ENABLE_SCHEDULER: bool = True
    
    # Supabase Config
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: Optional[str] = None  # New: For Local Verification
    
    # JWT Configuration
    # Secret key must be provided via environment variable in production
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Public-booking anti-automation token (defence in depth on top of the
    # IP rate-limit + idempotency lock). The widget fetches a short-lived
    # HMAC token before submitting a booking. Enforcement is OFF by default so
    # the mechanism can ship + be verified in production before being gated on.
    BOOKING_TOKEN_REQUIRED: bool = False
    BOOKING_TOKEN_TTL_SECONDS: int = 1800
    
    # CORS - Parsed from JSON string in env
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8080",
        "https://staybooker.ai",
        "https://www.staybooker.ai",
        "https://app.staybooker.ai",
        "https://superadmin.staybooker.ai",
        "https://www.superadmin.staybooker.ai",
        "https://api.staybooker.ai",
        "https://staybooker.railway.app",
        "https://staybooker-production.up.railway.app"
    ]

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        if not v:
            return v
        # Fix postgres:// -> postgresql://
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        # Ensure asyncpg driver
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Ensure ssl=require for Supabase with asyncpg
        if "supabase.com" in v and "ssl=require" not in v:
            if "?" in v:
                v += "&ssl=require"
            else:
                v += "?ssl=require"
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    # Public URLs (for emails, widgets, etc.)
    API_URL: str = "https://api.staybooker.ai"
    FRONTEND_URL: str = "https://staybooker.ai"

    # AI Config
    OPENAI_API_KEY: str | None = None
    OLLAMA_API_KEY: str | None = None
    OLLAMA_HOST: str = "http://localhost:11434"
    GROQ_API_KEY: str | None = None
    JULES_API_KEY: str | None = None
    SCRAPINGBEE_API_KEY: Optional[str] = None  # Railway env var: SCRAPINGBEE_API_KEY


    # Central WhatsApp Config
    CENTRAL_WHATSAPP_PHONE_ID: Optional[str] = None
    CENTRAL_WHATSAPP_TOKEN: Optional[str] = None
    # Platform admin WhatsApp number for booking/cancellation alerts. Empty by
    # default = alerts disabled. The public booking flow has no logged-in admin,
    # so the recipient is a single configured platform number, not a user row.
    SUPER_ADMIN_WHATSAPP: Optional[str] = None

    # Email Service (Brevo)
    BREVO_API_KEY: str | None = None
    BREVO_SENDER_EMAIL: str = "noreply@staybooker.ai"
    BREVO_SENDER_NAME: str = "Staybooker"
    HOTEL_NOTIFICATION_EMAILS: str | None = None

    # Redis Configuration (Support for Railway REDIS_URL)
    REDIS_URL: Optional[str] = None
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    # After a Redis failure we serve from local memory for this many seconds
    # before transparently retrying. Kept short so a deploy-time DNS blip
    # (redis.railway.internal not yet resolvable) only degrades shared state —
    # rate limits, locks, AI usage counters — for a few seconds, not minutes.
    REDIS_RETRY_COOLDOWN_SECONDS: int = 20

    # Number of trusted reverse proxies in front of the app. Used to pick the
    # real client IP from X-Forwarded-For instead of trusting the spoofable
    # left-most hop, so IP rate limits cannot be defeated by rotating a fake
    # X-Forwarded-For header.
    #
    # How to size this for YOUR deployment:
    #   * Railway only (no extra proxy):                 1  (Railway's edge)
    #   * Cloudflare proxy → Railway (orange-cloud DNS): 2
    # To verify: hit an endpoint and log request.headers["X-Forwarded-For"];
    # the number of comma-separated IPs == the number of proxies in front.
    # Default is 1 (Railway always adds one hop) — strictly safer than the old
    # spoofable default of 0. Override via the TRUSTED_PROXY_COUNT env var.
    TRUSTED_PROXY_COUNT: int = 1

    # Razorpay Payment Gateway
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    # Webhook secret for verifying X-Razorpay-Signature on incoming webhooks.
    # Configure this in the Razorpay Dashboard → Webhooks → "Secret" field.
    # NEVER reuse RAZORPAY_KEY_SECRET for this — it is a separate signing key.
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # Sentry Error Monitoring
    SENTRY_DSN: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Master Admin Emails - comma separated list. These get auto-promoted to SUPER_ADMIN.
    # Empty by default; must be set explicitly via env (MASTER_ADMIN_EMAILS=a@x.com,b@y.com).
    MASTER_ADMIN_EMAILS: str = ""


    # WhatsApp Meta webhook verification
    WHATSAPP_VERIFY_TOKEN: Optional[str] = None
    WHATSAPP_APP_SECRET: Optional[str] = None  # For HMAC signature verification

    @field_validator("MASTER_ADMIN_EMAILS", mode="before")
    @classmethod
    def normalize_admin_emails(cls, v) -> str:
        if v is None:
            return ""
        if isinstance(v, list):
            return ",".join(v)
        return str(v)

    @property
    def master_admin_email_set(self) -> set[str]:
        if not self.MASTER_ADMIN_EMAILS:
            return set()
        return {
            e.strip().lower()
            for e in self.MASTER_ADMIN_EMAILS.split(",")
            if e.strip()
        }

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """
    Settings ko cache karta hai taaki bar bar load na ho.
    """
    return Settings()
