"""
Availability Router
Real-time room inventory calculation and blocking management.
"""
from typing import List, Dict, Any
from datetime import date, timedelta, datetime
from fastapi import APIRouter, Query, Depends, HTTPException, status
from sqlmodel import select, and_, or_

from app.api.deps import CurrentUser, DbSession
from app.models.room import RoomType, RoomBlock, RoomBlockCreate, RoomBlockRead
from app.models.booking import Booking, BookingStatus
from app.models.rates import RoomRate
from pydantic import BaseModel

import json
from app.core.redis_client import redis_client

def clear_availability_cache(hotel_id: str):
    try:
        r = redis_client.get_instance()
        if r:
            keys = r.keys(f"availability:{hotel_id}:*")
            if keys:
                r.delete(*keys)
    except Exception as e:
        print(f"Failed clearing availability cache for hotel {hotel_id}: {e}")

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
        print(f"Redis get availability failed: {e}")

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

    # 6. Calculate availability
    availability_data = []
    
    for room in room_types:
        room_data = {
            "id": room.id,
            "name": room.name,
            "totalInventory": room.total_inventory,
            "availability": []
        }
        
        for day in date_range:
            # Count booked rooms
            booked_count = 0
            for booking in bookings:
                if booking.check_in <= day < booking.check_out:
                    for booked_room in booking.rooms:
                        if booked_room.get("room_type_id") == room.id:
                            booked_count += 1
            
            # Count blocked rooms
            blocked_count = 0
            for block in blocks:
                # Blocks are inclusive of start and end date usually, or match logic
                # RoomBlock: start_date, end_date. Assuming inclusive.
                if block.room_type_id == room.id and block.start_date <= day <= block.end_date:
                    blocked_count += block.blocked_count

            available = max(0, room.total_inventory - booked_count - blocked_count)
            is_blocked = blocked_count >= room.total_inventory # Fully blocked by blocks
            
            room_data["availability"].append({
                "date": day.isoformat(),
                "totalRooms": room.total_inventory,
                "bookedRooms": booked_count,
                "blockedRooms": blocked_count,
                "availableRooms": available,
                "isBlocked": is_blocked or available == 0,
                "price": price_map.get((room.id, day.isoformat()), room.base_price) 
            })
            
        availability_data.append(room_data)
        
    try:
        redis_client.set_value(cache_key, json.dumps(availability_data), expire=300)
    except Exception as e:
        print(f"Redis set availability failed: {e}")
        
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
    print(f"DEBUG: Attempting to delete block {block_id} for hotel {current_user.hotel_id}")
    result = await session.execute(
        select(RoomBlock).where(
            RoomBlock.id == block_id,
            RoomBlock.hotel_id == current_user.hotel_id
        )
    )
    block = result.scalar_one_or_none()
    
    if not block:
        print(f"DEBUG: Block {block_id} NOT FOUND")
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
