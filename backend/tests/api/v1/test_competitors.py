"""
Rate Shopper / Competitor API tests.

Coverage:
- Auth boundary (401 when unauthenticated)
- Feature-flag gate (403 when feature_rate_shopper is off)
- Mass-assignment prevention on POST /competitors (CompetitorCreate schema)
- URL/name validation on CompetitorCreate
- _is_stale_running staleness detection
- ScrapingBee usage accounting (record_scrapingbee_request / get_usage_summary) — Redis
  is unavailable in the test env, so these exercise the fail-safe defaults
- GET/PUT /competitors/schedule — hotelier-configurable auto-scrape hour,
  including OWNER/MANAGER role gating and input validation
- GET /competitors/usage shape
"""
import uuid
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.core.database import engine
from app.models.hotel import Hotel
from app.models.user import User, UserRole
from main import app


# ---------------------------------------------------------------------------
# Fixtures: an authenticated client whose `current_user.hotel` relationship is
# eagerly loaded AND has `feature_rate_shopper` switched on.
#
# The shared `auth_client` fixture overrides `get_current_active_user` with a
# bare `seeded_user` that was loaded outside of `get_current_user`'s
# `selectinload(User.hotel)` — so the moment a route touches
# `current_user.hotel` (as every competitors.py route does, via
# `check_rate_shopper_feature`/`require_feature`) it raises
# `DetachedInstanceError`. Production never hits this because real requests
# always go through `get_current_user`.
# ---------------------------------------------------------------------------

async def _client_for(user_id: str) -> AsyncClient:
    from app.api.deps import get_current_active_user

    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(User).where(User.id == user_id).options(selectinload(User.hotel))
        )
        user = result.scalar_one()
        session.expunge(user)

    app.dependency_overrides[get_current_active_user] = lambda: user
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest_asyncio.fixture
async def rate_shopper_client(seeded_hotel: Hotel, seeded_user: User):
    """OWNER client + feature_rate_shopper enabled for the test's duration."""
    from app.api.deps import get_current_active_user

    async with AsyncSession(engine) as session:
        hotel = await session.get(Hotel, seeded_hotel.id)
        hotel.feature_rate_shopper = True
        session.add(hotel)
        await session.commit()

    ac = await _client_for(seeded_user.id)
    async with ac:
        yield ac
    app.dependency_overrides.pop(get_current_active_user, None)

    async with AsyncSession(engine) as session:
        hotel = await session.get(Hotel, seeded_hotel.id)
        hotel.feature_rate_shopper = False
        session.add(hotel)
        await session.commit()


@pytest_asyncio.fixture
async def rate_shopper_staff_client(seeded_hotel: Hotel):
    """STAFF client (operational-only role) + feature_rate_shopper enabled."""
    from app.api.deps import get_current_active_user

    staff = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-staff-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Pytest Staff",
        role=UserRole.STAFF,
        hotel_id=seeded_hotel.id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(staff)
        hotel = await session.get(Hotel, seeded_hotel.id)
        hotel.feature_rate_shopper = True
        session.add(hotel)
        await session.commit()
        await session.refresh(staff)

    ac = await _client_for(staff.id)
    async with ac:
        yield ac
    app.dependency_overrides.pop(get_current_active_user, None)

    async with AsyncSession(engine) as session:
        hotel = await session.get(Hotel, seeded_hotel.id)
        hotel.feature_rate_shopper = False
        session.add(hotel)
        await session.commit()
        obj = await session.get(User, staff.id)
        if obj:
            await session.delete(obj)
            await session.commit()


# ---------------------------------------------------------------------------
# Auth boundary
# ---------------------------------------------------------------------------

async def test_list_competitors_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/competitors")
    assert res.status_code == 401


async def test_add_competitor_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/competitors", json={"name": "Taj", "url": "https://x.com"})
    assert res.status_code == 401


async def test_usage_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/competitors/usage")
    assert res.status_code == 401


async def test_get_schedule_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/competitors/schedule")
    assert res.status_code == 401


async def test_update_schedule_requires_auth(client: AsyncClient):
    res = await client.put("/api/v1/competitors/schedule", json={"scrape_hour": 5})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Feature-flag gate (seeded_hotel defaults to feature_rate_shopper=False)
# ---------------------------------------------------------------------------

async def test_list_competitors_403_when_feature_disabled(seeded_user: User):
    """seeded_hotel does not have feature_rate_shopper=True by default -> 403."""
    ac = await _client_for(seeded_user.id)
    from app.api.deps import get_current_active_user
    try:
        async with ac:
            res = await ac.get("/api/v1/competitors")
            assert res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


async def test_usage_403_when_feature_disabled(seeded_user: User):
    ac = await _client_for(seeded_user.id)
    from app.api.deps import get_current_active_user
    try:
        async with ac:
            res = await ac.get("/api/v1/competitors/usage")
            assert res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


async def test_schedule_403_when_feature_disabled(seeded_user: User):
    ac = await _client_for(seeded_user.id)
    from app.api.deps import get_current_active_user
    try:
        async with ac:
            res = await ac.get("/api/v1/competitors/schedule")
            assert res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


