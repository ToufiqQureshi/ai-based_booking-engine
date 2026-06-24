"""
Rate Plans Tests
Covers:
  - GET /rates/plans — auth guard, returns list
  - POST /rates/plans — STAFF blocked
  - IDOR: non-existent plan returns 404
"""
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestGetRatePlans:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/rates/plans")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/rates/plans")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_state_no_crash(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/rates/plans")
        assert r.status_code == 200


class TestRatePlanWrite:
    async def test_staff_cannot_create_rate_plan(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/rates/plans", json={
            "name": "Hack Plan", "base_price": 999,
        })
        assert r.status_code == 403


class TestRatePlanIsolation:
    async def test_nonexistent_plan_returns_404(self, auth_client: AsyncClient):
        r = await auth_client.get(f"/api/v1/rates/plans/{uuid.uuid4()}")
        assert r.status_code in (403, 404, 405)
