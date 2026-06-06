"""
Database Configuration
SQLModel + Async SQLAlchemy setup.
Development mein SQLite, Production mein PostgreSQL use karo.
"""
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from app.core.config import get_settings

settings = get_settings()

is_sqlite = "sqlite" in settings.DATABASE_URL

if is_sqlite:
    connect_args = {"check_same_thread": False}
    engine_args = {"echo": False, "future": True}
else:
    connect_args = {
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
        "server_settings": {"jit": "off"}
    }
    engine_args = {
        "echo": False,
        "future": True,
        # DB-03: keep the per-worker pool small. 20+10 per worker exhausts
        # Supabase's pooler once you run multiple workers/replicas. Add
        # pool_recycle so connections behind the pooler/NAT don't go stale.
        "pool_size": 5,
        "max_overflow": 5,
        "pool_timeout": 30,
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_args
)


# Session factory - har request ke liye new session
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """
    Database tables create karta hai agar exist nahi karte.
    App startup par call hota hai.
    """
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Run table migrations for new columns in separate transaction blocks to avoid transaction aborts in PostgreSQL
    for col, col_type in [
        ("feature_new_booking", "BOOLEAN DEFAULT TRUE"),
        ("feature_color_palette", "BOOLEAN DEFAULT TRUE"),
        ("feature_custom_logo", "BOOLEAN DEFAULT TRUE"),
        ("feature_custom_widget", "BOOLEAN DEFAULT TRUE")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE hotels ADD COLUMN {col} {col_type}"))
        except Exception:
            pass
    
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN cancellation_policy TEXT"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN rate_plan_overrides JSON"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE hotels ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL"))
    except Exception:
        pass

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL"))
    except Exception:
        pass

    for col, col_type in [
        ("cancellation_fee", "NUMERIC DEFAULT 0.00"),
        ("refund_amount", "NUMERIC DEFAULT 0.00"),
        ("refund_status", "VARCHAR(50) DEFAULT 'none'")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
        except Exception:
            pass

    for col, col_type in [
        ("subtotal_amount", "NUMERIC DEFAULT 0.00"),
        ("tax_amount", "NUMERIC DEFAULT 0.00"),
        ("discount_amount", "NUMERIC DEFAULT 0.00"),
        ("tax_details", "JSON DEFAULT '{}'")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
        except Exception:
            pass

    for col, col_type in [
        ("transaction_id", "VARCHAR(255)"),
        ("reference_number", "VARCHAR(255)")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE payments ADD COLUMN {col} {col_type}"))
        except Exception:
            pass

    # SystemBroadcast scheduling + targeting columns
    # JSON DEFAULT must be cast for Postgres ('[]'::json), but SQLite tolerates plain '[]'.
    json_default = "'[]'::json" if not is_sqlite else "'[]'"
    for col, col_type in [
        ("scheduled_at", "TIMESTAMP"),
        ("expires_at", "TIMESTAMP"),
        ("is_published", "BOOLEAN DEFAULT TRUE"),
        ("target_plans", f"JSON DEFAULT {json_default}"),
        ("target_hotel_ids", f"JSON DEFAULT {json_default}"),
        ("created_by", "VARCHAR(255)"),
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE system_broadcasts ADD COLUMN {col} {col_type}"))
        except Exception:
            pass

    # Backfill any NULL values left over from a partial earlier ALTER attempt.
    for sql in [
        "UPDATE system_broadcasts SET is_published = TRUE WHERE is_published IS NULL",
        "UPDATE system_broadcasts SET target_plans = " + json_default + " WHERE target_plans IS NULL",
        "UPDATE system_broadcasts SET target_hotel_ids = " + json_default + " WHERE target_hotel_ids IS NULL",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception:
            pass

    # Auto-heal: Sync AI fields from hotels table to integration_settings table if missing or not set
    try:
        async with engine.begin() as conn:
            import secrets
            from datetime import datetime
            
            # Select all hotels that have an AI key set
            result = await conn.execute(
                text("SELECT id, ai_provider, ai_api_key, ai_model, ai_base_url, ai_max_tokens FROM hotels WHERE ai_api_key IS NOT NULL")
            )
            hotels_with_keys = result.fetchall()
            for row in hotels_with_keys:
                hotel_id, ai_prov, ai_key, ai_mod, ai_base, ai_max = row
                
                # Check if integration settings exist for this hotel
                sett_res = await conn.execute(
                    text("SELECT id, ai_api_key FROM integration_settings WHERE hotel_id = :h_id"),
                    {"h_id": hotel_id}
                )
                sett_row = sett_res.fetchone()
                
                if not sett_row:
                    # Create new IntegrationSettings row
                    new_id = secrets.token_urlsafe(8)
                    await conn.execute(
                        text(
                            "INSERT INTO integration_settings (id, hotel_id, ai_provider, ai_api_key, ai_model, ai_base_url, ai_max_tokens, created_at, updated_at) "
                            "VALUES (:id, :hotel_id, :ai_provider, :ai_api_key, :ai_model, :ai_base_url, :ai_max_tokens, :now, :now)"
                        ),
                        {
                            "id": new_id,
                            "hotel_id": hotel_id,
                            "ai_provider": ai_prov or "groq",
                            "ai_api_key": ai_key,
                            "ai_model": ai_mod or "llama-3.1-8b-instant",
                            "ai_base_url": ai_base,
                            "ai_max_tokens": ai_max,
                            "now": datetime.utcnow()
                        }
                    )
                else:
                    sett_id, sett_key = sett_row
                    if not sett_key:
                        # Update existing IntegrationSettings with hotel's AI config
                        await conn.execute(
                            text(
                                "UPDATE integration_settings SET "
                                "ai_provider = COALESCE(ai_provider, :ai_provider), "
                                "ai_api_key = :ai_api_key, "
                                "ai_model = COALESCE(ai_model, :ai_model), "
                                "ai_base_url = COALESCE(ai_base_url, :ai_base_url), "
                                "ai_max_tokens = COALESCE(ai_max_tokens, :ai_max_tokens), "
                                "updated_at = :now "
                                "WHERE id = :id"
                            ),
                            {
                                "id": sett_id,
                                "ai_provider": ai_prov or "groq",
                                "ai_api_key": ai_key,
                                "ai_model": ai_mod or "llama-3.1-8b-instant",
                                "ai_base_url": ai_base,
                                "ai_max_tokens": ai_max,
                                "now": datetime.utcnow()
                            }
                        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Database auto-heal for AI integration settings failed: {e}")



async def get_session() -> AsyncSession:
    """
    Dependency injection ke liye session provide karta hai.
    FastAPI routes mein use hota hai.
    """
    async with async_session() as session:
        yield session
