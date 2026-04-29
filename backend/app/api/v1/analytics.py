"""
Analytics API Routes
Receives tracking events from the widget and provides aggregated data to the dashboard.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlmodel import select, func, case, or_
from datetime import datetime, timedelta, timezone

from app.api.deps import DbSession, CurrentUser
from app.models.analytics import AnalyticsSession, AnalyticsEvent, SessionStartRequest, SessionPingRequest, EventTrackRequest
from app.models.booking import Booking, BookingStatus
from app.models.room import RoomType


router = APIRouter(tags=["Analytics"])

@router.post("/session")
async def start_session(request: SessionStartRequest, session: DbSession):
    """
    Start a new analytics session when a user visits the widget.
    Needs the hotel_id (extracted from the public widget endpoint context).
    For security, the widget uses the public API which we might route through here,
    but we'll assume the widget passes hotel_id for now.
    Wait, to keep it secure, we should probably have an endpoint that expects `hotel_id`.
    """
    # Since this is a public tracking endpoint, we need hotel_id in the body or path.
    pass # Will refactor to include hotel_id

import httpx
from fastapi import Request

from user_agents import parse

@router.post("/track/start")
async def track_start(hotel_id: str, request: SessionStartRequest, req_fastapi: Request, session: DbSession):
    """Analytics session start point with GeoIP location resolution"""
    from app.models.hotel import Hotel
    
    # Try finding by slug first
    h_query = select(Hotel).where(Hotel.slug == hotel_id)
    hotel = (await session.execute(h_query)).scalar_one_or_none()
    
    actual_hotel_id = hotel.id if hotel else hotel_id
    
    # Parse User Agent
    ua_string = request.user_agent or ""
    ua = parse(ua_string)
    
    device_type = "desktop"
    if ua.is_mobile: device_type = "mobile"
    elif ua.is_tablet: device_type = "tablet"
    elif ua.is_bot: device_type = "bot"

    # Resolve Client IP & Country
    client_ip = req_fastapi.headers.get("X-Forwarded-For") or req_fastapi.client.host
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
        
    country_name = "Unknown"
    
    try:
        if client_ip and client_ip not in ("127.0.0.1", "::1", "localhost"):
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"http://ip-api.com/json/{client_ip}")
                if res.status_code == 200:
                    geo_data = res.json()
                    if geo_data.get("status") == "success":
                        country_name = geo_data.get("country", "Unknown")
    except Exception as e:
        print(f"GeoIP Lookup Failed: {e}")

    new_session = AnalyticsSession(
        hotel_id=actual_hotel_id,
        user_agent=ua_string,
        device_type=device_type,
        browser=f"{ua.browser.family} {ua.browser.version_string}",
        os=f"{ua.os.family} {ua.os.version_string}",
        referrer=request.referrer,
        country=country_name
    )
    session.add(new_session)
    await session.commit()
    await session.refresh(new_session)
    
    if request.page_url:
        event = AnalyticsEvent(
            session_id=new_session.id,
            event_type="page_view",
            page_url=request.page_url
        )
        session.add(event)
        await session.commit()
        
    return {"session_id": new_session.id}

@router.post("/track/ping")
async def track_ping(request: SessionPingRequest, session: DbSession):
    """Update time spent for a session"""
    result = await session.execute(select(AnalyticsSession).where(AnalyticsSession.id == request.session_id))
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        return {"status": "ignored"}
        
    db_session.time_spent_seconds += request.time_spent_seconds
    db_session.ended_at = datetime.utcnow()
    
    session.add(db_session)
    await session.commit()
    return {"status": "ok"}

@router.post("/track/event")
async def track_event(request: EventTrackRequest, session: DbSession):
    """Log a specific event (e.g. room_view, add_to_cart)"""
    event = AnalyticsEvent(
        session_id=request.session_id,
        event_type=request.event_type,
        page_url=request.page_url,
        room_type_id=request.room_type_id,
        time_spent_seconds=request.time_spent_seconds or 0,
        metadata_json=request.metadata_json
    )
    session.add(event)
    
    # If it's a booking event, update the session
    if request.event_type == "booking_complete":
        result = await session.execute(select(AnalyticsSession).where(AnalyticsSession.id == request.session_id))
        db_session = result.scalar_one_or_none()
        if db_session:
            db_session.has_booked = True
            session.add(db_session)

    await session.commit()
    return {"status": "ok"}


# --- Dashboard API for Hoteliers ---

@router.get("/dashboard")
async def get_analytics_dashboard(current_user: CurrentUser, session: DbSession, days: int = 7):
    """Fetch aggregated analytics for the hotelier dashboard"""
    try:
        hotel_id = current_user.hotel_id
        if not hotel_id:
            return {"error": "No hotel linked"}

        start_date_naive = datetime.utcnow() - timedelta(days=days)
        
        # Calculate revenue, ADR, RevPAR, Occupancy
        bookings_q = select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.created_at >= start_date_naive,
            Booking.status != BookingStatus.CANCELLED
        )
        res_bookings = await session.execute(bookings_q)
        bookings = res_bookings.scalars().all()

        revenue_total = sum(b.total_amount for b in bookings)
        total_rooms_booked = sum(len(b.rooms) for b in bookings)

        room_types_q = select(RoomType).where(
            RoomType.hotel_id == hotel_id,
            RoomType.is_active == True
        )
        res_room_types = await session.execute(room_types_q)
        room_types = res_room_types.scalars().all()
        total_inventory = sum(r.total_inventory for r in room_types)

        avg_daily_rate = round(revenue_total / total_rooms_booked, 2) if total_rooms_booked > 0 else 0
        total_rooms_available = total_inventory * days
        occupancy_rate = round((total_rooms_booked / total_rooms_available * 100), 2) if total_rooms_available > 0 else 0
        rev_par = round(revenue_total / total_rooms_available, 2) if total_rooms_available > 0 else 0

        
        # 1. Main Stats
        stats_q = select(
            func.count(AnalyticsSession.id).label("visitors"),
            func.avg(AnalyticsSession.time_spent_seconds).label("avg_time"),
            func.sum(case((AnalyticsSession.has_booked == True, 1), else_=0)).label("conversions")
        ).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_date_naive
        )
        res_stats = await session.execute(stats_q)
        row = res_stats.first()
        
        total_visitors = row.visitors or 0
        avg_time = int(row.avg_time or 0)
        total_conversions = row.conversions or 0
        conversion_rate = round((total_conversions / total_visitors * 100), 2) if total_visitors > 0 else 0
        
        # 2. Device Breakdown
        device_q = select(AnalyticsSession.device_type, func.count(AnalyticsSession.id)).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_date_naive
        ).group_by(AnalyticsSession.device_type)
        res_device = await session.execute(device_q)
        device_stats = [{"type": row[0], "count": row[1]} for row in res_device.all()]
        
        # 3. Top Viewed Rooms
        # Join with RoomType to get names if possible, for now just IDs
        rooms_q = select(AnalyticsEvent.room_type_id, func.count(AnalyticsEvent.id)).where(
            AnalyticsEvent.event_type == "room_view",
            AnalyticsEvent.room_type_id != None
        ).join(AnalyticsSession).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_date_naive
        ).group_by(AnalyticsEvent.room_type_id).order_by(func.count(AnalyticsEvent.id).desc()).limit(5)
        res_rooms = await session.execute(rooms_q)
        top_rooms = [{"id": row[0], "views": row[1]} for row in res_rooms.all()]
        
        # 4. Traffic Chart
        sessions_q = select(AnalyticsSession.started_at).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_date_naive
        )
        res_sessions = await session.execute(sessions_q)
        traffic_by_day = { (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d"): 0 for i in range(days) }
        for row in res_sessions.all():
            d = row[0].strftime("%Y-%m-%d")
            if d in traffic_by_day: traffic_by_day[d] += 1
        chart_data = [{"date": k, "visitors": v} for k, v in reversed(traffic_by_day.items())]

        # 5. Funnel Data
        # We'll count unique sessions that reached each stage
        funnel_stages = ["page_view", "search", "room_view", "booking_complete"]
        funnel_data = []
        for stage in funnel_stages:
            q = select(func.count(func.distinct(AnalyticsSession.id))).join(AnalyticsEvent).where(
                AnalyticsSession.hotel_id == hotel_id,
                AnalyticsSession.started_at >= start_date_naive,
                AnalyticsEvent.event_type == stage
            )
            res = await session.execute(q)
            funnel_data.append({"stage": stage, "count": res.scalar() or 0})

        # 6. Geo Stats
        geo_q = select(AnalyticsSession.country, func.count(AnalyticsSession.id)).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_date_naive
        ).group_by(AnalyticsSession.country).order_by(func.count(AnalyticsSession.id).desc())
        res_geo = await session.execute(geo_q)
        
        geo_stats = []
        code_map = {
            "India": "IN", "United States": "US", "United Kingdom": "GB", 
            "United Arab Emirates": "AE", "Germany": "DE", "Australia": "AU",
            "Canada": "CA", "France": "FR", "Japan": "JP", "China": "CN"
        }
        
        for row in res_geo.all():
            country = row[0] or "Unknown"
            count = row[1]
            pct = int(round((count / total_visitors * 100), 0)) if total_visitors > 0 else 0
            geo_stats.append({
                "country": country,
                "code": code_map.get(country, "XX"),
                "visitors": count,
                "percentage": pct,
                "trend": "+0%"
            })

        return {
            "total_visitors": total_visitors,
            "avg_time_spent_seconds": avg_time,
            "total_conversions": total_conversions,
            "conversion_rate": conversion_rate,
            "device_stats": device_stats,
            "top_rooms": top_rooms,
            "chart_data": chart_data,
            "funnel_data": funnel_data,
            "geo_stats": geo_stats,
            "revenue_total": revenue_total,
            "avg_daily_rate": avg_daily_rate,
            "rev_par": rev_par,
            "occupancy_rate": occupancy_rate
        }

    except Exception as e:
        import logging
        logging.error(f"Analytics Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/live/active")
async def get_active_sessions(current_user: CurrentUser, session: DbSession):
    """
    Returns the number of people currently on the website (active in last 5 mins).
    """
    five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
    query = select(func.count(AnalyticsSession.id)).where(
        AnalyticsSession.hotel_id == current_user.hotel_id,
        or_(
            AnalyticsSession.ended_at >= five_mins_ago,
            AnalyticsSession.started_at >= five_mins_ago
        )
    )
    result = await session.execute(query)
    count = result.scalar() or 0
    return {"active_visitors": count}


@router.get("/live/feed")
async def get_live_feed(current_user: CurrentUser, session: DbSession, limit: int = 10):
    """
    Get the latest analytics events in real-time.
    """
    query = select(AnalyticsEvent).join(AnalyticsSession).where(
        AnalyticsSession.hotel_id == current_user.hotel_id
    ).order_by(AnalyticsEvent.created_at.desc()).limit(limit)
    
    result = await session.execute(query)
    events = result.scalars().all()
    
    return [
        {
            "event": e.event_type,
            "page": e.page_url,
            "time": e.created_at.isoformat(),
            "metadata": e.metadata_json
        } for e in events
    ]
