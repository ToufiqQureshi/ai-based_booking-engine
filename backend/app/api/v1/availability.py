"""
Availability Router
Real-time room inventory calculation and blocking management.
"""
from typing import List, Dict, Any, Optional
from datetime import date, timedelta, datetime
from fastapi import APIRouter, Query, Depends, HTTPException, status
from sqlmodel import select, and_, or_, delete

from app.api.deps import CurrentUser, DbSession
from app.models.room import RoomType, RoomBlock, RoomBlockCreate, RoomBlockRead
from app.models.booking import Booking, BookingStatus
from app.models.rates import RoomRate
from pydantic import BaseModel

import json
import logging
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)

def clear_availability_cache(hotel_id: str):
    try:
        redis_client.delete_pattern(f"availability:{hotel_id}:*")
        redis_client.delete_pattern(f"public:rooms:{hotel_id}:*")
        # Also clear analytics dashboard as it depends on booking/inventory data
        redis_client.delete_pattern(f"analytics_dashboard:{hotel_id}:*")
        # Clear dashboard stats
        redis_client.delete_pattern(f"dashboard_stats:{hotel_id}:*")
    except Exception as e:
        logger.error(f"Failed clearing availability cache for hotel {hotel_id}: {e}")

router = APIRouter(prefix="/availability", tags=["Availability"])

