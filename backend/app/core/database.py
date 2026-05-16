"""
Database Configuration
SQLModel + Async SQLAlchemy setup.
Development mein SQLite, Production mein PostgreSQL use karo.
"""
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

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


async def get_session() -> AsyncSession:
    """
    Dependency injection ke liye session provide karta hai.
    FastAPI routes mein use hota hai.
    """
    async with async_session() as session:
        yield session
