"""
Revenue / Dynamic Pricing Tests
Covers:
  - GET /revenue/pricing-rules — auth guard, returns list, tenant isolation, empty state
  - GET /revenue/recovery/abandoned — auth guard, returns list
  - GET /revenue/recovery/settings — auth guard, shape check
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.revenue.pricing_model import PricingRule

pytestmark = pytest.mark.asyncio


class TestDynamicPricing:
    async def test_pricing_rules_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 401

    async def test_pricing_rules_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_empty_state_returns_empty_list(self, auth_client: AsyncClient):
        """Fresh hotel with no pricing rules returns [] not crash."""
        r = await auth_client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 200
        assert r.json() == []

    async def test_tenant_isolation(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        """Pricing rules from another hotel must not appear in our list."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_rule_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Pricing Hotel",
            slug=f"other-pricing-{uuid.uuid4().hex[:6]}",
        )
        other_rule = PricingRule(
            id=other_rule_id,
            hotel_id=other_hotel_id,
            name="Other Hotel Occupancy Rule",
            rule_type="occupancy",
            adjustment_type="percentage",
            adjustment_value=10.0,
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_rule)
            await session.commit()

        r = await auth_client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 200
        rule_ids = [rule["id"] for rule in r.json()]
        assert other_rule_id not in rule_ids, (
            "Pricing rule from another hotel leaked into response"
        )


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

    async def test_settings_returns_shape(self, auth_client: AsyncClient):
        """GET /revenue/recovery/settings returns {recovery_enabled: bool}."""
        r = await auth_client.get("/api/v1/revenue/recovery/settings")
        assert r.status_code == 200
        data = r.json()
        assert "recovery_enabled" in data
        assert isinstance(data["recovery_enabled"], bool)
