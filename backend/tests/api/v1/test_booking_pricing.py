"""
Booking money-path coverage (Batch 1): server-side tax math, promo codes, and
loyalty-points redemption. These are the calculations a guest must never be able
to influence and that directly decide how much money is charged.

All amounts are recomputed server-side; these tests pin the exact figures so a
future change that breaks the math fails loudly.
"""
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.rooms.room import RoomType

pytestmark = pytest.mark.asyncio


def _future(days=1):
    return (date.today() + timedelta(days=days)).isoformat()


async def _seed_room(hotel_id, base_price=1000.0, name="Rate Room"):
    from tests.conftest import engine
    rt = RoomType(
        id=str(uuid.uuid4()), hotel_id=hotel_id, name=name,
        base_price=base_price, total_inventory=5, base_occupancy=2, max_occupancy=3,
    )
    async with AsyncSession(engine) as session:
        session.add(rt)
        await session.commit()
        await session.refresh(rt)
    return rt


async def _set_hotel_tax(hotel_id, **tax):
    """Merge tax settings onto the hotel so the booking flow reads them."""
    from tests.conftest import engine
    async with AsyncSession(engine) as session:
        h = await session.get(Hotel, hotel_id)
        h.settings = {**(h.settings or {}), **tax}
        session.add(h)
        await session.commit()


async def _book(client, room, total_price, **extra):
    """pay_at_property booking (confirms immediately) — returns the response json."""
    from app.core.utils.limiter import limiter
    prev = limiter.enabled
    limiter.enabled = False
    try:
        payload = {
            "check_in": _future(40), "check_out": _future(41),
            "guest": {"first_name": "Rate", "last_name": "Test",
                      "email": f"{uuid.uuid4().hex[:8]}@test.com", "phone": "9000000000"},
            "rooms": [{
                "room_type_id": room.id, "room_type_name": room.name,
                "price_per_night": room.base_price, "total_price": total_price,
            }],
            "payment_method": "pay_at_property",
        }
        payload.update(extra)
        return await client.post("/api/v1/public/bookings", json=payload)
    finally:
        limiter.enabled = prev


class TestBookingTax:
    async def test_exclusive_tax_added_on_top(self, client: AsyncClient, seeded_hotel: Hotel):
        room = await _seed_room(seeded_hotel.id, 1000.0)
        await _set_hotel_tax(seeded_hotel.id, room_tax_rate=18.0,
                             room_tax_type="exclusive", room_tax_calculation_method="flat")
        r = await _book(client, room, 1000.0)
        assert r.status_code == 200, r.text
        b = r.json()
        # 1000 room + 18% exclusive tax = 1180
        assert b["subtotal_amount"] == 1000.0
        assert b["tax_amount"] == 180.0
        assert b["total_amount"] == 1180.0

    async def test_inclusive_tax_baked_into_total(self, client: AsyncClient, seeded_hotel: Hotel):
        room = await _seed_room(seeded_hotel.id, 1000.0)
        await _set_hotel_tax(seeded_hotel.id, room_tax_rate=18.0,
                             room_tax_type="inclusive", room_tax_calculation_method="flat")
        r = await _book(client, room, 1000.0)
        assert r.status_code == 200, r.text
        b = r.json()
        # Inclusive: the 1000 already contains tax → total stays 1000, tax carved out.
        assert b["total_amount"] == 1000.0
        assert round(b["subtotal_amount"] + b["tax_amount"], 2) == 1000.0
        assert b["tax_amount"] == pytest.approx(152.54, abs=0.05)


class TestBookingPromo:
    async def test_valid_promo_code_discounts_server_side(self, client: AsyncClient, seeded_hotel: Hotel):
        from tests.conftest import engine
        from app.rate_plans.promo import PromoCode
        room = await _seed_room(seeded_hotel.id, 1000.0)
        await _set_hotel_tax(seeded_hotel.id, room_tax_rate=0.0, room_tax_type="exclusive")
        async with AsyncSession(engine) as session:
            session.add(PromoCode(
                id=str(uuid.uuid4()), hotel_id=seeded_hotel.id, code="SAVE100",
                discount_type="fixed_amount", discount_value=100.0, is_active=True,
                start_date=date.today() - timedelta(days=1), end_date=date.today() + timedelta(days=10),
            ))
            await session.commit()
        r = await _book(client, room, 1000.0, promo_code="SAVE100")
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["discount_amount"] == 100.0
        assert b["total_amount"] == 900.0

    async def test_expired_promo_ignored(self, client: AsyncClient, seeded_hotel: Hotel):
        from tests.conftest import engine
        from app.rate_plans.promo import PromoCode
        room = await _seed_room(seeded_hotel.id, 1000.0)
        await _set_hotel_tax(seeded_hotel.id, room_tax_rate=0.0, room_tax_type="exclusive")
        async with AsyncSession(engine) as session:
            session.add(PromoCode(
                id=str(uuid.uuid4()), hotel_id=seeded_hotel.id, code="OLD50",
                discount_type="fixed_amount", discount_value=50.0, is_active=True,
                start_date=date.today() - timedelta(days=30), end_date=date.today() - timedelta(days=1),
            ))
            await session.commit()
        r = await _book(client, room, 1000.0, promo_code="OLD50")
        assert r.status_code == 200, r.text
        b = r.json()
        # Expired → no discount, full price charged.
        assert b["discount_amount"] == 0.0
        assert b["total_amount"] == 1000.0


class TestBookingPoints:
    async def test_insufficient_points_rejected(self, client: AsyncClient, seeded_hotel: Hotel):
        room = await _seed_room(seeded_hotel.id, 1000.0)
        await _set_hotel_tax(seeded_hotel.id, room_tax_rate=0.0, room_tax_type="exclusive")
        # Guest has no loyalty wallet → redeeming points must be rejected, not silently ignored.
        r = await _book(client, room, 1000.0, redeem_points=500.0)
        assert r.status_code == 400
