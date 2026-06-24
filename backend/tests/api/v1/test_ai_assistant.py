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
        # 200 or feature-gated 403 — but never 401
        assert r.status_code not in (401,)

    async def test_staff_can_access_usage(self, staff_client: AsyncClient):
        """STAFF role should also be able to check agent usage."""
        r = await staff_client.get("/api/v1/agent/usage")
        assert r.status_code not in (401,)
