"""
Analytics dashboard and live endpoints — auth required.
Provides aggregated stats from bookings and session tracking data.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import func, select

from app.core.deps import CurrentUser, DbSession, require_hotel_role
from app.analytics.models import AnalyticsSession
from app.bookings.booking import Booking, BookingSource, BookingStatus
from app.rooms.room import RoomType

router = APIRouter(tags=["Analytics"])

_AUTH = [Depends(require_hotel_role("OWNER", "MANAGER", "STAFF"))]


# ── helpers ───────────────────────────────────────────────────────────────────

async def _get_bookings(session, hotel_id: str, start_date: date, end_date: date):
    result = await session.execute(
        select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.status.in_([
                BookingStatus.PENDING, BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT,
            ]),
            Booking.created_at >= datetime.combine(start_date, datetime.min.time()),
        )
    )
    return result.scalars().all()


async def _get_inventory(session, hotel_id: str) -> int:
    result = await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == hotel_id)
    )
    return int(result.scalar() or 0)


def _occupancy_rate(bookings, total_inventory: int, start_date: date, end_date: date) -> float:
    if not total_inventory or not bookings:
        return 0.0
    occupied: dict[date, int] = defaultdict(int)
    for b in bookings:
        cur = max(b.check_in, start_date)
        stop = min(b.check_out, end_date + timedelta(days=1))
        rooms_count = len(b.rooms) if b.rooms else 1
        while cur < stop:
            occupied[cur] += rooms_count
            cur += timedelta(days=1)
    days = (end_date - start_date).days + 1
    total_occ = sum(min(occupied.get(start_date + timedelta(days=i), 0), total_inventory) for i in range(days))
    return min(100.0, (total_occ / (total_inventory * days)) * 100)


# ── dashboard (main) ──────────────────────────────────────────────────────────

@router.get("/dashboard", dependencies=_AUTH)
async def get_analytics_dashboard(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    bookings = await _get_bookings(session, current_user.hotel_id, start_date, end_date)
    inventory = await _get_inventory(session, current_user.hotel_id)

    revenue_total = sum(b.total_amount for b in bookings)
    ai_bookings = [b for b in bookings if b.source == BookingSource.AI_AGENT]
    ai_revenue = sum(b.total_amount for b in ai_bookings)
    cancelled = await session.execute(
        select(Booking).where(
            Booking.hotel_id == current_user.hotel_id,
            Booking.status == BookingStatus.CANCELLED,
            Booking.check_in >= start_date,
        )
    )
    cancelled_list = cancelled.scalars().all()

    sessions_res = await session.execute(
        select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            AnalyticsSession.started_at >= datetime.combine(start_date, datetime.min.time()),
        )
    )
    sessions = sessions_res.scalars().all()
    total_visitors = len(sessions)
    converted = sum(1 for s in sessions if s.has_booked)
    conversion_rate = round((converted / total_visitors * 100), 1) if total_visitors > 0 else 0.0

    occ_rate = _occupancy_rate(bookings, inventory, start_date, end_date)

    # chart_data: daily revenue
    daily: dict[date, dict] = {}
    for i in range(days + 1):
        d = start_date + timedelta(days=i)
        daily[d] = {"date": d.isoformat(), "revenue": 0.0, "bookings": 0}
    for b in bookings:
        if b.check_in in daily:
            daily[b.check_in]["revenue"] += b.total_amount
            daily[b.check_in]["bookings"] += 1
    chart_data = sorted(daily.values(), key=lambda x: x["date"])

    # occupancy forecast
    occ_forecast = [
        {"date": d["date"], "occupancy": min(100, int(occ_rate))}
        for d in chart_data
    ]

    # device breakdown from sessions
    device_stats = defaultdict(int)
    for s in sessions:
        device_stats[s.device_type or "unknown"] += 1

    return {
        "total_visitors": total_visitors,
        "conversion_rate": conversion_rate,
        "revenue_total": revenue_total,
        "chart_data": chart_data,
        "funnel_data": {
            "visitors": total_visitors,
            "engaged": max(0, total_visitors - converted),
            "converted": converted,
        },
        "device_stats": dict(device_stats),
        "occupancy_rate": round(occ_rate),
        "avg_daily_rate": round(revenue_total / len(bookings), 2) if bookings else 0.0,
        "ai_assisted_bookings": len(ai_bookings),
        "ai_revenue": ai_revenue,
        "occupancy_forecast": occ_forecast,
        "cancellations_count": len(cancelled_list),
        "lost_revenue": sum(b.total_amount for b in cancelled_list),
    }


# ── dashboard sub-reports ─────────────────────────────────────────────────────

@router.get("/dashboard/overview", dependencies=_AUTH)
async def dashboard_overview(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    sessions_res = await session.execute(
        select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            AnalyticsSession.started_at >= datetime.combine(start_date, datetime.min.time()),
        )
    )
    sessions = sessions_res.scalars().all()
    total_visitors = len(sessions)
    converted = sum(1 for s in sessions if s.has_booked)
    return {
        "total_visitors": total_visitors,
        "funnel_data": {
            "visitors": total_visitors,
            "engaged": max(0, total_visitors - converted),
            "converted": converted,
        },
    }


@router.get("/dashboard/revenue", dependencies=_AUTH)
async def dashboard_revenue(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    bookings = await _get_bookings(session, current_user.hotel_id, start_date, end_date)
    inventory = await _get_inventory(session, current_user.hotel_id)

    revenue_total = sum(b.total_amount for b in bookings)
    occ = _occupancy_rate(bookings, inventory, start_date, end_date)

    daily: dict[date, dict] = {}
    for i in range(days + 1):
        d = start_date + timedelta(days=i)
        daily[d] = {"date": d.isoformat(), "occupancy": min(100, round(occ))}
    occ_forecast = sorted(daily.values(), key=lambda x: x["date"])

    return {
        "revenue_total": revenue_total,
        "avg_daily_rate": round(revenue_total / len(bookings), 2) if bookings else 0.0,
        "occupancy_forecast": occ_forecast,
    }


@router.get("/dashboard/traffic", dependencies=_AUTH)
async def dashboard_traffic(
    current_user: CurrentUser,
    session: DbSession,
):
    sessions_res = await session.execute(
        select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            AnalyticsSession.started_at >= datetime.utcnow() - timedelta(days=7),
        )
    )
    sessions = sessions_res.scalars().all()

    geo_stats: dict[str, int] = defaultdict(int)
    for s in sessions:
        geo_stats[s.country or "Unknown"] += 1

    # 7 days × 24 hours heatmap (always exactly 168 entries)
    heatmap = []
    today = date.today()
    heat_counts: dict[tuple[int, int], int] = defaultdict(int)
    for s in sessions:
        d = s.started_at.date()
        day_offset = (today - d).days
        if 0 <= day_offset < 7:
            heat_counts[(day_offset, s.started_at.hour)] += 1
    for day_offset in range(7):
        for hour in range(24):
            heatmap.append({
                "day": day_offset,
                "hour": hour,
                "count": heat_counts.get((day_offset, hour), 0),
            })

    return {
        "geo_stats": dict(geo_stats),
        "traffic_heatmap": heatmap,
    }


@router.get("/dashboard/ai", dependencies=_AUTH)
async def dashboard_ai(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    bookings = await _get_bookings(session, current_user.hotel_id, start_date, end_date)
    ai_bookings = [b for b in bookings if b.source == BookingSource.AI_AGENT]
    return {
        "ai_resolution_rate": round(len(ai_bookings) / len(bookings) * 100, 1) if bookings else 0.0,
        "total_leads": len(bookings),
        "ai_assisted_bookings": len(ai_bookings),
    }


@router.get("/dashboard/cancellations", dependencies=_AUTH)
async def dashboard_cancellations(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    start_date = date.today() - timedelta(days=days)
    result = await session.execute(
        select(Booking).where(
            Booking.hotel_id == current_user.hotel_id,
            Booking.status == BookingStatus.CANCELLED,
            Booking.created_at >= datetime.combine(start_date, datetime.min.time()),
        )
    )
    cancelled = result.scalars().all()
    return {
        "cancellations_count": len(cancelled),
        "lost_revenue": sum(b.total_amount for b in cancelled),
    }


@router.get("/dashboard/kpis", dependencies=_AUTH)
async def dashboard_kpis(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    bookings = await _get_bookings(session, current_user.hotel_id, start_date, end_date)
    inventory = await _get_inventory(session, current_user.hotel_id)

    sessions_res = await session.execute(
        select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            AnalyticsSession.started_at >= datetime.combine(start_date, datetime.min.time()),
        )
    )
    total_visitors = len(sessions_res.scalars().all())
    occ = _occupancy_rate(bookings, inventory, start_date, end_date)

    return {
        "total_visitors": total_visitors,
        "revenue_total": sum(b.total_amount for b in bookings),
        "occupancy_rate": round(occ),
    }


# ── live endpoints ────────────────────────────────────────────────────────────

@router.get("/live/active", dependencies=_AUTH)
async def live_active(current_user: CurrentUser, session: DbSession):
    """Count sessions active in the last 5 minutes."""
    cutoff = datetime.utcnow() - timedelta(minutes=5)
    result = await session.execute(
        select(func.count(AnalyticsSession.id)).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            AnalyticsSession.ended_at >= cutoff,
        )
    )
    count = result.scalar() or 0
    return {"active_visitors": int(count)}


@router.get("/live/feed", dependencies=_AUTH)
async def live_feed(
    current_user: CurrentUser,
    session: DbSession,
    limit: int = Query(default=20, le=50),
):
    """Return recent sessions for the live feed."""
    result = await session.execute(
        select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
        )
        .order_by(AnalyticsSession.started_at.desc())
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [
        {
            "session_id": s.id,
            "device_type": s.device_type or "unknown",
            "country": s.country,
            "has_booked": s.has_booked,
            "time_spent_seconds": s.time_spent_seconds,
            "started_at": s.started_at.isoformat(),
        }
        for s in sessions
    ]
