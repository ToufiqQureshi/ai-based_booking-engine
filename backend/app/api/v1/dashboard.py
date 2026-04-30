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
    Parallel execution optimized.
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

    # Parallel Execution of DB Queries
    queries = [
        # arrivals_today
        session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == current_user.hotel_id, Booking.check_in == today,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        )),
        # departures_today
        session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == current_user.hotel_id, Booking.check_out == today,
            Booking.status == BookingStatus.CHECKED_IN
        )),
        # occupancy_today
        session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == current_user.hotel_id, Booking.status == BookingStatus.CHECKED_IN
        )),
        # revenue_today
        session.execute(select(func.sum(Booking.total_amount)).where(
            Booking.hotel_id == current_user.hotel_id, Booking.created_at >= start_of_day
        )),
        # arrivals_yest
        session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == current_user.hotel_id, Booking.check_in == yesterday,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        )),
        # occupancy_yest
        session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == current_user.hotel_id, 
            Booking.status == BookingStatus.CHECKED_IN,
            Booking.updated_at < start_of_day
        )),
        # revenue_yest
        session.execute(select(func.sum(Booking.total_amount)).where(
            Booking.hotel_id == current_user.hotel_id, 
            Booking.created_at >= start_of_yest,
            Booking.created_at < start_of_day
        )),
        # pending_bookings
        session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == current_user.hotel_id, Booking.status == BookingStatus.PENDING
        )),
        # total_rooms
        session.execute(select(func.sum(RoomType.total_inventory)).where(
            RoomType.hotel_id == current_user.hotel_id, RoomType.is_active == True
        ))
    ]

    results = await asyncio.gather(*queries)

    arrivals_today = results[0].scalar() or 0
    departures_today = results[1].scalar() or 0
    occupancy_today = results[2].scalar() or 0
    revenue_today = float(results[3].scalar() or 0)
    arrivals_yest = results[4].scalar() or 0
    occupancy_yest = results[5].scalar() or 0
    revenue_yest = float(results[6].scalar() or 0)
    pending_bookings = results[7].scalar() or 0
    total_rooms = results[8].scalar() or 0

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

    # Cache result if Redis is working
    try:
        redis_client.set_value(cache_key, json.dumps(data), expire=300)
    except Exception as e:
        print(f"Redis Write Failed: {e}")

    return data


@router.get("/recent-bookings")
async def get_recent_bookings(current_user: CurrentUser, session: DbSession):
    """Recent 5 bookings for dashboard"""
    from app.models.booking import Guest
    
    # Check Cache
    cache_key = f"dashboard_recent_bookings:{current_user.hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except: pass
    
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
    
    # Cache for 1 min only (updates frequently)
    try:
        redis_client.set_value(cache_key, json.dumps(response), expire=60)
    except: pass

    return response