# ---------------------------------------------------------------------------
# CompetitorCreate validation (mass-assignment prevention + input checks)
# ---------------------------------------------------------------------------

def test_competitor_create_requires_http_url():
    from app.api.v1.competitors import CompetitorCreate

    with pytest.raises(ValidationError):
        CompetitorCreate(name="Taj Hotel", url="javascript:alert(1)")

    with pytest.raises(ValidationError):
        CompetitorCreate(name="Taj Hotel", url="ftp://example.com")


def test_competitor_create_accepts_http_and_https():
    from app.api.v1.competitors import CompetitorCreate

    assert CompetitorCreate(name="Taj", url="http://example.com").url == "http://example.com"
    assert CompetitorCreate(name="Taj", url="https://example.com").url == "https://example.com"


def test_competitor_create_rejects_blank_name():
    from app.api.v1.competitors import CompetitorCreate

    with pytest.raises(ValidationError):
        CompetitorCreate(name="   ", url="https://example.com")


def test_competitor_create_strips_name_whitespace():
    from app.api.v1.competitors import CompetitorCreate

    comp = CompetitorCreate(name="  Taj Hotel  ", url="https://example.com")
    assert comp.name == "Taj Hotel"


def test_competitor_create_ignores_server_managed_fields():
    """
    The schema only exposes name/url/source — a client cannot mass-assign
    `id`, `hotel_id`, `is_active`, or `last_scrape_status` through it.
    """
    from app.api.v1.competitors import CompetitorCreate

    comp = CompetitorCreate.model_validate({
        "name": "Taj Hotel",
        "url": "https://example.com",
        "source": "MAKEMYTRIP",
        "id": "attacker-supplied-id",
        "hotel_id": "someone-elses-hotel",
        "is_active": False,
        "last_scrape_status": "success",
    })
    assert not hasattr(comp, "id")
    assert not hasattr(comp, "hotel_id")
    assert not hasattr(comp, "is_active")
    assert not hasattr(comp, "last_scrape_status")


# ---------------------------------------------------------------------------
# _is_stale_running
# ---------------------------------------------------------------------------

def test_is_stale_running_false_when_not_running():
    from app.api.v1.competitors import _is_stale_running
    from app.models.competitor import Competitor

    comp = Competitor(hotel_id="h1", name="X", url="https://x.com", last_scrape_status="success")
    assert _is_stale_running(comp) is False


def test_is_stale_running_true_when_no_start_timestamp():
    """Legacy rows from before scrape_started_at existed -> treat as stale."""
    from app.api.v1.competitors import _is_stale_running
    from app.models.competitor import Competitor

    comp = Competitor(hotel_id="h1", name="X", url="https://x.com",
                      last_scrape_status="running", scrape_started_at=None)
    assert _is_stale_running(comp) is True


def test_is_stale_running_false_when_recently_started():
    from app.api.v1.competitors import _is_stale_running, STALE_SCRAPE_MINUTES
    from app.models.competitor import Competitor

    comp = Competitor(hotel_id="h1", name="X", url="https://x.com",
                      last_scrape_status="running",
                      scrape_started_at=datetime.utcnow() - timedelta(minutes=1))
    assert _is_stale_running(comp) is False


def test_is_stale_running_true_when_long_running():
    from app.api.v1.competitors import _is_stale_running, STALE_SCRAPE_MINUTES
    from app.models.competitor import Competitor

    comp = Competitor(hotel_id="h1", name="X", url="https://x.com",
                      last_scrape_status="running",
                      scrape_started_at=datetime.utcnow() - timedelta(minutes=STALE_SCRAPE_MINUTES + 5))
    assert _is_stale_running(comp) is True


# ---------------------------------------------------------------------------
# ScrapingBee usage accounting (Redis unavailable in test env -> fail-safe defaults)
# ---------------------------------------------------------------------------

def test_record_scrapingbee_request_never_raises_without_redis():
    from app.core.scrapingbee_usage import record_scrapingbee_request

    # Must be a no-op, not an exception, when Redis is unreachable.
    record_scrapingbee_request("some-hotel-id")
    record_scrapingbee_request("", count=5)       # blank hotel_id -> no-op
    record_scrapingbee_request("some-hotel-id", count=0)  # non-positive count -> no-op


def test_get_usage_summary_fails_safe_to_zeros():
    from app.core.scrapingbee_usage import get_usage_summary

    summary = get_usage_summary("some-hotel-id")
    assert summary == {"today": 0, "last_30_days": 0, "daily": []}


def test_get_usage_summary_empty_for_blank_hotel_id():
    from app.core.scrapingbee_usage import get_usage_summary

    assert get_usage_summary("") == {"today": 0, "last_30_days": 0, "daily": []}


# ---------------------------------------------------------------------------
# GET /competitors/usage
# ---------------------------------------------------------------------------

async def test_get_usage_shape(rate_shopper_client: AsyncClient):
    res = await rate_shopper_client.get("/api/v1/competitors/usage")
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {"today", "last_30_days", "daily"}
    assert isinstance(body["daily"], list)


