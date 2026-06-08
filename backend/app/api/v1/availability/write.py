"""
Write availability endpoints: create/delete blocks, set rates,
weekend bulk-update, and calendar copy.
"""
import logging
import time
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import select, delete

from app.api.deps import CurrentUser, DbSession
from app.models.room import RoomType, RoomBlock, RoomBlockCreate, RoomBlockRead
from app.models.rates import RoomRate
from app.core.redis_client import redis_client

from .helpers import _assert_room_type_owned, clear_availability_cache, set_single_day_rate, set_single_day_block

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/availability", tags=["Availability"])


def _bump_rate_version(hotel_id: str) -> None:
    """Notify SSE clients that prices changed so guests re-fetch room rates."""
    try:
        redis_client.set_value(f"rate_version:{hotel_id}", str(int(time.time())), expire=86400)
    except Exception:
        pass


@router.post("/blocks", response_model=RoomBlockRead)
async def create_block(block_data: RoomBlockCreate, current_user: CurrentUser, session: DbSession):
    """Block rooms for a date range (e.g. maintenance, hold)."""
    await _assert_room_type_owned(session, block_data.room_type_id, current_user.hotel_id)
    block = RoomBlock(**block_data.model_dump(), hotel_id=current_user.hotel_id)
    session.add(block)
    await session.commit()
    await session.refresh(block)
    clear_availability_cache(current_user.hotel_id)
    return block


@router.delete("/blocks/{block_id}")
async def delete_block(block_id: str, current_user: CurrentUser, session: DbSession):
    """Remove a room block."""
    logger.debug(f"Attempting to delete block {block_id} for hotel {current_user.hotel_id}")
    result = await session.execute(
        select(RoomBlock).where(
            RoomBlock.id == block_id,
            RoomBlock.hotel_id == current_user.hotel_id,
        )
    )
    block = result.scalar_one_or_none()
    if not block:
        logger.warning(f"Block {block_id} NOT FOUND for hotel {current_user.hotel_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")

    try:
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


@router.post("/rates")
async def update_daily_rates(rate_data: RateUpdate, current_user: CurrentUser, session: DbSession):
    """
    Set daily base price for a room type over a date range.
    Handles interval splitting so no overlapping rate records exist.
    """
    await _assert_room_type_owned(session, rate_data.room_type_id, current_user.hotel_id)

    stmt = select(RoomRate).where(
        RoomRate.hotel_id == current_user.hotel_id,
        RoomRate.room_type_id == rate_data.room_type_id,
        RoomRate.rate_plan_id == None,
        RoomRate.date_from <= rate_data.end_date,
        RoomRate.date_to >= rate_data.start_date,
    )
    existing_rates = (await session.execute(stmt)).scalars().all()

    for existing in existing_rates:
        # Fully inside new range → delete
        if existing.date_from >= rate_data.start_date and existing.date_to <= rate_data.end_date:
            await session.delete(existing)

        # Existing starts before AND ends after new range (fully enclosing) → split head + tail
        elif existing.date_from < rate_data.start_date and existing.date_to > rate_data.end_date:
            session.add(RoomRate(
                hotel_id=existing.hotel_id, room_type_id=existing.room_type_id, rate_plan_id=None,
                date_from=rate_data.end_date + timedelta(days=1), date_to=existing.date_to,
                price=existing.price,
            ))
            existing.date_to = rate_data.start_date - timedelta(days=1)
            session.add(existing)

        # Overlaps START of new range (starts before, ends inside)
        elif existing.date_from < rate_data.start_date and existing.date_to >= rate_data.start_date:
            existing.date_to = rate_data.start_date - timedelta(days=1)
            session.add(existing)

        # Overlaps END of new range (starts inside, ends after)
        elif existing.date_from <= rate_data.end_date and existing.date_to > rate_data.end_date:
            existing.date_from = rate_data.end_date + timedelta(days=1)
            session.add(existing)

    await session.flush()

    session.add(RoomRate(
        hotel_id=current_user.hotel_id,
        room_type_id=rate_data.room_type_id,
        rate_plan_id=None,
        date_from=rate_data.start_date,
        date_to=rate_data.end_date,
        price=rate_data.price,
    ))
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    _bump_rate_version(current_user.hotel_id)
    return {"message": "Rates updated successfully"}


