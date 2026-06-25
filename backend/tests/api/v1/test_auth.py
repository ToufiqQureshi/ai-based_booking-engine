"""
Auth Endpoint Tests
Covers:
  - POST /auth/onboarding — unauthenticated rejected (401)
  - POST /auth/onboarding — new user creates hotel, links user, returns shape
  - POST /auth/onboarding — user with existing hotel_id updates hotel name
  - POST /auth/onboarding — slug collision resolved with UUID suffix (no crash)
  - POST /auth/onboarding — invalid payload rejected (422)
"""
import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.guests.user import User, UserRole

pytestmark = pytest.mark.asyncio

_ONBOARDING_URL = "/api/v1/auth/onboarding"


@pytest.fixture
async def fresh_user(seeded_hotel: Hotel):
    """A user with no hotel_id — simulates a newly registered user at onboarding."""
    from tests.conftest import engine
    user = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-fresh-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Fresh User",
        role=UserRole.OWNER,
        hotel_id=None,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


@pytest.fixture
async def onboarding_client(fresh_user: User):
    """Client authenticated as a hotel-less user (uses get_current_user dep, not active)."""
    from main import app
    from app.core.auth.deps import get_current_user

    app.dependency_overrides[get_current_user] = lambda: fresh_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def returning_client():
    """Client authenticated as a user who already has a hotel_id (update path).

    Uses a dedicated fresh hotel so seeded_hotel is not mutated by the onboarding update.
    The override reloads the user from a fresh session on each request to avoid
    DetachedInstanceError when the endpoint refreshes the user object.
    """
    from tests.conftest import engine
    from main import app
    from app.core.auth.deps import get_current_user

    fresh_hotel_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    fresh_hotel = Hotel(
        id=fresh_hotel_id,
        name="Returning Test Hotel",
        slug=f"returning-hotel-{uuid.uuid4().hex[:6]}",
    )
    user = User(
        id=user_id,
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-returning-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Returning User",
        role=UserRole.OWNER,
        hotel_id=fresh_hotel_id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(fresh_hotel)
        session.add(user)
        await session.commit()

    async def _get_live_user():
        async with AsyncSession(engine) as s:
            return await s.get(User, user_id)

    app.dependency_overrides[get_current_user] = _get_live_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_current_user, None)


# ─── Unauthenticated ──────────────────────────────────────────────────────────

class TestOnboardingAuth:
    async def test_unauthenticated_request_rejected(self, client: AsyncClient):
        """No auth token must yield 401, not 500 or 200."""
        r = await client.post(_ONBOARDING_URL, json={
            "name": "Test User",
            "hotel_name": "Test Hotel",
        })
        assert r.status_code == 401


# ─── New user — creates hotel ─────────────────────────────────────────────────

class TestOnboardingNewUser:
    async def test_creates_hotel_and_returns_shape(self, onboarding_client: AsyncClient):
        """Fresh user triggers hotel creation; response contains message + user + hotel."""
        r = await onboarding_client.post(_ONBOARDING_URL, json={
            "name": "Pytest Owner",
            "hotel_name": f"Brand New Hotel {uuid.uuid4().hex[:4]}",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["message"] == "Onboarding completed successfully"
        assert "user" in data
        assert "hotel" in data

    async def test_returned_hotel_has_expected_fields(self, onboarding_client: AsyncClient):
        r = await onboarding_client.post(_ONBOARDING_URL, json={
            "name": "Pytest Owner",
            "hotel_name": f"Shape Check Hotel {uuid.uuid4().hex[:4]}",
        })
        assert r.status_code == 200
        hotel = r.json()["hotel"]
        assert "id" in hotel
        assert "name" in hotel
        assert "slug" in hotel

    async def test_slug_collision_handled_without_error(self, onboarding_client: AsyncClient):
        """Posting the same hotel name twice must not crash — second gets a UUID suffix."""
        hotel_name = f"Collision Hotel {uuid.uuid4().hex[:4]}"
        # Create the hotel first via a direct DB seed so the slug already exists
        from tests.conftest import engine
        slug = hotel_name.lower().replace(" ", "-")
        existing = Hotel(id=str(uuid.uuid4()), name=hotel_name, slug=slug)
        async with AsyncSession(engine) as session:
            session.add(existing)
            await session.commit()

        r = await onboarding_client.post(_ONBOARDING_URL, json={
            "name": "Pytest Owner",
            "hotel_name": hotel_name,
        })
        # Must succeed even though the slug already exists
        assert r.status_code == 200
        new_hotel = r.json()["hotel"]
        # Slug must differ from the colliding one (UUID suffix appended)
        assert new_hotel["slug"] != slug

    async def test_invalid_payload_returns_422(self, onboarding_client: AsyncClient):
        """Missing required fields must return 422, not 500."""
        r = await onboarding_client.post(_ONBOARDING_URL, json={})
        assert r.status_code == 422


# ─── Returning user — updates hotel name ─────────────────────────────────────

class TestOnboardingReturningUser:
    async def test_existing_hotel_id_triggers_update_path(
        self, returning_client: AsyncClient
    ):
        """User with hotel_id updates hotel name; endpoint reaches the update branch."""
        r = await returning_client.post(_ONBOARDING_URL, json={
            "name": "Updated Owner",
            "hotel_name": f"Updated Hotel Name {uuid.uuid4().hex[:4]}",
        })
        assert r.status_code == 200
        body = r.json()
        assert "message" in body
        assert "user" in body
        assert "hotel" in body
