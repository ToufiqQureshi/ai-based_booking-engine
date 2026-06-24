"""
Revenue / Dynamic Pricing Tests
Covers:
  - GET /revenue/pricing-rules — auth guard, returns list
  - GET /revenue/recovery/abandoned — auth guard, returns list
  - GET /revenue/recovery/settings — auth guard
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestDynamicPricing:
    async def test_pricing_rules_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 401

    async def test_pricing_rules_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestRevenueRecovery:
    async def test_abandoned_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/revenue/recovery/abandoned")
        assert r.status_code == 401

    async def test_abandoned_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/revenue/recovery/abandoned")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_settings_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/revenue/recovery/settings")
        assert r.status_code == 401
