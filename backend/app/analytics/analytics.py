"""
Analytics API — visitor tracking + hotelier analytics dashboard.

Public tracking endpoints (called by the booking widget, no auth):
    POST /analytics/track/start    -> create a session
    POST /analytics/track/ping     -> heartbeat / time-on-site
    POST /analytics/track/event    -> record a funnel event

Authenticated, hotel-scoped reporting:
    GET  /analytics/dashboard                 -> consolidated KPIs
    GET  /analytics/dashboard/{overview|revenue|traffic|ai|cancellations|kpis}
    GET  /analytics/live/{active|feed}        -> real-time visitors

Everything is tenant-scoped by current_user.hotel_id. Tracking writes are bound
to the hotel that owns the resolved session, never to a client-supplied hotel_id
beyond the initial (existence-checked) session start.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from sqlmodel import and_, func, or_, select

from app.core.deps import CurrentUser, DbSession
from app.core.cache import cache_response
from app.core.limiter import limiter
from app.core.time import utcnow
from app.bookings.booking import Booking, BookingStatus, BookingSource
from app.rooms.room import RoomType
from app.brand_console.hotel import Hotel
from app.brand_console.lead import Lead
from app.analytics.models import (
    AnalyticsSession,
    AnalyticsEvent,
    SessionStartRequest,
    SessionPingRequest,
    EventTrackRequest,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Bookings that count as "real" for revenue/occupancy. PENDING is included
# because a pending booking already holds inventory (the availability check in
# the booking-create path counts PENDING), so it represents committed activity
# and booked revenue. Only CANCELLED / CANCEL_REQUESTED are excluded.
_ACTIVE_STATUSES = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.CHECKED_IN,
    BookingStatus.CHECKED_OUT,
]
# A visitor is "live" if their session started within this window and hasn't ended.
_LIVE_WINDOW = timedelta(minutes=5)


def _parse_device(user_agent: Optional[str]) -> tuple[str, str]:
    """Cheap UA sniff — good enough for device/browser breakdowns without a
    heavyweight parser dependency."""
    ua = (user_agent or "").lower()
    if any(t in ua for t in ("mobile", "iphone", "android", "ipod")):
        device = "mobile"
    elif any(t in ua for t in ("ipad", "tablet")):
        device = "tablet"
    else:
        device = "desktop"
    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua:
        browser = "Safari"
    else:
        browser = "Other"
    return device, browser


def _build_occupied_per_date(bookings, start_date: date, end_date: date) -> dict:
    """Single-pass occupancy aggregation (rooms occupied per calendar day)."""
    occupied: dict[date, int] = defaultdict(int)
    for b in bookings:
        cur = max(b.check_in, start_date)
        stop = min(b.check_out, end_date + timedelta(days=1))
        rooms_count = len(b.rooms) if b.rooms else 1
        while cur < stop:
            occupied[cur] += rooms_count
            cur += timedelta(days=1)
    return occupied


# ─────────────────────────────── Public tracking ────────────────────────────


@router.post("/track/start")
@limiter.limit("60/minute")
async def track_start(
    request: Request,
    data: SessionStartRequest,
    session: DbSession,
    hotel_id: str = Query(..., min_length=1, max_length=64),
):
    """Start a visitor session for a hotel. Public — called by the widget."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        # 404 (not 401/500) — the widget may be embedded with a stale id.
        raise HTTPException(status_code=404, detail="Hotel not found")

    device, browser = _parse_device(data.user_agent)
    obj = AnalyticsSession(
        hotel_id=hotel_id,
        user_agent=data.user_agent,
        device_type=device,
        browser=browser,
        referrer=data.referrer,
    )
    session.add(obj)
    # Record the initial page_view event if a page_url was supplied.
    await session.flush()
    if data.page_url:
        session.add(AnalyticsEvent(
            session_id=obj.id, event_type="page_view", page_url=data.page_url,
        ))
    await session.commit()
    return {"session_id": obj.id}


@router.post("/track/ping")
@limiter.limit("120/minute")
async def track_ping(
    request: Request,
    data: SessionPingRequest,
    session: DbSession,
):
    """Heartbeat — accumulates time-on-site. Unknown sessions are ignored (not
    an error) so a stale browser tab can't generate 4xx noise."""
    obj = await session.get(AnalyticsSession, data.session_id)
    if not obj:
        return {"status": "ignored"}
    inc = max(0, min(int(data.time_spent_seconds or 0), 3600))  # clamp per-ping
    obj.time_spent_seconds = (obj.time_spent_seconds or 0) + inc
    session.add(obj)
    await session.commit()
    return {"status": "ok"}


@router.post("/track/event")
@limiter.limit("120/minute")
async def track_event(
    request: Request,
    data: EventTrackRequest,
    session: DbSession,
):
    """Record a funnel event against an existing session."""
    obj = await session.get(AnalyticsSession, data.session_id)
    if not obj:
        return {"status": "ignored"}

    session.add(AnalyticsEvent(
        session_id=obj.id,
        event_type=data.event_type,
        page_url=data.page_url,
        room_type_id=data.room_type_id,
        time_spent_seconds=data.time_spent_seconds or 0,
        metadata_json=data.metadata_json,
    ))
    # A completed booking flips the conversion flag on the session.
    if data.event_type == "booking_complete":
        obj.has_booked = True
        session.add(obj)
    await session.commit()
    return {"status": "ok"}


