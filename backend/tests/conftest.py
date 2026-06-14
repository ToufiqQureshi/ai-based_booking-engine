"""
Test configuration and shared fixtures.

Design decisions:
- Dependency override for auth: avoids JWT/Supabase complexity in tests.
- Session-scoped hotel+user: created once, shared across all tests.
- Function-scoped mutable fixtures (rooms, rate plans): isolated per test.
"""
import os
import sys
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

# Set env vars BEFORE importing any app modules
os.environ.setdefault("SECRET_KEY", "TEST_SECRET_KEY_32_CHARS_MINIMUM_!")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import engine
from app.brand_console.hotel import Hotel
from app.guests.user import User, UserRole
from app.rooms.room import RoomType
from app.rate_plans.rates_model import RatePlan
from main import app

# Register models that the app imports lazily (inside functions, per the
# performance rules) so their tables are present in SQLModel.metadata before
# create_all() runs. Without these imports the in-memory test DB is missing
# tables like ai_usage_daily / analytics_sessions / subscriptions.
from app.analytics.models import AnalyticsSession, AnalyticsEvent  # noqa: E402,F401
from app.ai_assistant.ai_usage import AIUsageDaily, AIUsageParticipant  # noqa: E402,F401
from app.superadmin.subscriptions.subscription import Subscription  # noqa: E402,F401
from app.superadmin.chains.chain import Chain  # noqa: E402,F401
from app.system.audit import AuditLog, SystemBroadcast  # noqa: E402,F401
from app.bookings.booking import Booking  # noqa: E402,F401
from app.loyalty.loyalty_model import LoyaltyProgram, GuestLoyalty  # noqa: E402,F401


# ---------------------------------------------------------------------------
# DB initialisation (session-scoped)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


# ---------------------------------------------------------------------------
# Seeded hotel + user (created once per session)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(scope="session")
async def seeded_hotel() -> Hotel:
    """One hotel shared across all tests."""
    hotel = Hotel(
        id=str(uuid.uuid4()),
        name="Pytest Grand Hotel",
        slug=f"pytest-hotel-{uuid.uuid4().hex[:8]}",
        description="Hotel used by automated test suite",
    )
    async with AsyncSession(engine) as session:
        session.add(hotel)
        await session.commit()
        await session.refresh(hotel)
    return hotel


@pytest_asyncio.fixture(scope="session")
async def seeded_user(seeded_hotel: Hotel) -> User:
    """One owner user linked to seeded_hotel, shared across all tests."""
    user = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-owner-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Pytest Owner",
        role=UserRole.OWNER,
        hotel_id=seeded_hotel.id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# HTTP clients
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """Unauthenticated HTTP client."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_client(seeded_user: User) -> AsyncClient:
    """
    Authenticated HTTP client.
    Uses FastAPI dependency override so no real JWT/Supabase needed.
    """
    from app.core.deps import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: seeded_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_current_active_user, None)


@pytest_asyncio.fixture
async def super_admin_client(seeded_hotel: Hotel) -> AsyncClient:
    """Authenticated client with SUPER_ADMIN role."""
    admin = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-admin-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Pytest Admin",
        role=UserRole.SUPER_ADMIN,
        hotel_id=seeded_hotel.id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(admin)
        await session.commit()
        await session.refresh(admin)

    from app.core.deps import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: admin
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_current_active_user, None)


# ---------------------------------------------------------------------------
# Reusable resource fixtures (function-scoped — fresh per test)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def seeded_room(seeded_hotel: Hotel) -> RoomType:
    """A real RoomType in DB, deleted after each test."""
    room = RoomType(
        id=str(uuid.uuid4()),
        hotel_id=seeded_hotel.id,
        name=f"Test Room {uuid.uuid4().hex[:6]}",
        base_price=2500.0,
        total_inventory=5,
        base_occupancy=2,
        max_occupancy=3,
        max_children=1,
    )
    async with AsyncSession(engine) as session:
        session.add(room)
        await session.commit()
        await session.refresh(room)
    yield room
    async with AsyncSession(engine) as session:
        obj = await session.get(RoomType, room.id)
        if obj:
            await session.delete(obj)
            await session.commit()


@pytest_asyncio.fixture
async def seeded_rate_plan(seeded_hotel: Hotel) -> RatePlan:
    """A real RatePlan in DB, deleted after each test."""
    plan = RatePlan(
        id=str(uuid.uuid4()),
        hotel_id=seeded_hotel.id,
        name=f"Test Plan {uuid.uuid4().hex[:6]}",
        meal_plan="EP",
        is_refundable=True,
        cancellation_hours=24,
        price_adjustment=0.0,
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(plan)
        await session.commit()
        await session.refresh(plan)
    yield plan
    async with AsyncSession(engine) as session:
        obj = await session.get(RatePlan, plan.id)
        if obj:
            await session.delete(obj)
            await session.commit()
