"""
Shared helpers for availability: ownership guard, cache invalidation,
and single-day rate/block override utilities.
"""
import logging
from datetime import date, timedelta

from fastapi import HTTPException
from sqlmodel import select

from app.core.cache.redis_client import redis_client
from app.rooms.room import RoomType, RoomBlock
from app.rate_plans.rates_model import RoomRate

logger = logging.getLogger(__name__)


async def _assert_room_type_owned(session, room_type_id: str, hotel_id: str) -> None:
    """TEN-05: ensure a room_type_id belongs to the caller's hotel before
    writing blocks/rates against it (prevents dangling cross-tenant refs)."""
    rt = (await session.execute(
        select(RoomType.id).where(
            RoomType.id == room_type_id,
            RoomType.hotel_id == hotel_id,
        )
    )).scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=404, detail="Room type not found")


def clear_availability_cache(hotel_id: str) -> None:
    """Bust all availability + dependent caches for a hotel after an inventory change."""
    try:
        redis_client.delete_pattern(f"availability:{hotel_id}:*")
        redis_client.delete_pattern(f"public:rooms:{hotel_id}:*")
        redis_client.delete_pattern(f"public:calendar:{hotel_id}:*")
        redis_client.delete_pattern(f"analytics_dashboard:{hotel_id}:*")
        redis_client.delete_pattern(f"dashboard_stats:{hotel_id}:*")
    except Exception as e:
        logger.error(f"Failed clearing availability cache for hotel {hotel_id}: {e}")


async def set_single_day_rate(
    session, hotel_id: str, room_type_id: str, d: date, price: float
) -> None:
    """
    Write a price for a single day, splitting any overlapping multi-day rate
    record so there are no gaps or duplicate day coverage.
    """
    stmt = select(RoomRate).where(
        RoomRate.hotel_id == hotel_id,
        RoomRate.room_type_id == room_type_id,
        RoomRate.rate_plan_id == None,
        RoomRate.date_from <= d,
        RoomRate.date_to >= d,
    )
    res = await session.execute(stmt)
    overlaps = res.scalars().all()

    if not overlaps:
        session.add(RoomRate(
            hotel_id=hotel_id, room_type_id=room_type_id, rate_plan_id=None,
            date_from=d, date_to=d, price=price,
        ))
        return

    for existing in overlaps:
        if existing.date_from == d and existing.date_to == d:
            existing.price = price
            session.add(existing)
        elif existing.date_from < d and existing.date_to > d:
            # Existing spans this day — split into left / target / right
            session.add(RoomRate(
                hotel_id=hotel_id, room_type_id=room_type_id, rate_plan_id=None,
                date_from=existing.date_from, date_to=d - timedelta(days=1), price=existing.price,
            ))
            session.add(RoomRate(
                hotel_id=hotel_id, room_type_id=room_type_id, rate_plan_id=None,
                date_from=d + timedelta(days=1), date_to=existing.date_to, price=existing.price,
            ))
            existing.date_from = d
            existing.date_to = d
            existing.price = price
            session.add(existing)
        elif existing.date_from < d and existing.date_to == d:
            existing.date_to = d - timedelta(days=1)
            session.add(existing)
            session.add(RoomRate(
                hotel_id=hotel_id, room_type_id=room_type_id, rate_plan_id=None,
                date_from=d, date_to=d, price=price,
            ))
        elif existing.date_from == d and existing.date_to > d:
            existing.date_from = d + timedelta(days=1)
            session.add(existing)
            session.add(RoomRate(
                hotel_id=hotel_id, room_type_id=room_type_id, rate_plan_id=None,
                date_from=d, date_to=d, price=price,
            ))


async def set_single_day_block(
    session, hotel_id: str, room_type_id: str, d: date, blocked_count: int
) -> None:
    """
    Set the blocked count for a single day, splitting any overlapping multi-day block
    records first so block coverage stays non-overlapping.
    """
    stmt = select(RoomBlock).where(
        RoomBlock.hotel_id == hotel_id,
        RoomBlock.room_type_id == room_type_id,
        RoomBlock.start_date <= d,
        RoomBlock.end_date >= d,
    )
    res = await session.execute(stmt)
    overlaps = res.scalars().all()

    for existing in overlaps:
        if existing.start_date == d and existing.end_date == d:
            await session.delete(existing)
        elif existing.start_date < d and existing.end_date > d:
            session.add(RoomBlock(
                hotel_id=hotel_id, room_type_id=room_type_id,
                start_date=existing.start_date, end_date=d - timedelta(days=1),
                reason=existing.reason, blocked_count=existing.blocked_count,
            ))
            session.add(RoomBlock(
                hotel_id=hotel_id, room_type_id=room_type_id,
                start_date=d + timedelta(days=1), end_date=existing.end_date,
                reason=existing.reason, blocked_count=existing.blocked_count,
            ))
            await session.delete(existing)
        elif existing.start_date < d and existing.end_date == d:
            existing.end_date = d - timedelta(days=1)
            session.add(existing)
        elif existing.start_date == d and existing.end_date > d:
            existing.start_date = d + timedelta(days=1)
            session.add(existing)

    if blocked_count > 0:
        session.add(RoomBlock(
            hotel_id=hotel_id, room_type_id=room_type_id,
            start_date=d, end_date=d,
            reason="Weekend Block Override",
            blocked_count=blocked_count,
        ))