# ─────────────────────────── Dashboard computation ──────────────────────────


async def _compute_dashboard(session, hotel_id: str, days: int) -> dict:
    """All dashboard metrics in one place; sub-endpoints return slices of this."""
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    start_dt = datetime.utcnow() - timedelta(days=days)

    # --- Visitor sessions ---
    sessions = (await session.execute(
        select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_dt,
        )
    )).scalars().all()
    total_visitors = len(sessions)
    converted_sessions = sum(1 for s in sessions if s.has_booked)
    conversion_rate = round((converted_sessions / total_visitors) * 100, 2) if total_visitors else 0.0

    device_counts: dict[str, int] = defaultdict(int)
    geo_counts: dict[str, int] = defaultdict(int)
    for s in sessions:
        device_counts[s.device_type or "unknown"] += 1
        geo_counts[s.country or "Unknown"] += 1

    # --- Funnel events ---
    if sessions:
        session_ids = [s.id for s in sessions]
        events = (await session.execute(
            select(AnalyticsEvent).where(AnalyticsEvent.session_id.in_(session_ids))
        )).scalars().all()
    else:
        events = []
    event_counts: dict[str, int] = defaultdict(int)
    for e in events:
        event_counts[e.event_type] += 1
    funnel_data = [
        {"stage": "Visitors", "count": total_visitors},
        {"stage": "Room Views", "count": event_counts.get("room_view", 0)},
        {"stage": "Checkout", "count": event_counts.get("checkout_started", 0)},
        {"stage": "Booked", "count": event_counts.get("booking_complete", converted_sessions)},
    ]

    # --- Bookings (revenue / occupancy / AI attribution) ---
    # Count a booking if its stay overlaps the window (past occupancy) OR it was
    # *placed* within the window (recent booking activity, incl. upcoming stays).
    # Revenue/AI attribution care about booking activity; occupancy below only
    # ever sees the overlapping nights via _build_occupied_per_date.
    bookings = (await session.execute(
        select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.status.in_(_ACTIVE_STATUSES),
            or_(
                and_(Booking.check_out > start_date, Booking.check_in <= end_date),
                Booking.created_at >= start_dt,
            ),
        )
    )).scalars().all()
    revenue_total = float(sum(b.total_amount for b in bookings))
    ai_bookings = [b for b in bookings if b.source == BookingSource.AI_AGENT]
    ai_assisted_bookings = len(ai_bookings)
    ai_revenue = float(sum(b.total_amount for b in ai_bookings))

    inventory = (await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == hotel_id)
    )).scalar() or 0

    occupied_map = _build_occupied_per_date(bookings, start_date, end_date)
    total_room_nights = sum(occupied_map.values())
    avg_daily_rate = round(revenue_total / total_room_nights, 2) if total_room_nights else 0.0

    chart_data = []
    occ_forecast = []
    occ_sum = 0
    for i in range(days + 1):
        d = start_date + timedelta(days=i)
        occ_rooms = occupied_map.get(d, 0)
        # Clamp occupancy to a valid 0–100% range even if oversold.
        occ_pct = min(100, int((occ_rooms / inventory) * 100)) if inventory else 0
        day_revenue = float(sum(b.total_amount for b in bookings if b.check_in == d))
        chart_data.append({"date": d.isoformat(), "revenue": day_revenue, "occupancy": occ_pct})
        occ_forecast.append({"date": d.isoformat(), "occupancy": occ_pct})
        occ_sum += occ_pct
    occupancy_rate = int(occ_sum / len(chart_data)) if chart_data else 0

    # --- Leads / AI resolution ---
    leads = (await session.execute(
        select(Lead).where(Lead.hotel_id == hotel_id)
    )).scalars().all()
    total_leads = len(leads)
    converted_leads = sum(1 for l in leads if l.status == "converted")
    ai_resolution_rate = round((converted_leads / total_leads) * 100, 2) if total_leads else 0.0

    # --- Cancellations ---
    cancelled = (await session.execute(
        select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.status == BookingStatus.CANCELLED,
            Booking.check_in > start_date,
        )
    )).scalars().all()
    cancellations_count = len(cancelled)
    lost_revenue = float(sum(b.total_amount for b in cancelled))

    # --- Traffic heatmap: always exactly 7 days × 24 hours = 168 cells ---
    heat_counts: dict[tuple[int, int], int] = defaultdict(int)
    for s in sessions:
        heat_counts[(s.started_at.weekday(), s.started_at.hour)] += 1
    traffic_heatmap = [
        {"day": dow, "hour": hour, "count": heat_counts.get((dow, hour), 0)}
        for dow in range(7)
        for hour in range(24)
    ]

    return {
        "total_visitors": total_visitors,
        "conversion_rate": conversion_rate,
        "revenue_total": revenue_total,
        "chart_data": chart_data,
        "funnel_data": funnel_data,
        "device_stats": [{"type": k, "count": v} for k, v in device_counts.items()],
        "occupancy_rate": occupancy_rate,
        "avg_daily_rate": avg_daily_rate,
        "ai_assisted_bookings": ai_assisted_bookings,
        "ai_revenue": ai_revenue,
        "occupancy_forecast": occ_forecast,
        "geo_stats": [{"country": k, "code": k[:2].lower(), "visitors": v, "percentage": round((v/max(total_visitors, 1))*100)} for k, v in geo_counts.items()],
        "traffic_heatmap": traffic_heatmap,
        "ai_resolution_rate": ai_resolution_rate,
        "total_leads": total_leads,
        "cancellations_count": cancellations_count,
        "lost_revenue": lost_revenue,
    }


