"""
Public analytics tracking endpoints — called by the booking widget, no auth required.
"""
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select

from app.core.auth.deps import DbSession
from app.analytics.models import (
    AnalyticsSession, AnalyticsEvent,
    SessionStartRequest, SessionPingRequest, EventTrackRequest,
)
from app.brand_console.hotel import Hotel

router = APIRouter(prefix="/track", tags=["Analytics Tracking"])


@router.post("/start")
async def start_session(
    hotel_id: str = Query(...),
    data: SessionStartRequest = None,
    session: DbSession = None,
):
    """Create a new analytics session. Public — no auth."""
    if data is None:
        data = SessionStartRequest()
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    sess = AnalyticsSession(
        hotel_id=hotel_id,
        user_agent=data.user_agent,
        referrer=data.referrer,
    )
    session.add(sess)
    await session.commit()
    await session.refresh(sess)
    return {"session_id": sess.id}


@router.post("/ping")
async def ping_session(data: SessionPingRequest, session: DbSession):
    """Update time-spent for an existing session. Silently ignores unknown sessions."""
    result = await session.execute(
        select(AnalyticsSession).where(AnalyticsSession.id == data.session_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        return {"status": "ignored"}
    sess.time_spent_seconds = (sess.time_spent_seconds or 0) + data.time_spent_seconds
    sess.ended_at = datetime.utcnow()
    await session.commit()
    return {"status": "ok"}


@router.post("/event")
async def track_event(data: EventTrackRequest, session: DbSession):
    """Record an analytics event for a session."""
    result = await session.execute(
        select(AnalyticsSession).where(AnalyticsSession.id == data.session_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    if data.event_type == "booking_complete":
        sess.has_booked = True
        await session.commit()

    evt = AnalyticsEvent(
        session_id=data.session_id,
        event_type=data.event_type,
        page_url=data.page_url,
        room_type_id=data.room_type_id,
        time_spent_seconds=data.time_spent_seconds or 0,
        metadata_json=data.metadata_json,
    )
    session.add(evt)
    await session.commit()
    return {"status": "ok"}
