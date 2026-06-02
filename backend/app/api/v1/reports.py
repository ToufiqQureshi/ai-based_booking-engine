"""
Reports Endpoints — Dashboard stats and occupancy reports.
"""
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Query, Request
from sqlmodel import func, select

from app.api.deps import CurrentUser, DbSession
from app.core.cache import cache_response
from app.models.booking import Booking, BookingStatus
from app.models.room import RoomType

router = APIRouter(prefix="/reports", tags=["Reports"])


def _build_occupied_per_date(bookings, start_date: date, end_date: date) -> dict:
    """
    Single-pass O(bookings × avg_nights) occupancy aggregation.
    Much faster than the naive O(days × bookings) nested loop.
    """
    occupied: dict[date, int] = defaultdict(int)
    for b in bookings:
        cur = max(b.check_in, start_date)
        stop = min(b.check_out, end_date + timedelta(days=1))
        rooms_count = len(b.rooms) if b.rooms else 1
        while cur < stop:
            occupied[cur] += rooms_count
            cur += timedelta(days=1)
    return occupied


@router.get("/dashboard")
@cache_response(expire=1800, key_prefix="reports_dashboard")
async def get_dashboard_stats(
    request: Request,
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    """Consolidated dashboard stats for the last N days."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    bookings_res = await session.execute(
        select(Booking).where(
            Booking.hotel_id == current_user.hotel_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
            Booking.check_out > start_date,
            Booking.check_in <= end_date,
        )
    )
    bookings = bookings_res.scalars().all()

    total_revenue = sum(b.total_amount for b in bookings)
    total_bookings = len(bookings)

    inventory_res = await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == current_user.hotel_id)
    )
    total_inventory = inventory_res.scalar() or 0

    # Build daily stats dict
    daily_stats: dict[date, dict] = {}
    for i in range(days + 1):
        d = start_date + timedelta(days=i)
        daily_stats[d] = {"date": d.isoformat(), "revenue": 0, "occupancy": 0, "bookings": 0}

    # Revenue & booking count — O(bookings)
    for b in bookings:
        if b.check_in in daily_stats:
            daily_stats[b.check_in]["revenue"] += b.total_amount
            daily_stats[b.check_in]["bookings"] += 1

    # Occupancy — single-pass O(bookings × avg_nights)
    if total_inventory > 0:
        occupied_map = _build_occupied_per_date(bookings, start_date, end_date)
        for d, stats in daily_stats.items():
            occ = occupied_map.get(d, 0)
            stats["occupancy"] = min(100, int((occ / total_inventory) * 100))

    chart_data = sorted(daily_stats.values(), key=lambda x: x["date"])
    avg_occupancy = sum(d["occupancy"] for d in chart_data) / len(chart_data) if chart_data else 0

    return {
        "summary": {
            "totalRevenue": total_revenue,
            "totalBookings": total_bookings,
            "occupancyRate": int(avg_occupancy),
            "netProfit": int(total_revenue * 0.7),
        },
        "revenueChart": chart_data,
        "occupancyChart": chart_data,
    }


@router.get("/occupancy")
@cache_response(expire=1800, key_prefix="reports_occupancy")
async def get_occupancy_report(
    request: Request,
    current_user: CurrentUser,
    session: DbSession,
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
):
    """Occupancy report for a date range."""
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    inventory_res = await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == current_user.hotel_id)
    )
    total_inventory = inventory_res.scalar() or 0

    if total_inventory == 0:
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_inventory": 0,
            "average_occupancy": 0,
            "daily_occupancy": [],
        }

    bookings_res = await session.execute(
        select(Booking).where(
            Booking.hotel_id == current_user.hotel_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
            Booking.check_out > start_date,
            Booking.check_in < end_date,
        )
    )
    bookings = bookings_res.scalars().all()

    # Single-pass occupancy aggregation
    occupied_map = _build_occupied_per_date(bookings, start_date, end_date)

    daily_occupancy = []
    total_occ = 0
    cur = start_date
    while cur <= end_date:
        occupied = occupied_map.get(cur, 0)
        occ_rate = min(100, int((occupied / total_inventory) * 100))
        daily_occupancy.append({
            "date": cur.isoformat(),
            "occupied_rooms": occupied,
            "available_rooms": total_inventory - occupied,
            "occupancy_rate": occ_rate,
        })
        total_occ += occ_rate
        cur += timedelta(days=1)

    days_count = len(daily_occupancy)
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_inventory": total_inventory,
        "average_occupancy": int(total_occ / days_count) if days_count else 0,
        "daily_occupancy": daily_occupancy,
    }