# ---------------------------------------------------------------------------
# GET/PUT /competitors/schedule — hotelier picks the auto-scrape hour
# ---------------------------------------------------------------------------

async def test_get_schedule_defaults_to_off(rate_shopper_client: AsyncClient):
    res = await rate_shopper_client.get("/api/v1/competitors/schedule")
    assert res.status_code == 200
    body = res.json()
    # The multi-hour API returns scrape_hours: [] when no schedule is configured
    assert "scrape_hours" in body
    assert body["scrape_hours"] == []
    assert "timezone" in body


async def test_owner_can_set_schedule_hour(rate_shopper_client: AsyncClient):
    # Set one hour
    res = await rate_shopper_client.put("/api/v1/competitors/schedule", json={"scrape_hours": [3]})
    assert res.status_code == 200
    assert res.json()["scrape_hours"] == [3]

    # Persisted — a follow-up GET reflects it
    get_res = await rate_shopper_client.get("/api/v1/competitors/schedule")
    assert get_res.json()["scrape_hours"] == [3]

    # Turning it back off (empty list) disables auto-scrape
    off_res = await rate_shopper_client.put("/api/v1/competitors/schedule", json={"scrape_hours": []})
    assert off_res.status_code == 200
    assert off_res.json()["scrape_hours"] == []


async def test_schedule_hour_out_of_range_rejected(rate_shopper_client: AsyncClient):
    # Hour 24 is invalid (must be 0-23)
    res = await rate_shopper_client.put("/api/v1/competitors/schedule", json={"scrape_hours": [24]})
    assert res.status_code == 422

    res = await rate_shopper_client.put("/api/v1/competitors/schedule", json={"scrape_hours": [-1]})
    assert res.status_code == 422


async def test_staff_cannot_change_schedule(rate_shopper_staff_client: AsyncClient):
    """STAFF is operational-only — scheduling is an OWNER/MANAGER config action."""
    res = await rate_shopper_staff_client.put("/api/v1/competitors/schedule", json={"scrape_hours": [5]})
    assert res.status_code == 403


async def test_staff_can_view_schedule(rate_shopper_staff_client: AsyncClient):
    res = await rate_shopper_staff_client.get("/api/v1/competitors/schedule")
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# POST /competitors/{id}/stop — stop an in-progress scrape, keep fetched days
# ---------------------------------------------------------------------------

async def test_stop_scrape_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/competitors/does-not-matter/stop")
    assert res.status_code == 401


async def test_stop_scrape_404_for_unknown_competitor(rate_shopper_client: AsyncClient):
    res = await rate_shopper_client.post("/api/v1/competitors/nonexistent-id/stop")
    assert res.status_code == 404


async def test_stop_scrape_409_when_not_running(rate_shopper_client: AsyncClient, seeded_hotel: Hotel):
    """Stopping is only valid while a scrape is actually running."""
    from app.models.competitor import Competitor

    comp_id = str(uuid.uuid4())
    async with AsyncSession(engine) as session:
        session.add(Competitor(
            id=comp_id, hotel_id=seeded_hotel.id, name="Rival",
            url="https://www.makemytrip.com/hotels/?hotelId=123",
            last_scrape_status="success",
        ))
        await session.commit()

    res = await rate_shopper_client.post(f"/api/v1/competitors/{comp_id}/stop")
    assert res.status_code == 409


async def test_stop_scrape_404_for_other_hotels_competitor(rate_shopper_client: AsyncClient):
    """IDOR guard: cannot stop a scrape on a competitor you don't own."""
    from app.models.competitor import Competitor

    comp_id = str(uuid.uuid4())
    async with AsyncSession(engine) as session:
        session.add(Competitor(
            id=comp_id, hotel_id="some-other-hotel", name="Foreign",
            url="https://www.makemytrip.com/hotels/?hotelId=999",
            last_scrape_status="running",
        ))
        await session.commit()

    res = await rate_shopper_client.post(f"/api/v1/competitors/{comp_id}/stop")
    assert res.status_code == 404


async def test_stop_scrape_success(rate_shopper_client: AsyncClient, seeded_hotel: Hotel):
    """Stopping a running scrape updates DB status to success immediately."""
    from app.models.competitor import Competitor

    comp_id = str(uuid.uuid4())
    async with AsyncSession(engine) as session:
        session.add(Competitor(
            id=comp_id, hotel_id=seeded_hotel.id, name="Rival",
            url="https://www.makemytrip.com/hotels/?hotelId=123",
            last_scrape_status="running",
        ))
        await session.commit()

    res = await rate_shopper_client.post(f"/api/v1/competitors/{comp_id}/stop")
    assert res.status_code == 200
    assert res.json()["message"] == "Stopping scrape — already-fetched rates are saved."

    # Verify state in DB was flipped to success immediately
    async with AsyncSession(engine) as session:
        comp = await session.get(Competitor, comp_id)
        assert comp.last_scrape_status == "success"
        assert comp.last_scrape_error == "Stopped by you."
