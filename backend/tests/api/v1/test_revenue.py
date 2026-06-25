"""
Revenue / Dynamic Pricing Tests
Covers:
  - GET /revenue/pricing-rules — auth guard, returns list, tenant isolation, empty state
  - GET /revenue/recovery/abandoned — auth guard, empty state, tenant isolation
  - GET /revenue/recovery/settings — auth guard, shape check
"""
import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.bookings.booking import Booking, BookingStatus, Guest
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

    async def test_abandoned_empty_state(self, auth_client: AsyncClient):
        """Abandoned endpoint never crashes; returns a valid list with correct shape."""
        r = await auth_client.get("/api/v1/revenue/recovery/abandoned")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for item in data:
            assert "id" in item

    async def test_abandoned_tenant_isolation(
        self, auth_client: AsyncClient, seeded_hotel: Hotel
    ):
        """Abandoned bookings from another hotel must not appear in our list."""
        from tests.conftest import engine

        other_hotel_id = str(uuid.uuid4())
        other_guest_id = str(uuid.uuid4())
        other_booking_id = str(uuid.uuid4())

        other_hotel = Hotel(
            id=other_hotel_id,
            name="Other Abandoned Hotel",
            slug=f"other-abandoned-{uuid.uuid4().hex[:6]}",
        )
        other_guest = Guest(
            id=other_guest_id,
            hotel_id=other_hotel_id,
            first_name="Abandoned",
            last_name="Guest",
            email=f"abandoned-{uuid.uuid4().hex[:6]}@test.com",
            phone="9000000020",
        )
        other_booking = Booking(
            id=other_booking_id,
            hotel_id=other_hotel_id,
            booking_number=f"BK{uuid.uuid4().hex[:8].upper()}",
            guest_id=other_guest_id,
            check_in=date(2031, 3, 1),
            check_out=date(2031, 3, 3),
            status=BookingStatus.PENDING,
            total_amount=2000.0,
            rooms=[],
        )
        async with AsyncSession(engine) as session:
            session.add(other_hotel)
            session.add(other_guest)
            session.add(other_booking)
            await session.commit()

        r = await auth_client.get("/api/v1/revenue/recovery/abandoned")
        assert r.status_code == 200
        booking_ids = [b["id"] for b in r.json()]
        assert other_booking_id not in booking_ids, (
            "Abandoned booking from another hotel leaked into response"
        )

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
