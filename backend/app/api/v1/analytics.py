"""
Analytics API Routes
Receives tracking events from the widget and provides aggregated data to the dashboard.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlmodel import select, func, case, or_
import json
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import joinedload, selectinload

from app.api.deps import DbSession, CurrentUser
from app.models.analytics import AnalyticsSession, AnalyticsEvent, SessionStartRequest, SessionPingRequest, EventTrackRequest
from app.models.booking import Booking, BookingStatus, BookingSource
from app.core.cache import cache_response
from app.models.room import RoomType

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analytics"])

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
            async with httpx.AsyncClient(timeout=0.3) as client:
                res = await client.get(f"http://ip-api.com/json/{client_ip}")
                if res.status_code == 200:
                    geo_data = res.json()
                    if geo_data.get("status") == "success":
                        country_name = geo_data.get("country", "Unknown")
    except Exception as e:
        logger.warning(f"GeoIP Lookup Failed: {e}")

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
async def track_event(request: EventTrackRequest, background_tasks: BackgroundTasks):
    """
    Log a specific event (e.g. room_view, add_to_cart).
    Optimized: Uses Redis list as a buffer for high-frequency events.
    """
    event_data = {
        "session_id": request.session_id,
        "event_type": request.event_type,
        "page_url": request.page_url,
        "room_type_id": request.room_type_id,
        "time_spent_seconds": request.time_spent_seconds or 0,
        "metadata_json": request.metadata_json,
        "created_at": datetime.utcnow().isoformat()
    }
    
    try:
        # Push to Redis buffer
        from app.core.redis_client import redis_client
        r = redis_client.get_instance()
        if r:
            r.rpush("analytics_event_buffer", json.dumps(event_data))

            # If buffer is getting large, trigger a flush in background
            buffer_size = r.llen("analytics_event_buffer")
            if buffer_size >= 50:
                background_tasks.add_task(flush_analytics_buffer)
        else:
            # Fallback to direct DB if Redis is down
            from app.core.database import async_session
            async with async_session() as session:
                event = AnalyticsEvent(**event_data)
                session.add(event)
                if request.event_type == "booking_complete":
                    res = await session.execute(select(AnalyticsSession).where(AnalyticsSession.id == request.session_id))
                    db_s = res.scalar_one_or_none()
                    if db_s:
                        db_s.has_booked = True
                        session.add(db_s)
                await session.commit()
    except Exception as e:
        import logging
        logging.error(f"Failed to buffer analytics event: {e}")

    return {"status": "ok"}

async def flush_analytics_buffer():
    """
    Background task to flush buffered analytics events from Redis to Supabase.
    """
    from app.core.redis_client import redis_client
    from app.core.database import async_session
    import logging

    r = redis_client.get_instance()
    if not r:
        return

    # Atomic pop of all current events
    events_json = []
    # Limit to 500 at a time to prevent huge transactions
    for _ in range(500):
        val = r.lpop("analytics_event_buffer")
        if not val:
            break
        events_json.append(val)

    if not events_json:
        return

    async with async_session() as session:
        try:
            for item_json in events_json:
                data = json.loads(item_json)
                # Convert ISO string back to datetime
                if "created_at" in data:
                    data["created_at"] = datetime.fromisoformat(data["created_at"])

                event = AnalyticsEvent(**data)
                session.add(event)

                if data.get("event_type") == "booking_complete":
                    res = await session.execute(select(AnalyticsSession).where(AnalyticsSession.id == data["session_id"]))
                    db_s = res.scalar_one_or_none()
                    if db_s:
                        db_s.has_booked = True
                        session.add(db_s)

            await session.commit()
            logging.info(f"Successfully flushed {len(events_json)} analytics events to DB")
        except Exception as e:
            logging.error(f"Failed to flush analytics buffer: {e}")
            # Optional: push back to redis or a DLQ


# --- Dashboard API for Hoteliers ---

@router.get("/dashboard")
@cache_response(expire=600, key_prefix="analytics_dashboard")
async def get_analytics_dashboard(current_user: CurrentUser, session: DbSession, days: int = 7):
    """Fetch aggregated analytics for the hotelier dashboard"""
    try:
        hotel_id = current_user.hotel_id
        if not hotel_id:
            return {"error": "No hotel linked"}

        # 1. Date range setup
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        start_date_naive = start_date.replace(tzinfo=None)

        # 2. Fetch Base Data (Sessions, Bookings, RoomTypes)
        session_q = select(AnalyticsSession).where(
            AnalyticsSession.hotel_id == hotel_id,
            AnalyticsSession.started_at >= start_date_naive
        ).options(selectinload(AnalyticsSession.events))
        sessions = (await session.execute(session_q)).scalars().unique().all()
        
        booking_q = select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.created_at >= start_date_naive
        )
        bookings = (await session.execute(booking_q)).scalars().all()
        
        room_types_q = select(RoomType).where(RoomType.hotel_id == hotel_id)
        room_types = (await session.execute(room_types_q)).scalars().all()
        total_inventory = sum(r.total_inventory for r in room_types) or 1
        
        # 3. Basic Aggregations
        total_visitors = len(sessions)
        total_conversions = len([b for b in bookings if b.status != BookingStatus.CANCELLED])
        conversion_rate = round((total_conversions / total_visitors * 100), 2) if total_visitors > 0 else 0
        avg_time = int(sum(s.time_spent_seconds or 0 for s in sessions) / total_visitors) if total_visitors > 0 else 0

        # Cancellation Metrics
        cancellations_count = len([b for b in bookings if b.status == BookingStatus.CANCELLED])
        cancellation_rate = round((cancellations_count / len(bookings) * 100), 2) if len(bookings) > 0 else 0
        lost_revenue = sum(float(b.total_amount or 0) for b in bookings if b.status == BookingStatus.CANCELLED)
        cancellation_fees_collected = sum(float(b.cancellation_fee or 0) for b in bookings if b.status == BookingStatus.CANCELLED)
        
        # 4. Device Stats
        device_counts = {}
        for s in sessions:
            dt = s.device_type or "unknown"
            device_counts[dt] = device_counts.get(dt, 0) + 1
        device_stats = [{"type": k, "count": v} for k, v in device_counts.items()]

        # 5. Chart Data (Grouped by date)
        chart_map = { (datetime.utcnow() - timedelta(days=i)).strftime("%d %b"): {"visitors": 0, "revenue": 0, "cancellations": 0} for i in range(days) }
        for s in sessions:
            ds = s.started_at.strftime("%d %b")
            if ds in chart_map: chart_map[ds]["visitors"] += 1
        for b in bookings:
            ds = b.created_at.strftime("%d %b")
            if b.status != BookingStatus.CANCELLED:
                if ds in chart_map: chart_map[ds]["revenue"] += float(b.total_amount or 0)
            else:
                if ds in chart_map: chart_map[ds]["cancellations"] += 1

        chart_data = [{"date": k, **v} for k, v in reversed(chart_map.items())]

        # 6. Funnel Data
        funnel_stages = ["page_view", "search", "room_view", "booking_complete"]
        funnel_counts = {s: 0 for s in funnel_stages}
        for s in sessions:
            event_types = {e.event_type for e in s.events}
            for stage in funnel_stages:
                if stage in event_types:
                    funnel_counts[stage] += 1
        funnel_data = [{"stage": k, "count": v} for k, v in funnel_counts.items()]

        # 7. Heatmap (Audited Timezone Logic)
        from zoneinfo import ZoneInfo
        from app.models.hotel import Hotel
        hotel_obj = await session.get(Hotel, hotel_id)
        tz_name = hotel_obj.settings.get("timezone", "Asia/Kolkata") if hotel_obj else "Asia/Kolkata"
        target_tz = ZoneInfo(tz_name)
        
        heatmap_counts = {}
        for s in sessions:
            # sessions are UTC in DB. Convert to Hotel Local Time.
            dt_utc = s.started_at.replace(tzinfo=timezone.utc)
            dt_local = dt_utc.astimezone(target_tz)
            
            # Python weekday: 0=Mon, 6=Sun. Matches frontend ["Mon",...,"Sun"]
            wd = dt_local.weekday()
            hr = dt_local.hour
            k = f"{wd}-{hr}"
            heatmap_counts[k] = heatmap_counts.get(k, 0) + 1
        
        heatmap_list = []
        for wd in range(7):
            for hr in range(24):
                k = f"{wd}-{hr}"
                heatmap_list.append({"weekday": wd, "hour": hr, "visitors": heatmap_counts.get(k, 0)})

        # 8. Financial Metrics
        active_bookings = [b for b in bookings if b.status != BookingStatus.CANCELLED]
        revenue_total = sum(float(b.total_amount or 0) for b in active_bookings)

        # Room-nights = rooms × nights stayed (NOT just room count). This is what
        # occupancy, ADR and RevPAR are defined against in hotel revenue management.
        def _nights(b):
            try:
                return max(1, (b.check_out - b.check_in).days)
            except Exception:
                return 1
        total_room_nights = sum(len(b.rooms or []) * _nights(b) for b in active_bookings)
        total_rooms_available = total_inventory * days  # available room-nights over the period

        avg_daily_rate = round(revenue_total / total_room_nights, 2) if total_room_nights > 0 else 0
        rev_par = round(revenue_total / total_rooms_available, 2) if total_rooms_available > 0 else 0
        occupancy_rate = round(min(100.0, (total_room_nights / total_rooms_available * 100)), 2) if total_rooms_available > 0 else 0

        # 9. AI Efficiency (Deep Integration with Lead table)
        from app.models.lead import Lead
        leads_q = select(Lead).where(Lead.hotel_id == hotel_id, Lead.created_at >= start_date_naive)
        res_leads = await session.execute(leads_q)
        leads = res_leads.scalars().all()
        
        total_leads_count = len(leads)
        # Engagement: Sessions that had AI inquiry OR became a Lead
        ai_engaged_sessions = [s for s in sessions if any(e.event_type == "ai_inquiry" for e in s.events)]
        ai_engagement_count = len(ai_engaged_sessions)
        
        # AI Bookings: Source is ai_agent
        ai_bookings_count = len([b for b in bookings if b.source == BookingSource.AI_AGENT])
        
        # Resolution Rate: Conversions / Engagements
        res_rate = round((ai_bookings_count / ai_engagement_count * 100), 2) if ai_engagement_count > 0 else 0
        
        # Popular Inquiries — count which rooms guests enquired about most
        room_interest: dict = {}
        for l in leads:
            if l.room_type_preference:
                key = l.room_type_preference.strip()
                room_interest[key] = room_interest.get(key, 0) + 1

        popular_questions = [
            {"text": k, "value": v}
            for k, v in sorted(room_interest.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # 10. Geo Stats
        COUNTRY_CODES = {
            "India": "IN", "United States": "US", "United Kingdom": "GB",
            "Germany": "DE", "France": "FR", "Australia": "AU", "Canada": "CA",
            "Singapore": "SG", "UAE": "AE", "United Arab Emirates": "AE",
            "Japan": "JP", "China": "CN", "Russia": "RU", "Brazil": "BR",
            "Italy": "IT", "Spain": "ES", "Netherlands": "NL", "Thailand": "TH",
            "Malaysia": "MY", "Indonesia": "ID", "Philippines": "PH",
            "Bangladesh": "BD", "Pakistan": "PK", "Nepal": "NP", "Sri Lanka": "LK",
            "South Africa": "ZA", "Kenya": "KE", "Nigeria": "NG",
            "Mexico": "MX", "Argentina": "AR", "Colombia": "CO",
        }
        geo_counts = {}
        for s in sessions:
            country = s.country or "Unknown"
            geo_counts[country] = geo_counts.get(country, 0) + 1
        
        geo_stats = []
        for country, count in geo_counts.items():
            pct = round((count / total_visitors * 100), 1) if total_visitors > 0 else 0
            geo_stats.append({
                "country": country,
                "code": COUNTRY_CODES.get(country, country[:2].upper()),
                "visitors": count,
                "percentage": pct
            })
        geo_stats.sort(key=lambda x: x["visitors"], reverse=True)

        # 11. Room Popularity
        room_stats = {r.id: {"id": r.id, "name": r.name, "views": 0, "bookings": 0, "revenue": 0} for r in room_types}
        for s in sessions:
            for e in s.events:
                if e.event_type == "room_view" and e.room_type_id in room_stats:
                    room_stats[e.room_type_id]["views"] += 1
        
        for b in bookings:
            if b.status != BookingStatus.CANCELLED:
                for rm in b.rooms:
                    rt_id = rm.get("room_type_id")
                    if rt_id in room_stats:
                        room_stats[rt_id]["bookings"] += 1
                        room_stats[rt_id]["revenue"] += rm.get("total_price", 0)

        most_booked = sorted(room_stats.values(), key=lambda x: x["bookings"], reverse=True)
        least_booked = sorted(room_stats.values(), key=lambda x: x["bookings"])
        revenue_mix = [{"name": r["name"], "value": r["revenue"]} for r in most_booked if r["revenue"] > 0]

        # 12. Funnel Drop-offs
        funnel_dropoffs = []
        for i in range(len(funnel_data) - 1):
            curr_val = funnel_data[i]["count"]
            next_val = funnel_data[i+1]["count"]
            drop_pct = round(((curr_val - next_val) / curr_val * 100), 1) if curr_val > 0 else 0
            funnel_dropoffs.append({"stage": funnel_data[i]["stage"], "drop_percentage": drop_pct})

        # 13. Promo Stats
        promo_counts = {}
        for b in bookings:
            if b.promo_code:
                promo_counts[b.promo_code] = promo_counts.get(b.promo_code, 0) + 1
        promo_stats = [{"code": k, "bookings": v} for k, v in promo_counts.items()]

        # 14. Booking Window Distribution
        window_buckets = {"0-3 days": 0, "4-7 days": 0, "8-14 days": 0, "15-30 days": 0, "30+ days": 0}
        for b in bookings:
            # Clamp to 0 — bookings can occasionally be created after check-in (back-dated/walk-in)
            days_diff = max(0, (b.check_in - b.created_at.date()).days)
            if days_diff <= 3: window_buckets["0-3 days"] += 1
            elif days_diff <= 7: window_buckets["4-7 days"] += 1
            elif days_diff <= 14: window_buckets["8-14 days"] += 1
            elif days_diff <= 30: window_buckets["15-30 days"] += 1
            else: window_buckets["30+ days"] += 1
        booking_window_data = [{"window": k, "count": v} for k, v in window_buckets.items()]

        # 15. Occupancy Forecast
        future_q = select(Booking).where(Booking.hotel_id == hotel_id, Booking.check_out >= datetime.utcnow().date(), Booking.status != BookingStatus.CANCELLED)
        future_bookings = (await session.execute(future_q)).scalars().all()
        forecast = []
        for i in range(7):
            d = (datetime.utcnow() + timedelta(days=i)).date()
            occupied = sum(len(b.rooms) for b in future_bookings if b.check_in <= d < b.check_out)
            # Clamp at 100% — overbooking shouldn't render as an impossible >100% bar
            occ_pct = round(min(100.0, (occupied / total_inventory * 100)), 1) if total_inventory > 0 else 0
            forecast.append({"date": d.strftime("%m/%d"), "occupancy": occ_pct})

        # 16. Pickup Stats
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        pickup_today = len([b for b in bookings if b.created_at.date() == today])
        pickup_yesterday = len([b for b in bookings if b.created_at.date() == yesterday])

        # Compute ai_revenue (estimated revenue from AI-assisted bookings)
        ai_revenue = round(sum(
            float(b.total_amount or 0) for b in bookings
            if b.status != BookingStatus.CANCELLED and b.source == BookingSource.AI_AGENT
        ), 2)

        return {
            "total_visitors": total_visitors,
            "avg_time_spent_seconds": avg_time,
            "total_conversions": total_conversions,
            "conversion_rate": conversion_rate,
            "cancellations_count": cancellations_count,
            "cancellation_rate": cancellation_rate,
            "lost_revenue": lost_revenue,
            "cancellation_fees_collected": cancellation_fees_collected,
            "chart_data": chart_data,
            "funnel_data": funnel_data,
            "revenue_total": revenue_total,
            "avg_daily_rate": avg_daily_rate,
            "rev_par": rev_par,
            "occupancy_rate": occupancy_rate,
            "traffic_heatmap": heatmap_list,
            "ai_resolution_rate": res_rate,
            "ai_revenue": ai_revenue,
            "popular_questions": popular_questions,
            "total_leads": total_leads_count,
            "ai_assisted_bookings": ai_bookings_count,
            "device_stats": device_stats,
            "geo_stats": geo_stats,
            "most_booked_rooms": most_booked[:5],
            "least_booked_rooms": least_booked[:5],
            "revenue_by_room_type": revenue_mix,
            "funnel_dropoffs": funnel_dropoffs,
            "promo_stats": promo_stats,
            "booking_window_data": booking_window_data,
            "occupancy_forecast": forecast,
            "pickup_stats": {
                "today": pickup_today,
                "yesterday": pickup_yesterday,
                "trend": "up" if pickup_today >= pickup_yesterday else "down"
            },
            "commission_saved": round(revenue_total * 0.15, 2)
        }



    except Exception as e:
        import logging
        logging.error(f"Analytics Error: {str(e)}")
        import traceback
        traceback.print_exc()
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
