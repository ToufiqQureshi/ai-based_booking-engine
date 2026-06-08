"""
Analytics Tracking — public endpoints to record widget sessions and events.
These are called by the guest-facing booking widget (no auth required).
"""
import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Request
from sqlmodel import select
from user_agents import parse

from app.api.deps import DbSession
from app.models.analytics import (
    AnalyticsEvent,
    AnalyticsSession,
    EventTrackRequest,
    SessionPingRequest,
    SessionStartRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/track/start")
async def track_start(
    hotel_id: str,
    request: SessionStartRequest,
    req_fastapi: Request,
    session: DbSession,
):
    """Start a new analytics session. Resolves device type, browser, and geo-IP country."""
    from app.models.hotel import Hotel

    # Allow lookup by slug OR raw UUID
    hotel = (await session.execute(select(Hotel).where(Hotel.slug == hotel_id))).scalar_one_or_none()
    actual_hotel_id = hotel.id if hotel else hotel_id

    ua_string = request.user_agent or ""
    ua = parse(ua_string)
    device_type = "desktop"
    if ua.is_mobile:
        device_type = "mobile"
    elif ua.is_tablet:
        device_type = "tablet"
    elif ua.is_bot:
        device_type = "bot"

    # Respect proxy headers (Railway / Cloudflare forward the real IP)
    client_ip = req_fastapi.headers.get("X-Forwarded-For") or req_fastapi.client.host
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    country_name = "Unknown"
    try:
        if client_ip and client_ip not in ("127.0.0.1", "::1", "localhost"):
            async with httpx.AsyncClient(timeout=0.3) as http:
                res = await http.get(f"http://ip-api.com/json/{client_ip}")
                if res.status_code == 200:
                    geo = res.json()
                    if geo.get("status") == "success":
                        country_name = geo.get("country", "Unknown")
    except Exception as e:
        logger.warning("GeoIP lookup failed: %s", e)

    new_session = AnalyticsSession(
        hotel_id=actual_hotel_id,
        user_agent=ua_string,
        device_type=device_type,
        browser=f"{ua.browser.family} {ua.browser.version_string}",
        os=f"{ua.os.family} {ua.os.version_string}",
        referrer=request.referrer,
        country=country_name,
    )
    session.add(new_session)
    await session.commit()
    await session.refresh(new_session)

    if request.page_url:
        session.add(AnalyticsEvent(
            session_id=new_session.id,
            event_type="page_view",
            page_url=request.page_url,
        ))
        await session.commit()

    return {"session_id": new_session.id}


@router.post("/track/ping")
async def track_ping(request: SessionPingRequest, session: DbSession):
    """Heartbeat — updates time-on-site for a session."""
    result = await session.execute(
        select(AnalyticsSession).where(AnalyticsSession.id == request.session_id)
    )
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
    Buffer a widget event (room_view, add_to_cart, booking_complete, etc.).
    Uses Redis list as a write buffer to keep latency low; flushes to DB in the background.
    """
    event_data = {
        "session_id": request.session_id,
        "event_type": request.event_type,
        "page_url": request.page_url,
        "room_type_id": request.room_type_id,
        "time_spent_seconds": request.time_spent_seconds or 0,
        "metadata_json": request.metadata_json,
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        from app.core.redis_client import redis_client
        r = redis_client.get_instance()
        if r:
            r.rpush("analytics_event_buffer", json.dumps(event_data))
            # Trigger a flush when the buffer is large enough to batch-write
            if r.llen("analytics_event_buffer") >= 50:
                background_tasks.add_task(flush_analytics_buffer)
        else:
            # Redis unavailable — write directly to DB
            from app.core.database import async_session
            async with async_session() as db:
                event = AnalyticsEvent(**event_data)
                db.add(event)
                if request.event_type == "booking_complete":
                    res = await db.execute(
                        select(AnalyticsSession).where(AnalyticsSession.id == request.session_id)
                    )
                    db_s = res.scalar_one_or_none()
                    if db_s:
                        db_s.has_booked = True
                        db.add(db_s)
                await db.commit()
    except Exception as e:
        logger.error("Failed to buffer analytics event: %s", e)

    return {"status": "ok"}


async def flush_analytics_buffer():
    """
    Background task: drains the Redis event buffer into Supabase.
    Capped at 500 events per flush to keep transactions bounded.
    """
    from app.core.database import async_session
    from app.core.redis_client import redis_client

    r = redis_client.get_instance()
    if not r:
        return

    events_json = []
    for _ in range(500):
        val = r.lpop("analytics_event_buffer")
        if not val:
            break
        events_json.append(val)

    if not events_json:
        return

    async with async_session() as db:
        try:
            for item_json in events_json:
                data = json.loads(item_json)
                if "created_at" in data:
                    data["created_at"] = datetime.fromisoformat(data["created_at"])
                event = AnalyticsEvent(**data)
                db.add(event)
                if data.get("event_type") == "booking_complete":
                    res = await db.execute(
                        select(AnalyticsSession).where(AnalyticsSession.id == data["session_id"])
                    )
                    db_s = res.scalar_one_or_none()
                    if db_s:
                        db_s.has_booked = True
                        db.add(db_s)
            await db.commit()
            logger.info("Flushed %d analytics events to DB", len(events_json))
        except Exception as e:
            logger.error("Analytics buffer flush failed: %s", e)
