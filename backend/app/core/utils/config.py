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
    #
    # We connect through the Supabase transaction pooler (pgbouncer on :6543,
    # statement cache disabled), so the Postgres backend limit (60) is shared via
    # multiplexing — the client pool does not map 1:1 to backend connections.
    # The previous 3+2 (=5/worker) was far too small: on a single page load the
    # frontend fires several authed requests at once (dashboard stats, users/me,
    # notifications poll, integration settings) and every one checks out a
    # connection via get_current_user. With only 5, requests queued past the 10s
    # pool_timeout and threw "QueuePool limit ... connection timed out", which
    # surfaced to users as generic "could not load" errors on every page.
    #
    # 10+10 (=20/worker) gives ~4x headroom. With WEB_CONCURRENCY=2 that is 40,
    # plus Supabase's own internal connections (~10) — still under the 60 cap.
    # If you scale to >2 workers/replicas, lower these via Railway env vars to
    # keep DB_POOL_SIZE * WEB_CONCURRENCY * replicas <= 60.
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 1800   # recycle idle connections every 30 min
    DB_POOL_TIMEOUT: int = 10     # fail fast (was 30s) so requests don't pile up

    # Hard cap (seconds) for resuming a paused human-in-the-loop AI action
    # (/agent/chat/confirm). aget_run_output + acontinue_run hit the DB and the
    # LLM, so a stuck provider must not hold the request open indefinitely.
    AI_CONFIRM_TIMEOUT_SECONDS: int = 60

    # DoS / runaway-agent guards (CLAUDE.md §4). A jailbroken or looping prompt
    # must not be able to hammer the DB via unbounded tool calls.
    AI_TOOL_CALL_LIMIT: int = 8               # max tool calls per agent run
    AI_MAX_TOOL_CALLS_FROM_HISTORY: int = 3   # cap replayed tool results in context
    AI_MAX_MESSAGE_CHARS: int = 8000          # reject oversized prompts (token-bomb)

    # Background scheduler (APScheduler). Runs periodic jobs (social-proof
    # refresh, subscription-expiry) guarded by a Redis lock so only one
    # worker/replica runs each tick. Disable with ENABLE_SCHEDULER=false.
    ENABLE_SCHEDULER: bool = True
    
    # Optional MaxMind GeoLite2-City DB for visitor city resolution. Only used
    # as a fallback when Cloudflare visitor-location headers are absent. Leave
    # empty in environments fronted by Cloudflare (the primary, free source).
    GEOIP_DB_PATH: str = ""

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
    
    # CORS - Parsed from JSON string in env. Single source of truth: main.py's
    # CORSMiddleware and the global exception handler both read these two
    # settings — never hardcode origins anywhere else.
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8080",
        "https://staybooker.ai",
        "https://www.staybooker.ai",
        "https://app.staybooker.ai",
        "https://www.app.staybooker.ai",
        "https://superadmin.staybooker.ai",
        "https://www.superadmin.staybooker.ai",
        "https://api.staybooker.ai",
        "https://staybooker.railway.app",
        "https://staybooker-production.up.railway.app"
    ]
    # Cloudflare Pages serves previews on *.ai-based-booking-engine.pages.dev
    # (the project name) as well as the production-style staybooker domain.
    CORS_ORIGIN_REGEX: str = r"https://([a-zA-Z0-9-]+\.)?(staybooker|ai-based-booking-engine)\.pages\.dev"

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
    # One Graph API version for every Meta call — the codebase previously mixed
    # v17/v19/v21, so senders aged out at different times. v25.0 is current (2026-07).
    META_GRAPH_API_VERSION: str = "v25.0"
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