class WeekendUpdateRequest(BaseModel):
    room_type_id: str
    start_date: date
    end_date: date
    price: Optional[float] = None
    blocked_count: Optional[int] = None
    reset_to_default: Optional[bool] = False


@router.post("/weekend-update")
async def update_weekends(data: WeekendUpdateRequest, current_user: CurrentUser, session: DbSession):
    """
    Bulk-update price and/or block count for all Saturdays and Sundays
    in the given range, or reset those overrides back to hotel defaults.
    """
    await _assert_room_type_owned(session, data.room_type_id, current_user.hotel_id)
    curr = data.start_date
    updated_days = 0
    while curr <= data.end_date:
        if curr.weekday() in (5, 6):   # Saturday = 5, Sunday = 6
            if data.reset_to_default:
                await session.execute(delete(RoomRate).where(
                    RoomRate.hotel_id == current_user.hotel_id,
                    RoomRate.room_type_id == data.room_type_id,
                    RoomRate.rate_plan_id == None,
                    RoomRate.date_from <= curr,
                    RoomRate.date_to >= curr,
                ))
                await session.execute(delete(RoomBlock).where(
                    RoomBlock.hotel_id == current_user.hotel_id,
                    RoomBlock.room_type_id == data.room_type_id,
                    RoomBlock.start_date == curr,
                    RoomBlock.end_date == curr,
                ))
            else:
                if data.price is not None:
                    await set_single_day_rate(session, current_user.hotel_id, data.room_type_id, curr, data.price)
                if data.blocked_count is not None:
                    await set_single_day_block(session, current_user.hotel_id, data.room_type_id, curr, data.blocked_count)
            updated_days += 1
        curr += timedelta(days=1)

    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    _bump_rate_version(current_user.hotel_id)
    action_text = "reset to defaults" if data.reset_to_default else "applied"
    return {"message": f"Weekend updates {action_text} successfully for {updated_days} days."}


class CopyCalendarRequest(BaseModel):
    room_type_id: str
    source_start_date: date
    source_end_date: date
    target_start_date: date
    target_end_date: date
    copy_price: bool
    copy_availability: bool


@router.post("/copy")
async def copy_calendar(data: CopyCalendarRequest, current_user: CurrentUser, session: DbSession):
    """
    Copy pricing and/or availability settings from a source date range to a target
    date range, mapping day-by-day sequentially.
    """
    room_type = await session.get(RoomType, data.room_type_id)
    if not room_type or room_type.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Room type not found")

    days_to_copy = (data.source_end_date - data.source_start_date).days + 1

    source_rates = (await session.execute(
        select(RoomRate).where(
            RoomRate.hotel_id == current_user.hotel_id,
            RoomRate.room_type_id == data.room_type_id,
            RoomRate.rate_plan_id == None,
            RoomRate.date_from <= data.source_end_date,
            RoomRate.date_to >= data.source_start_date,
        )
    )).scalars().all()

    price_map: dict = {}
    for r in source_rates:
        curr = r.date_from
        while curr <= r.date_to:
            price_map[curr] = r.price
            curr += timedelta(days=1)

    source_blocks = (await session.execute(
        select(RoomBlock).where(
            RoomBlock.hotel_id == current_user.hotel_id,
            RoomBlock.room_type_id == data.room_type_id,
            RoomBlock.start_date <= data.source_end_date,
            RoomBlock.end_date >= data.source_start_date,
        )
    )).scalars().all()

    block_map: dict = {}
    for b in source_blocks:
        curr = b.start_date
        while curr <= b.end_date:
            block_map[curr] = block_map.get(curr, 0) + b.blocked_count
            curr += timedelta(days=1)

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
    _bump_rate_version(current_user.hotel_id)
    return {"message": f"Calendar settings copied successfully for {days_to_copy} days."}
