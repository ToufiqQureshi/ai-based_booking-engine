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
        "pool_size": 20,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_pre_ping": True,
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

        # Run table migrations for new columns
        # hotels table columns:
        # feature_new_booking, feature_color_palette, feature_custom_logo, feature_custom_widget
        for col, col_type in [
            ("feature_new_booking", "BOOLEAN DEFAULT TRUE"),
            ("feature_color_palette", "BOOLEAN DEFAULT TRUE"),
            ("feature_custom_logo", "BOOLEAN DEFAULT TRUE"),
            ("feature_custom_widget", "BOOLEAN DEFAULT TRUE")
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE hotels ADD COLUMN {col} {col_type}"))
            except Exception:
                pass
        
        try:
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN cancellation_policy TEXT"))
        except Exception:
            pass

        for col, col_type in [
            ("cancellation_fee", "NUMERIC DEFAULT 0.00"),
            ("refund_amount", "NUMERIC DEFAULT 0.00"),
            ("refund_status", "VARCHAR(50) DEFAULT 'none'")
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
            except Exception:
                pass



async def get_session() -> AsyncSession:
    """
    Dependency injection ke liye session provide karta hai.
    FastAPI routes mein use hota hai.
    """
    async with async_session() as session:
        yield session
