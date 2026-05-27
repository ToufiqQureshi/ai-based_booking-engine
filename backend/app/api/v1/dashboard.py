"""
Dashboard Router
Dashboard stats aur reports ke liye.
Optimized for performance: Parallel Queries + Redis Caching
"""
from datetime import datetime, date, timedelta
import asyncio
import json
from fastapi import APIRouter
from sqlmodel import select, func

from app.api.deps import CurrentUser, DbSession
from app.models.booking import Booking, BookingStatus
from app.models.room import RoomType
from app.core.redis_client import redis_client

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(current_user: CurrentUser, session: DbSession):
    """
    Dashboard ke liye summary stats.
    Parallel execution optimized + Redis cache (5 min TTL).
    """
    cache_key = f"dashboard_stats:{current_user.hotel_id}"
    try:
        cached_data = redis_client.get_value(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        print(f"Redis Read Failed or Not Configured: {e}")

    today = date.today()
    yesterday = today - timedelta(days=1)
    start_of_day = datetime.combine(today, datetime.min.time())
    start_of_yest = start_of_day - timedelta(days=1)

    # Sequential execution of DB queries (SQLAlchemy AsyncSession does not allow parallel execution)
    arrivals_today_res = await session.execute(select(func.count(Booking.id)).where(
        Booking.hotel_id == current_user.hotel_id, Booking.check_in == today,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
    ))
    arrivals_today = arrivals_today_res.scalar() or 0

    departures_today_res = await session.execute(select(func.count(Booking.id)).where(
        Booking.hotel_id == current_user.hotel_id, Booking.check_out == today,
        Booking.status == BookingStatus.CHECKED_IN
    ))
    departures_today = departures_today_res.scalar() or 0

    occupancy_today_res = await session.execute(select(func.count(Booking.id)).where(
        Booking.hotel_id == current_user.hotel_id, Booking.status == BookingStatus.CHECKED_IN
    ))
    occupancy_today = occupancy_today_res.scalar() or 0

    revenue_today_res = await session.execute(select(func.sum(Booking.total_amount)).where(
        Booking.hotel_id == current_user.hotel_id, Booking.created_at >= start_of_day
    ))
    revenue_today = float(revenue_today_res.scalar() or 0)

    arrivals_yest_res = await session.execute(select(func.count(Booking.id)).where(
        Booking.hotel_id == current_user.hotel_id, Booking.check_in == yesterday,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
    ))
    arrivals_yest = arrivals_yest_res.scalar() or 0

    occupancy_yest_res = await session.execute(select(func.count(Booking.id)).where(
        Booking.hotel_id == current_user.hotel_id, 
        Booking.status == BookingStatus.CHECKED_IN,
        Booking.updated_at < start_of_day
    ))
    occupancy_yest = occupancy_yest_res.scalar() or 0

    revenue_yest_res = await session.execute(select(func.sum(Booking.total_amount)).where(
        Booking.hotel_id == current_user.hotel_id, 
        Booking.created_at >= start_of_yest,
        Booking.created_at < start_of_day
    ))
    revenue_yest = float(revenue_yest_res.scalar() or 0)

    pending_bookings_res = await session.execute(select(func.count(Booking.id)).where(
        Booking.hotel_id == current_user.hotel_id, Booking.status == BookingStatus.PENDING
    ))
    pending_bookings = pending_bookings_res.scalar() or 0

    total_rooms_res = await session.execute(select(func.sum(RoomType.total_inventory)).where(
        RoomType.hotel_id == current_user.hotel_id, RoomType.is_active == True
    ))
    total_rooms = total_rooms_res.scalar() or 0

    def calc_trend(curr, prev):
        if prev == 0: return 100 if curr > 0 else 0
        return round(((curr - prev) / prev) * 100, 1)

    data = {
        "today_arrivals": arrivals_today,
        "today_departures": departures_today,
        "current_occupancy": occupancy_today,
        "today_revenue": revenue_today,
        "pending_bookings": pending_bookings,
        "total_rooms": total_rooms,
        "trends": {
            "arrivals": calc_trend(arrivals_today, arrivals_yest),
            "occupancy": calc_trend(occupancy_today, occupancy_yest),
            "revenue": calc_trend(revenue_today, revenue_yest)
        }
    }

    # Cache result in Redis (5 minutes)
    try:
        redis_client.set_value(cache_key, json.dumps(data), expire=300)
    except Exception as e:
        print(f"Redis Write Failed: {e}")

    return data


@router.get("/recent-bookings")
async def get_recent_bookings(current_user: CurrentUser, session: DbSession):
    """Recent 5 bookings for dashboard — Redis cache (1 min TTL)"""
    from app.models.booking import Guest
    
    cache_key = f"dashboard_recent_bookings:{current_user.hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass
    
    result = await session.execute(
        select(Booking, Guest)
        .join(Guest, Booking.guest_id == Guest.id)
        .where(Booking.hotel_id == current_user.hotel_id)
        .order_by(Booking.created_at.desc())
        .limit(5)
    )
    rows = result.all()
    
    response = []
    for booking, guest in rows:
        booking_dict = booking.model_dump()
        # Dates to ISO string for JSON serialization
        booking_dict["check_in"] = booking.check_in.isoformat()
        booking_dict["check_out"] = booking.check_out.isoformat()
        booking_dict["created_at"] = booking.created_at.isoformat()
        booking_dict["updated_at"] = booking.updated_at.isoformat()

        guest_dict = guest.model_dump()
        guest_dict["created_at"] = guest.created_at.isoformat()

        booking_dict["guest"] = guest_dict
        response.append(booking_dict)
    
    # Cache for 1 min (bookings update frequently)
    try:
        redis_client.set_value(cache_key, json.dumps(response), expire=60)
    except Exception:
        pass

    return response