@router.get("/dashboard")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_dashboard")
async def analytics_dashboard(
    request: Request,
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    return await _compute_dashboard(session, current_user.hotel_id, days)


@router.get("/dashboard/overview")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_overview")
async def analytics_overview(
    request: Request, current_user: CurrentUser, session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    d = await _compute_dashboard(session, current_user.hotel_id, days)
    return {
        "total_visitors": d["total_visitors"],
        "conversion_rate": d["conversion_rate"],
        "funnel_data": d["funnel_data"],
        "device_stats": d["device_stats"],
    }


@router.get("/dashboard/revenue")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_revenue")
async def analytics_revenue(
    request: Request, current_user: CurrentUser, session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    d = await _compute_dashboard(session, current_user.hotel_id, days)
    return {
        "revenue_total": d["revenue_total"],
        "avg_daily_rate": d["avg_daily_rate"],
        "occupancy_forecast": d["occupancy_forecast"],
        "chart_data": d["chart_data"],
        "ai_revenue": d["ai_revenue"],
    }


@router.get("/dashboard/traffic")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_traffic")
async def analytics_traffic(
    request: Request, current_user: CurrentUser, session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    d = await _compute_dashboard(session, current_user.hotel_id, days)
    return {
        "geo_stats": d["geo_stats"],
        "traffic_heatmap": d["traffic_heatmap"],
        "device_stats": d["device_stats"],
    }


@router.get("/dashboard/ai")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_ai")
async def analytics_ai(
    request: Request, current_user: CurrentUser, session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    d = await _compute_dashboard(session, current_user.hotel_id, days)
    return {
        "ai_resolution_rate": d["ai_resolution_rate"],
        "total_leads": d["total_leads"],
        "ai_assisted_bookings": d["ai_assisted_bookings"],
        "ai_revenue": d["ai_revenue"],
    }


@router.get("/dashboard/cancellations")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_cancellations")
async def analytics_cancellations(
    request: Request, current_user: CurrentUser, session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    d = await _compute_dashboard(session, current_user.hotel_id, days)
    return {
        "cancellations_count": d["cancellations_count"],
        "lost_revenue": d["lost_revenue"],
    }


@router.get("/dashboard/kpis")
@limiter.limit("60/minute")
@cache_response(expire=120, key_prefix="analytics_kpis")
async def analytics_kpis(
    request: Request, current_user: CurrentUser, session: DbSession,
    days: int = Query(default=30, ge=1, le=365),
):
    d = await _compute_dashboard(session, current_user.hotel_id, days)
    return {
        "total_visitors": d["total_visitors"],
        "revenue_total": d["revenue_total"],
        "occupancy_rate": d["occupancy_rate"],
        "conversion_rate": d["conversion_rate"],
        "ai_assisted_bookings": d["ai_assisted_bookings"],
    }


# ───────────────────────────────── Live ─────────────────────────────────────


@router.get("/live/active")
@limiter.limit("120/minute")
async def live_active_visitors(
    request: Request, current_user: CurrentUser, session: DbSession,
):
    """Count of sessions started within the live window that haven't ended."""
    cutoff = datetime.utcnow() - _LIVE_WINDOW
    count = (await session.execute(
        select(func.count()).select_from(AnalyticsSession).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            AnalyticsSession.started_at >= cutoff,
            AnalyticsSession.ended_at.is_(None),
        )
    )).scalar() or 0
    return {"active_visitors": int(count)}


@router.get("/live/feed")
@limiter.limit("120/minute")
async def live_feed(
    request: Request, current_user: CurrentUser, session: DbSession,
    limit: int = Query(default=20, ge=1, le=100),
):
    """Most recent visitor sessions for this hotel (newest first)."""
    rows = (await session.execute(
        select(AnalyticsSession)
        .where(AnalyticsSession.hotel_id == current_user.hotel_id)
        .order_by(AnalyticsSession.started_at.desc())
        .limit(limit)
    )).scalars().all()
    return [
        {
            "session_id": s.id,
            "device_type": s.device_type,
            "browser": s.browser,
            "country": s.country,
            "referrer": s.referrer,
            "has_booked": s.has_booked,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "time_spent_seconds": s.time_spent_seconds,
        }
        for s in rows
    ]
