import os
import sys
import asyncio
import pytest
from typing import AsyncGenerator, Any
from httpx import AsyncClient

# Set env vars BEFORE importing any app modules
os.environ["SECRET_KEY"] = "TEST_SECRET_KEY_FOR_SMOKE_TESTING"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = ""

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlmodel import SQLModel
from app.core.database import engine
from main import app

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    policy = asyncio.get_event_loop_policy()
    res_loop = policy.new_event_loop()
    yield res_loop
    res_loop.close()

import pytest_asyncio

@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Initialize database tables for testing."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[any, None]:
    """Test client fixture."""
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """
    Authenticated test client fixture.
    Mocks a logged-in hotelier user.
    """
    from jose import jwt
    from app.core.config import get_settings
    settings = get_settings()

    from app.models.user import UserRole
    # Mock payload that would normally come from Supabase
    payload = {
        "sub": "00000000-0000-0000-0000-000000000000",
        "email": "test@staybooker.ai",
        "role": UserRole.OWNER,
        "type": "access"
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
