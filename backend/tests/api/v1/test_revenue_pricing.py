"""
Dynamic pricing rules — engine unit tests + hotelier CRUD (auth/IDOR/validation).
"""
import uuid
from datetime import date

import pytest
from httpx import AsyncClient

from app.revenue.pricing_model import PricingRule
from app.revenue.pricing_engine import apply_pricing_rules
from app.rooms.room import RoomType


def _rule(**kw) -> PricingRule:
    """Build an in-memory PricingRule (not persisted) for engine unit tests."""
    defaults = dict(
        id=str(uuid.uuid4()),
        hotel_id="h1",
        name="r",
        is_active=True,
        adjustment_type="percentage",
        adjustment_value=0.0,
        priority=0,
    )
    defaults.update(kw)
    return PricingRule(**defaults)


# ─── Engine (pure, no DB) ─────────────────────────────────────────────────────

class TestPricingEngine:
    def test_no_rules_returns_base(self):
        price, applied = apply_pricing_rules(2000, [], target_date=date(2026, 6, 20))
        assert price == 2000
        assert applied == []

    def test_occupancy_percentage_increase(self):
        r = _rule(rule_type="occupancy", occupancy_min=80, adjustment_value=20)
        price, applied = apply_pricing_rules(
            2000, [r], target_date=date(2026, 6, 20), occupancy_pct=90
        )
        assert price == 2400  # +20%
        assert len(applied) == 1

    def test_occupancy_below_threshold_no_change(self):
        r = _rule(rule_type="occupancy", occupancy_min=80, adjustment_value=20)
        price, _ = apply_pricing_rules(
            2000, [r], target_date=date(2026, 6, 20), occupancy_pct=50
        )
        assert price == 2000

    def test_day_of_week_weekend_surcharge(self):
        # 2026-06-20 is a Saturday (weekday 5).
        r = _rule(rule_type="day_of_week", days_of_week=[5, 6], adjustment_value=15)
        sat, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 20))
        mon, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 22))
        assert sat == 2300  # Saturday +15%
        assert mon == 2000  # Monday unchanged

    def test_last_minute_fixed_discount(self):
        r = _rule(
            rule_type="lead_time", lead_time_max=3,
            adjustment_type="fixed_amount", adjustment_value=-500,
        )
        near, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 20), lead_time_days=2)
        far, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 20), lead_time_days=30)
        assert near == 1500
        assert far == 2000

    def test_seasonal_window(self):
        r = _rule(rule_type="seasonal", date_from=date(2026, 12, 20),
                  date_to=date(2027, 1, 2), adjustment_value=30)
        peak, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 12, 25))
        off, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 25))
        assert peak == 2600
        assert off == 2000

    def test_rules_stack_in_priority_order(self):
        r1 = _rule(rule_type="day_of_week", days_of_week=[5], adjustment_value=10, priority=0)
        r2 = _rule(rule_type="occupancy", occupancy_min=80, adjustment_value=10, priority=1)
        price, applied = apply_pricing_rules(
            1000, [r2, r1], target_date=date(2026, 6, 20), occupancy_pct=90
        )
        # 1000 *1.1 (dow) = 1100, then *1.1 (occ) = 1210
        assert price == 1210
        assert [a["rule_type"] for a in applied] == ["day_of_week", "occupancy"]

    def test_deterministic_only_skips_occupancy(self):
        r = _rule(rule_type="occupancy", occupancy_min=80, adjustment_value=50)
        price, _ = apply_pricing_rules(
            2000, [r], target_date=date(2026, 6, 20),
            occupancy_pct=90, deterministic_only=True,
        )
        assert price == 2000

    def test_room_scoped_rule_skips_other_room(self):
        r = _rule(rule_type="day_of_week", days_of_week=[5], adjustment_value=50,
                  room_type_id="roomA")
        price, _ = apply_pricing_rules(
            2000, [r], target_date=date(2026, 6, 20), room_type_id="roomB"
        )
        assert price == 2000

    def test_max_price_guard_rail(self):
        r = _rule(rule_type="day_of_week", days_of_week=[5],
                  adjustment_value=100, max_price=2500)
        price, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 20))
        assert price == 2500  # clamped from 4000

    def test_inactive_rule_skipped(self):
        r = _rule(rule_type="day_of_week", days_of_week=[5],
                  adjustment_value=50, is_active=False)
        price, _ = apply_pricing_rules(2000, [r], target_date=date(2026, 6, 20))
        assert price == 2000


# ─── Hotelier CRUD ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestPricingRuleCrud:
    async def test_create_rule(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "name": "Weekend surge",
            "rule_type": "day_of_week",
            "days_of_week": [5, 6],
            "adjustment_type": "percentage",
            "adjustment_value": 15,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["rule_type"] == "day_of_week"
        assert body["id"]

    async def test_create_invalid_rule_type(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "bogus", "adjustment_value": 10,
        })
        assert r.status_code == 400

    async def test_create_invalid_adjustment_type(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "occupancy", "adjustment_type": "bogus", "adjustment_value": 10,
        })
        assert r.status_code == 400

    async def test_create_room_scoped_rule(self, auth_client: AsyncClient, seeded_room: RoomType):
        r = await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "occupancy", "occupancy_min": 80, "adjustment_value": 20,
            "room_type_id": seeded_room.id,
        })
        assert r.status_code == 200, r.text
        assert r.json()["room_type_id"] == seeded_room.id

    async def test_create_foreign_room_rejected(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "occupancy", "occupancy_min": 80, "adjustment_value": 20,
            "room_type_id": str(uuid.uuid4()),
        })
        assert r.status_code == 400

    async def test_list_rules(self, auth_client: AsyncClient):
        await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "occupancy", "occupancy_min": 70, "adjustment_value": 10,
        })
        r = await auth_client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    async def test_update_rule(self, auth_client: AsyncClient):
        created = (await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "occupancy", "occupancy_min": 70, "adjustment_value": 10,
        })).json()
        r = await auth_client.put(
            f"/api/v1/revenue/pricing-rules/{created['id']}",
            json={"adjustment_value": 25},
        )
        assert r.status_code == 200
        assert r.json()["adjustment_value"] == 25

    async def test_update_missing_rule_404(self, auth_client: AsyncClient):
        r = await auth_client.put(
            f"/api/v1/revenue/pricing-rules/{uuid.uuid4()}", json={"adjustment_value": 5}
        )
        assert r.status_code == 404

    async def test_delete_rule(self, auth_client: AsyncClient):
        created = (await auth_client.post("/api/v1/revenue/pricing-rules", json={
            "rule_type": "occupancy", "occupancy_min": 70, "adjustment_value": 10,
        })).json()
        r = await auth_client.delete(f"/api/v1/revenue/pricing-rules/{created['id']}")
        assert r.status_code == 200
        r2 = await auth_client.put(
            f"/api/v1/revenue/pricing-rules/{created['id']}", json={"adjustment_value": 5}
        )
        assert r2.status_code == 404

    async def test_rules_require_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/revenue/pricing-rules")
        assert r.status_code == 401