@router.get("", response_model=List[Dict[str, Any]])
async def get_availability(
    current_user: CurrentUser,
    session: DbSession,
    start_date: date = Query(...),
    end_date: date = Query(...)
):
    """
    Calculate daily availability for all room types.
    Returns: List of room types with their daily availability.
    """
    cache_key = f"availability:{current_user.hotel_id}:{start_date.isoformat()}:{end_date.isoformat()}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis get availability failed: {e}")

    # 1. Get all room types
    room_types_result = await session.execute(
        select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    )
    room_types = room_types_result.scalars().all()
    
    # 2. Get overlapping bookings
    bookings_result = await session.execute(
        select(Booking).where(
            Booking.hotel_id == current_user.hotel_id,
            Booking.status != BookingStatus.CANCELLED,
            or_(
                and_(Booking.check_in <= end_date, Booking.check_out > start_date)
            )
        )
    )
    bookings = bookings_result.scalars().all()

    # 3. Get overlapping blocks
    blocks_result = await session.execute(
        select(RoomBlock).where(
            RoomBlock.hotel_id == current_user.hotel_id,
            or_(
                and_(RoomBlock.start_date <= end_date, RoomBlock.end_date >= start_date)
            )
        )
    )
    blocks = blocks_result.scalars().all()
    
    # 4. Generate date range
    delta = (end_date - start_date).days
    date_range = [start_date + timedelta(days=i) for i in range(delta + 1)]
    
    # 5. Get Daily Rates (Base Prices)
    rates_result = await session.execute(
        select(RoomRate).where(
            RoomRate.hotel_id == current_user.hotel_id,
            RoomRate.rate_plan_id == None,
            and_(
                RoomRate.date_from <= end_date,
                RoomRate.date_to >= start_date
            )
        )
    )
    daily_rates = rates_result.scalars().all()
    
    # Map (room_id, date_str) -> price
    price_map = {}
    for dr in daily_rates:
        curr = dr.date_from
        while curr <= dr.date_to:
            price_map[(dr.room_type_id, curr.isoformat())] = dr.price
            curr = curr + timedelta(days=1)

    # 6. Pre-group booked counts by (room_type_id, date) to avoid O(n*m) loop
    from collections import defaultdict
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

    # Pre-group blocked counts by (room_type_id, date)
    blocked_by_room_date: dict = defaultdict(int)
    for block in blocks:
        curr = block.start_date
        while curr <= block.end_date:
            blocked_by_room_date[(block.room_type_id, curr.isoformat())] += block.blocked_count
            curr += timedelta(days=1)

    # 7. Calculate availability using pre-grouped maps
    availability_data = []

    for room in room_types:
        room_data = {
            "id": room.id,
            "name": room.name,
            "totalInventory": room.total_inventory,
            "availability": []
        }

        for day in date_range:
            day_str = day.isoformat()
            booked_count = booked_by_room_date[(room.id, day_str)]
            blocked_count = blocked_by_room_date[(room.id, day_str)]

            available = max(0, room.total_inventory - booked_count - blocked_count)
            is_blocked = blocked_count >= room.total_inventory  # Fully blocked by blocks

            room_data["availability"].append({
                "date": day_str,
                "totalRooms": room.total_inventory,
                "bookedRooms": booked_count,
                "blockedRooms": blocked_count,
                "availableRooms": available,
                "isBlocked": is_blocked or available == 0,
                "price": price_map.get((room.id, day_str), room.base_price)
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
    end_date: date = Query(...)
):
    """Get blocks for a specific room and date range"""
    result = await session.execute(
        select(RoomBlock).where(
            RoomBlock.hotel_id == current_user.hotel_id,
            RoomBlock.room_type_id == room_type_id,
            RoomBlock.end_date >= start_date,
            RoomBlock.start_date <= end_date
        )
    )
    return result.scalars().all()


@router.post("/blocks", response_model=RoomBlockRead)
async def create_block(
    block_data: RoomBlockCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """Block rooms for a date range"""
    block = RoomBlock(
        **block_data.model_dump(),
        hotel_id=current_user.hotel_id
    )
    session.add(block)
    await session.commit()
    await session.refresh(block)
    clear_availability_cache(current_user.hotel_id)
    return block


@router.delete("/blocks/{block_id}")
async def delete_block(
    block_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """Remove a room block"""
    logger.debug(f"Attempting to delete block {block_id} for hotel {current_user.hotel_id}")
    result = await session.execute(
        select(RoomBlock).where(
            RoomBlock.id == block_id,
            RoomBlock.hotel_id == current_user.hotel_id
        )
    )
    block = result.scalar_one_or_none()
    
    if not block:
        logger.warning(f"Block {block_id} NOT FOUND for hotel {current_user.hotel_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found"
        )
        
    try:
        # Delete the block
        await session.delete(block)
        await session.commit()
        clear_availability_cache(current_user.hotel_id)
            
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
class RateUpdate(BaseModel):
    room_type_id: str
    start_date: date
    end_date: date
    price: float

@router.post("/rates", response_model=Dict[str, str])
async def update_daily_rates(
    rate_data: RateUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Set daily base price for a room type.
    Handles interval splitting to ensure no overlaps.
    """
    # 1. Verify ownership (via hotel_id)
    # Ideally check room_type ownership too, but for speed just checking logic
    
    # 2. Find overlapping existing rates (Base Price only -> rate_plan_id is None)
    stmt = select(RoomRate).where(
        RoomRate.hotel_id == current_user.hotel_id,
        RoomRate.room_type_id == rate_data.room_type_id,
        RoomRate.rate_plan_id == None,
        and_(
            RoomRate.date_from <= rate_data.end_date,
            RoomRate.date_to >= rate_data.start_date
        )
    )
    result = await session.execute(stmt)
    existing_rates = result.scalars().all()
    
    # 3. Process overlaps
    for existing in existing_rates:
        # Case A: Existing is fully inside new range -> Delete
        if existing.date_from >= rate_data.start_date and existing.date_to <= rate_data.end_date:
            await session.delete(existing)
            
        # Case B: Existing overlaps START of new range (starts before, ends inside/after)
        # e.g. Existing: 1st-5th. New: 3rd-4th. -> Update Existing to 1st-2nd.
        elif existing.date_from < rate_data.start_date and existing.date_to >= rate_data.start_date:
            # If it also extends BEYOND the new range (Case C: Fully Enclosing), we need to split!
            if existing.date_to > rate_data.end_date:
                # Create the tail part (New End + 1 -> Existing End)
                tail_rate = RoomRate(
                    hotel_id=existing.hotel_id,
                    room_type_id=existing.room_type_id,
                    rate_plan_id=None,
                    date_from=rate_data.end_date + timedelta(days=1),
                    date_to=existing.date_to,
                    price=existing.price
                )
                session.add(tail_rate)
                # Trim the head part
                existing.date_to = rate_data.start_date - timedelta(days=1)
                session.add(existing)
            else:
                # Just trim the end to be New Start - 1
                existing.date_to = rate_data.start_date - timedelta(days=1)
                session.add(existing)
                
        # Case D: Existing overlaps END of new range (starts inside, ends after)
        elif existing.date_from <= rate_data.end_date and existing.date_to > rate_data.end_date:
            # We already handled "Fully Enclosing" in Case B logic? verify.
            # strict inequality existing.date_from > rate_data.start_date ensures it wasn't caught above?
            # Wait, if Existing: 4th-8th. New: 2nd-5th.
            # existing.date_from (4) >= new.start (2) -> True.
            # existing.date_to (8) > new.end (5) -> True.
            # It's NOT fully inside.
            # Check logic again.
            
            # Trim the start
            existing.date_from = rate_data.end_date + timedelta(days=1)
            session.add(existing)

    await session.flush()
    
    # 4. Insert New Rate
    new_rate = RoomRate(
        hotel_id=current_user.hotel_id,
        room_type_id=rate_data.room_type_id,
        rate_plan_id=None,
        date_from=rate_data.start_date,
        date_to=rate_data.end_date,
        price=rate_data.price
    )
    session.add(new_rate)
    
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    
    return {"message": "Rates updated successfully"}


# --- HELPER FUNCTIONS FOR CLEAN CALENDAR OVERRIDES ---

async def set_single_day_rate(session: DbSession, hotel_id: str, room_type_id: str, d: date, price: float):
    # Query any overlapping rates
    stmt = select(RoomRate).where(
        RoomRate.hotel_id == hotel_id,
        RoomRate.room_type_id == room_type_id,
        RoomRate.rate_plan_id == None,
        RoomRate.date_from <= d,
        RoomRate.date_to >= d
    )
    res = await session.execute(stmt)
    overlaps = res.scalars().all()
    
    if not overlaps:
        new_rate = RoomRate(
            hotel_id=hotel_id,
            room_type_id=room_type_id,
            rate_plan_id=None,
            date_from=d,
            date_to=d,
            price=price
        )
        session.add(new_rate)
        return
        
    for existing in overlaps:
        if existing.date_from == d and existing.date_to == d:
            existing.price = price
            session.add(existing)
        elif existing.date_from < d and existing.date_to > d:
            left_rate = RoomRate(
                hotel_id=hotel_id,
                room_type_id=room_type_id,
                rate_plan_id=None,
                date_from=existing.date_from,
                date_to=d - timedelta(days=1),
                price=existing.price
            )
            right_rate = RoomRate(
                hotel_id=hotel_id,
                room_type_id=room_type_id,
                rate_plan_id=None,
                date_from=d + timedelta(days=1),
                date_to=existing.date_to,
                price=existing.price
            )
            session.add(left_rate)
            session.add(right_rate)
            
            existing.date_from = d
            existing.date_to = d
            existing.price = price
            session.add(existing)
        elif existing.date_from < d and existing.date_to == d:
            existing.date_to = d - timedelta(days=1)
            session.add(existing)
            target_rate = RoomRate(
                hotel_id=hotel_id,
                room_type_id=room_type_id,
                rate_plan_id=None,
                date_from=d,
                date_to=d,
                price=price
            )
            session.add(target_rate)
        elif existing.date_from == d and existing.date_to > d:
            existing.date_from = d + timedelta(days=1)
            session.add(existing)
            target_rate = RoomRate(
                hotel_id=hotel_id,
                room_type_id=room_type_id,
                rate_plan_id=None,
                date_from=d,
                date_to=d,
                price=price
            )
            session.add(target_rate)


async def set_single_day_block(session: DbSession, hotel_id: str, room_type_id: str, d: date, blocked_count: int):
    stmt = select(RoomBlock).where(
        RoomBlock.hotel_id == hotel_id,
        RoomBlock.room_type_id == room_type_id,
        RoomBlock.start_date <= d,
        RoomBlock.end_date >= d
    )
    res = await session.execute(stmt)
    overlaps = res.scalars().all()
    
    for existing in overlaps:
        if existing.start_date == d and existing.end_date == d:
            await session.delete(existing)
        elif existing.start_date < d and existing.end_date > d:
            left_block = RoomBlock(
                hotel_id=hotel_id,
                room_type_id=room_type_id,
                start_date=existing.start_date,
                end_date=d - timedelta(days=1),
                reason=existing.reason,
                blocked_count=existing.blocked_count
            )
            right_block = RoomBlock(
                hotel_id=hotel_id,
                room_type_id=room_type_id,
                start_date=d + timedelta(days=1),
                end_date=existing.end_date,
                reason=existing.reason,
                blocked_count=existing.blocked_count
            )
            session.add(left_block)
            session.add(right_block)
            await session.delete(existing)
        elif existing.start_date < d and existing.end_date == d:
            existing.end_date = d - timedelta(days=1)
            session.add(existing)
        elif existing.start_date == d and existing.end_date > d:
            existing.start_date = d + timedelta(days=1)
            session.add(existing)
            
    if blocked_count > 0:
        new_block = RoomBlock(
            hotel_id=hotel_id,
            room_type_id=room_type_id,
            start_date=d,
            end_date=d,
            reason="Weekend Block Override",
            blocked_count=blocked_count
        )
        session.add(new_block)


# --- REQUEST SCHEMAS & ENDPOINTS ---

class WeekendUpdateRequest(BaseModel):
    room_type_id: str
    start_date: date
    end_date: date
    price: Optional[float] = None
    blocked_count: Optional[int] = None
    reset_to_default: Optional[bool] = False


class CopyCalendarRequest(BaseModel):
    room_type_id: str
    source_start_date: date
    source_end_date: date
    target_start_date: date
    target_end_date: date
    copy_price: bool
    copy_availability: bool


@router.post("/weekend-update")
async def update_weekends(
    data: WeekendUpdateRequest,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Update pricing and/or availability block count specifically for Saturdays and Sundays
    within the chosen date range. Or reset overrides back to defaults.
    """
    curr = data.start_date
    updated_days = 0
    while curr <= data.end_date:
        # 5 is Saturday, 6 is Sunday
        if curr.weekday() in (5, 6):
            if data.reset_to_default:
                # Delete custom room rates for this day
                await session.execute(
                    delete(RoomRate).where(
                        RoomRate.hotel_id == current_user.hotel_id,
                        RoomRate.room_type_id == data.room_type_id,
                        RoomRate.rate_plan_id == None,
                        RoomRate.date_from <= curr,
                        RoomRate.date_to >= curr
                    )
                )
                # Delete custom room blocks for this day
                await session.execute(
                    delete(RoomBlock).where(
                        RoomBlock.hotel_id == current_user.hotel_id,
                        RoomBlock.room_type_id == data.room_type_id,
                        RoomBlock.start_date == curr,
                        RoomBlock.end_date == curr
                    )
                )
                updated_days += 1
            else:
                if data.price is not None:
                    await set_single_day_rate(session, current_user.hotel_id, data.room_type_id, curr, data.price)
                if data.blocked_count is not None:
                    await set_single_day_block(session, current_user.hotel_id, data.room_type_id, curr, data.blocked_count)
                updated_days += 1
        curr = curr + timedelta(days=1)
        
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    
    action_text = "reset to defaults" if data.reset_to_default else "applied"
    return {"message": f"Weekend updates {action_text} successfully for {updated_days} days."}


@router.post("/copy")
async def copy_calendar(
    data: CopyCalendarRequest,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Copy pricing and/or availability settings from a source date range to a target date range.
    Maps day-by-day sequentially.
    """
    room_type = await session.get(RoomType, data.room_type_id)
    if not room_type or room_type.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Room type not found")
        
    days_to_copy = (data.source_end_date - data.source_start_date).days + 1
    
    # Fetch source rates
    rates_stmt = select(RoomRate).where(
        RoomRate.hotel_id == current_user.hotel_id,
        RoomRate.room_type_id == data.room_type_id,
        RoomRate.rate_plan_id == None,
        RoomRate.date_from <= data.source_end_date,
        RoomRate.date_to >= data.source_start_date
    )
    rates_res = await session.execute(rates_stmt)
    source_rates = rates_res.scalars().all()
    
    price_map = {}
    for r in source_rates:
        curr = r.date_from
        while curr <= r.date_to:
            price_map[curr] = r.price
            curr = curr + timedelta(days=1)
            
    # Fetch source blocks
    blocks_stmt = select(RoomBlock).where(
        RoomBlock.hotel_id == current_user.hotel_id,
        RoomBlock.room_type_id == data.room_type_id,
        RoomBlock.start_date <= data.source_end_date,
        RoomBlock.end_date >= data.source_start_date
    )
    blocks_res = await session.execute(blocks_stmt)
    source_blocks = blocks_res.scalars().all()
    
    block_map = {}
    for b in source_blocks:
        curr = b.start_date
        while curr <= b.end_date:
            block_map[curr] = block_map.get(curr, 0) + b.blocked_count
            curr = curr + timedelta(days=1)
            
    for i in range(days_to_copy):
        src_day = data.source_start_date + timedelta(days=i)
        tgt_day = data.target_start_date + timedelta(days=i)
        
        if data.copy_price:
            price = price_map.get(src_day, float(room_type.base_price))
            await set_single_day_rate(session, current_user.hotel_id, data.room_type_id, tgt_day, price)
            
        if data.copy_availability:
            blocked_count = block_map.get(src_day, 0)
            await set_single_day_block(session, current_user.hotel_id, data.room_type_id, tgt_day, blocked_count)
            
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    return {"message": f"Calendar settings copied successfully for {days_to_copy} days."}
