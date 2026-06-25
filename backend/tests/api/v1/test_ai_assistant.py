import pytest
from httpx import AsyncClient

# --- AUTH TESTS ---

async def test_ai_assistant_requires_auth(client: AsyncClient):
    """Unauthenticated requests must be rejected."""
    res = await client.get("/api/v1/agent/usage")
    assert res.status_code == 401

# --- SHAPE TESTS ---

async def test_ai_assistant_returns_expected_keys(auth_client: AsyncClient):
    """Response must include every field the frontend reads."""
    res = await auth_client.get("/api/v1/agent/usage")
    assert res.status_code == 200
    data = res.json()
    assert "hotel_id" in data
    assert "period_days" in data
    assert "agents" in data
    assert isinstance(data["agents"], dict)
    for agent_type in ("hotelier", "guest", "whatsapp"):
        assert agent_type in data["agents"]
        agent = data["agents"][agent_type]
        assert "label" in agent
        assert "today_tokens" in agent
        assert "daily_limit" in agent

# --- TENANT ISOLATION (IDOR) ---

async def test_ai_assistant_cannot_access_other_hotel_data(auth_client: AsyncClient):
    """The endpoint must use the hotel_id from the JWT, not a query param override."""
    fake_hotel_id = "00000000-0000-0000-0000-000000000000"
    res = await auth_client.get(f"/api/v1/agent/usage?hotel_id={fake_hotel_id}")
    # The endpoint ignores query hotel_id and reads from JWT — returns 200 for own hotel.
    # If somehow the fake ID were used, it must NOT return 200 with another hotel's data.
    assert res.status_code in (200, 403, 404)
    if res.status_code == 200:
        # Must be the authenticated user's own hotel — not the faked one
        data = res.json()
        assert data.get("hotel_id") != fake_hotel_id

# --- EMPTY STATE ---

async def test_ai_assistant_empty_db_no_crash(auth_client: AsyncClient):
    """Must return 200 with empty/degraded data, never 500, when DB has no records."""
    res = await auth_client.get("/api/v1/agent/usage")
    assert res.status_code == 200
    data = res.json()
    # Whether real data or degraded fallback, the shape must be present
    assert "agents" in data
