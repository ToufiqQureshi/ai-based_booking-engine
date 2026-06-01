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
from app.core.cache import cache_response

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
@cache_response(expire=300, key_prefix="dashboard_stats")
async def get_dashboard_stats(current_user: CurrentUser, session: DbSession):
    """
    Dashboard ke liye summary stats.
    Parallel execution optimized + Redis cache (5 min TTL).
    """

    today = date.today()
    yesterday = today - timedelta(days=1)
    start_of_day = datetime.combine(today, datetime.min.time())
    start_of_yest = start_of_day - timedelta(days=1)

    # Optimized: Combined query for most metrics using conditional aggregation
    stats_query = select(
        func.count(Booking.id).filter(
            Booking.check_in == today,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        ).label('arrivals_today'),

        func.count(Booking.id).filter(
            Booking.check_out == today,
            Booking.status == BookingStatus.CHECKED_IN
        ).label('departures_today'),

        func.count(Booking.id).filter(
            Booking.status == BookingStatus.CHECKED_IN
        ).label('occupancy_today'),

        func.sum(Booking.total_amount).filter(
            Booking.created_at >= start_of_day
        ).label('revenue_today'),

        func.count(Booking.id).filter(
            Booking.check_in == yesterday,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING])
        ).label('arrivals_yest'),

        func.count(Booking.id).filter(
            Booking.status == BookingStatus.CHECKED_IN,
            Booking.updated_at < start_of_day
        ).label('occupancy_yest'),

        func.sum(Booking.total_amount).filter(
            Booking.created_at >= start_of_yest,
            Booking.created_at < start_of_day
        ).label('revenue_yest'),

        func.count(Booking.id).filter(
            Booking.status == BookingStatus.PENDING
        ).label('pending_bookings')
    ).where(Booking.hotel_id == current_user.hotel_id)

    stats_res = await session.execute(stats_query)
    stats = stats_res.one()

    arrivals_today = stats.arrivals_today or 0
    departures_today = stats.departures_today or 0
    occupancy_today = stats.occupancy_today or 0
    revenue_today = float(stats.revenue_today or 0)
    arrivals_yest = stats.arrivals_yest or 0
    occupancy_yest = stats.occupancy_yest or 0
    revenue_yest = float(stats.revenue_yest or 0)
    pending_bookings = stats.pending_bookings or 0

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

    return data


@router.get("/recent-bookings")
@cache_response(expire=60, key_prefix="dashboard_recent_bookings")
async def get_recent_bookings(current_user: CurrentUser, session: DbSession):
    """Recent 5 bookings for dashboard — Redis cache (1 min TTL)"""
    from app.models.booking import Guest
    
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
    
    return response
