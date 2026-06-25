"""
AI Agent Endpoint Tests
Covers:
  - GET  /agent/usage — auth guard
  - POST /agent/chat  — auth guard (unauthenticated rejected)
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAIAgentAuth:
    async def test_chat_requires_auth(self, client: AsyncClient):
        """Unauthenticated request to /agent/chat must be rejected."""
        r = await client.post("/api/v1/agent/chat", json={"message": "hello"})
        assert r.status_code == 401

    async def test_usage_requires_auth(self, client: AsyncClient):
        """Unauthenticated request to /agent/usage must be rejected."""
        r = await client.get("/api/v1/agent/usage")
        assert r.status_code == 401


class TestAIAgentAccess:
    async def test_owner_can_access_usage(self, auth_client: AsyncClient):
        """Authenticated owner should be able to fetch agent usage stats."""
        r = await auth_client.get("/api/v1/agent/usage")
        assert r.status_code == 200
        data = r.json()
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

    async def test_staff_can_access_usage(self, staff_client: AsyncClient):
        """STAFF role should also be able to check agent usage."""
        r = await staff_client.get("/api/v1/agent/usage")
        assert r.status_code == 200
        data = r.json()
        assert "hotel_id" in data
        assert "period_days" in data
        assert "agents" in data

    async def test_cannot_access_other_hotel_data(self, auth_client: AsyncClient):
        """The endpoint must use the hotel_id from the JWT, not a query param override."""
        fake_hotel_id = "00000000-0000-0000-0000-000000000000"
        r = await auth_client.get(f"/api/v1/agent/usage?hotel_id={fake_hotel_id}")
        assert r.status_code in (200, 403, 404)
        if r.status_code == 200:
            data = r.json()
            assert data.get("hotel_id") != fake_hotel_id

    async def test_empty_state_returns_shape(self, auth_client: AsyncClient):
        """Fresh hotel with no AI usage returns the expected shape — not a crash."""
        r = await auth_client.get("/api/v1/agent/usage")
        assert r.status_code == 200
        data = r.json()
        assert "hotel_id" in data
        assert "period_days" in data
        assert "agents" in data
        assert isinstance(data["agents"], dict)
        for agent_stats in data["agents"].values():
            assert agent_stats.get("calls", 0) >= 0
