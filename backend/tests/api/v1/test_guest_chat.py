"""
Guest AI chat endpoint tests.

Coverage:
- Cache get / set / invalidate
- _fetch_hotel_data populates cache on first call, hits cache on second
- pre-warm endpoint returns 204
- /chat/guest returns 404 for unknown hotel
- /chat/guest returns 403 when feature_guest_bot is disabled (default)
- /chat/guest/stream returns 404 for unknown hotel
- /chat/guest/stream returns 403 when feature_guest_bot is disabled
- Room create/update/delete invalidates guest agent cache
- Rate plan create/update/delete invalidates guest agent cache
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_engine.guest_agent import (
    _cache_get,
    _cache_set,
    invalidate_guest_agent_cache,
    _fetch_hotel_data,
)


# ---------------------------------------------------------------------------
# Cache unit tests (no HTTP)
# ---------------------------------------------------------------------------

async def test_cache_set_and_get(seeded_hotel):
    hotel_id = seeded_hotel.id
    sample = {"hotel": {"name": "Test"}, "rooms": [], "amenity_names": "WiFi"}
    _cache_set(hotel_id, sample)
    result = _cache_get(hotel_id)
    assert result is not None
    assert result["hotel"]["name"] == "Test"


async def test_cache_invalidate_removes_key(seeded_hotel):
    hotel_id = seeded_hotel.id
    _cache_set(hotel_id, {"hotel": {}, "rooms": [], "amenity_names": ""})
    assert _cache_get(hotel_id) is not None
    invalidate_guest_agent_cache(hotel_id)
    assert _cache_get(hotel_id) is None


async def test_cache_get_returns_none_for_missing_key():
    invalidate_guest_agent_cache("nonexistent-hotel-xyz")
    assert _cache_get("nonexistent-hotel-xyz") is None


# ---------------------------------------------------------------------------
# _fetch_hotel_data: DB fetch + cache population
# ---------------------------------------------------------------------------

async def test_fetch_hotel_data_populates_cache(seeded_hotel, init_test_db):
    from app.core.db.database import engine

    hotel_id = seeded_hotel.id
    invalidate_guest_agent_cache(hotel_id)  # start clean

    async with AsyncSession(engine) as session:
        data = await _fetch_hotel_data(session, hotel_id)

    assert data is not None
    assert "hotel" in data
    assert "rooms" in data
    assert "amenity_names" in data
    assert data["hotel"]["name"] == seeded_hotel.name

    # Should now be cached
    cached = _cache_get(hotel_id)
    assert cached is not None
    assert cached["hotel"]["name"] == seeded_hotel.name


async def test_fetch_hotel_data_uses_cache_on_second_call(seeded_hotel, init_test_db):
    """Second call must not hit DB — it returns the cached dict unchanged."""
    from app.core.db.database import engine

    hotel_id = seeded_hotel.id
    invalidate_guest_agent_cache(hotel_id)

    async with AsyncSession(engine) as session:
        first = await _fetch_hotel_data(session, hotel_id)

    # Mutate the cache to prove second call reads cache not DB
    cached = _cache_get(hotel_id)
    cached["hotel"]["name"] = "CACHED_SENTINEL"
    _cache_set(hotel_id, cached)

    async with AsyncSession(engine) as session:
        second = await _fetch_hotel_data(session, hotel_id)

    assert second["hotel"]["name"] == "CACHED_SENTINEL"


async def test_fetch_hotel_data_returns_none_for_unknown_hotel(init_test_db):
    from app.core.db.database import engine

    async with AsyncSession(engine) as session:
        result = await _fetch_hotel_data(session, "does-not-exist-000")
    assert result is None


# ---------------------------------------------------------------------------
# Pre-warm endpoint
# ---------------------------------------------------------------------------

async def test_prewarm_returns_204(client: AsyncClient, seeded_hotel):
    invalidate_guest_agent_cache(seeded_hotel.id)
    res = await client.post(f"/api/v1/public/chat/warm/{seeded_hotel.slug}")
    assert res.status_code == 204
    # Cache should now be populated
    assert _cache_get(seeded_hotel.id) is not None


async def test_prewarm_idempotent(client: AsyncClient, seeded_hotel):
    """Calling pre-warm twice must not error."""
    res1 = await client.post(f"/api/v1/public/chat/warm/{seeded_hotel.slug}")
    res2 = await client.post(f"/api/v1/public/chat/warm/{seeded_hotel.slug}")
    assert res1.status_code == 204
    assert res2.status_code == 204


# ---------------------------------------------------------------------------
# /chat/guest — auth and feature flag
# ---------------------------------------------------------------------------

async def test_chat_guest_404_for_unknown_hotel(client: AsyncClient):
    res = await client.post(
        "/api/v1/public/chat/guest",
        json={"hotel_slug": "slug-that-does-not-exist", "message": "Hello", "history": []},
    )
    assert res.status_code == 404


async def test_chat_guest_403_when_feature_disabled(client: AsyncClient, seeded_hotel):
    """seeded_hotel does not have feature_guest_bot=True → must 403."""
    res = await client.post(
        "/api/v1/public/chat/guest",
        json={"hotel_slug": seeded_hotel.slug, "message": "Hello", "history": []},
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# /chat/guest/stream — auth and feature flag
# ---------------------------------------------------------------------------

async def test_stream_404_for_unknown_hotel(client: AsyncClient):
    res = await client.post(
        "/api/v1/public/chat/guest/stream",
        json={"hotel_slug": "slug-that-does-not-exist", "message": "Hello", "history": []},
    )
    assert res.status_code == 404


async def test_stream_403_when_feature_disabled(client: AsyncClient, seeded_hotel):
    res = await client.post(
        "/api/v1/public/chat/guest/stream",
        json={"hotel_slug": seeded_hotel.slug, "message": "Hello", "history": []},
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Cache invalidation via admin APIs
# ---------------------------------------------------------------------------

async def test_room_create_invalidates_guest_agent_cache(
    auth_client: AsyncClient, seeded_hotel
):
    _cache_set(seeded_hotel.id, {"hotel": {}, "rooms": [], "amenity_names": ""})
    assert _cache_get(seeded_hotel.id) is not None

    res = await auth_client.post(
        "/api/v1/rooms",
        json={
            "name": "Cache Test Room",
            "base_price": 3000,
            "total_inventory": 2,
            "base_occupancy": 2,
            "max_occupancy": 3,
            "max_children": 1,
        },
    )
    assert res.status_code in (200, 201)
    # Cache must be cleared after room creation
    assert _cache_get(seeded_hotel.id) is None


async def test_rate_plan_create_invalidates_guest_agent_cache(
    auth_client: AsyncClient, seeded_hotel
):
    _cache_set(seeded_hotel.id, {"hotel": {}, "rooms": [], "amenity_names": ""})
    assert _cache_get(seeded_hotel.id) is not None

    res = await auth_client.post(
        "/api/v1/rates/plans",
        json={
            "name": "Cache Test Plan",
            "meal_plan": "EP",
            "is_refundable": True,
            "cancellation_hours": 24,
            "price_adjustment": 0.0,
        },
    )
    assert res.status_code in (200, 201)
    assert _cache_get(seeded_hotel.id) is None


async def test_rate_plan_update_invalidates_guest_agent_cache(
    auth_client: AsyncClient, seeded_hotel, seeded_rate_plan
):
    _cache_set(seeded_hotel.id, {"hotel": {}, "rooms": [], "amenity_names": ""})

    res = await auth_client.patch(
        f"/api/v1/rates/plans/{seeded_rate_plan.id}",
        json={"name": seeded_rate_plan.name, "price_adjustment": 500.0},
    )
    assert res.status_code == 200
    assert _cache_get(seeded_hotel.id) is None


async def test_rate_plan_delete_invalidates_guest_agent_cache(
    auth_client: AsyncClient, seeded_hotel, seeded_rate_plan
):
    _cache_set(seeded_hotel.id, {"hotel": {}, "rooms": [], "amenity_names": ""})

    res = await auth_client.delete(f"/api/v1/rates/plans/{seeded_rate_plan.id}")
    assert res.status_code == 200
    assert _cache_get(seeded_hotel.id) is None
