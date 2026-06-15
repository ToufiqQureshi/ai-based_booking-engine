"""
Read-only availability endpoints: daily availability grid + block list.
"""
import json
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Query
from sqlmodel import select, and_, or_

from app.core.deps import CurrentUser, DbSession
from app.core.redis_client import redis_client
from app.rooms.room import RoomType, RoomBlock, RoomBlockRead
from app.bookings.booking import Booking, BookingStatus
from app.rate_plans.rates_model import RoomRate
from app.revenue.pricing_model import PricingRule
from app.revenue.pricing_engine import apply_pricing_rules

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/availability", tags=["Availability"])


@router.get("", response_model=List[Dict[str, Any]])
async def get_availability(
    current_user: CurrentUser,
    session: DbSession,
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """
    Calculate daily availability for all room types.
    Returns a list of room types with per-day inventory, booked, blocked, and price.
    Cached 5 minutes per hotel + date range.
    """
    cache_key = f"availability:{current_user.hotel_id}:{start_date.isoformat()}:{end_date.isoformat()}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis get availability failed: {e}")

    room_types = (await session.execute(
        select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    )).scalars().all()

    bookings = (await session.execute(
        select(Booking).where(
            Booking.hotel_id == current_user.hotel_id,
            Booking.status != BookingStatus.CANCELLED,
            or_(and_(Booking.check_in <= end_date, Booking.check_out > start_date)),
        )
    )).scalars().all()

    blocks = (await session.execute(
        select(RoomBlock).where(
            RoomBlock.hotel_id == current_user.hotel_id,
            or_(and_(RoomBlock.start_date <= end_date, RoomBlock.end_date >= start_date)),
        )
    )).scalars().all()

    delta = (end_date - start_date).days
    date_range = [start_date + timedelta(days=i) for i in range(delta + 1)]

    daily_rates = (await session.execute(
        select(RoomRate).where(
            RoomRate.hotel_id == current_user.hotel_id,
            RoomRate.rate_plan_id == None,
            and_(RoomRate.date_from <= end_date, RoomRate.date_to >= start_date),
        )
    )).scalars().all()

    # (room_type_id, date_str) → price
    price_map: dict = {}
    for dr in daily_rates:
        curr = dr.date_from
        while curr <= dr.date_to:
            price_map[(dr.room_type_id, curr.isoformat())] = dr.price
            curr += timedelta(days=1)

    # Pre-group booked counts to avoid O(n*m) inner loop
    booked_by_room_date: dict = defaultdict(int)
    for b in bookings:
        curr = b.check_in
        while curr < b.check_out:
            for rb in (b.rooms or []):
                if isinstance(rb, dict):
                    rt_id = rb.get("room_type_id")
                    if rt_id:
                        booked_by_room_date[(rt_id, curr.isoformat())] += 1
            curr += timedelta(days=1)

    blocked_by_room_date: dict = defaultdict(int)
    for block in blocks:
        curr = block.start_date
        while curr <= block.end_date:
            blocked_by_room_date[(block.room_type_id, curr.isoformat())] += block.blocked_count
            curr += timedelta(days=1)

    # Active dynamic pricing rules — used to show the hotelier the projected
    # dynamic price per cell alongside the configured base price.
    pricing_rules = (await session.execute(
        select(PricingRule).where(
            PricingRule.hotel_id == current_user.hotel_id,
            PricingRule.is_active == True,
        )
    )).scalars().all()
    today = date.today()

    availability_data = []
    for room in room_types:
        room_data = {
            "id": room.id,
            "name": room.name,
            "totalInventory": room.total_inventory,
            "availability": [],
        }
        for day in date_range:
            day_str = day.isoformat()
            booked_count = booked_by_room_date[(room.id, day_str)]
            blocked_count = blocked_by_room_date[(room.id, day_str)]
            available = max(0, room.total_inventory - booked_count - blocked_count)
            base_price = price_map.get((room.id, day_str), room.base_price)

            occupancy_pct = (
                (booked_count / room.total_inventory) * 100.0
                if room.total_inventory > 0 else 0.0
            )
            dynamic_price, applied_rules = apply_pricing_rules(
                base_price,
                pricing_rules,
                target_date=day,
                room_type_id=room.id,
                occupancy_pct=occupancy_pct,
                lead_time_days=(day - today).days,
            )
            room_data["availability"].append({
                "date": day_str,
                "totalRooms": room.total_inventory,
                "bookedRooms": booked_count,
                "blockedRooms": blocked_count,
                "availableRooms": available,
                "isBlocked": blocked_count >= room.total_inventory or available == 0,
                "price": base_price,
                # Hotelier preview of the dynamic-pricing engine output. The
                # actual charged price is unchanged here; this surfaces what the
                # configured rules would do for this room/date.
                "dynamicPrice": dynamic_price,
                "appliedRules": applied_rules,
            })
        availability_data.append(room_data)

    try:
        redis_client.set_value(cache_key, json.dumps(availability_data), expire=300)
    except Exception as e:
        logger.warning(f"Redis set availability failed: {e}")

    return availability_data


@router.get("/blocks", response_model=List[RoomBlockRead])
async def get_blocks(
    current_user: CurrentUser,
    session: DbSession,
    room_type_id: str = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Get existing room blocks for a specific room type and date range."""
    result = await session.execute(
        select(RoomBlock).where(
            RoomBlock.hotel_id == current_user.hotel_id,
            RoomBlock.room_type_id == room_type_id,
            RoomBlock.end_date >= start_date,
            RoomBlock.start_date <= end_date,
        )
    )
    return result.scalars().all()

