"""
Analytics Live — real-time session and event feed endpoints.
No caching: these are always fresh by design.
"""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter
from sqlmodel import select, func
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.analytics import AnalyticsEvent, AnalyticsSession

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/live/active")
async def get_active_sessions(current_user: CurrentUser, session: DbSession):
    """Count guests currently on the booking widget (active in the last 5 minutes)."""
    five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
    from sqlmodel import or_
    count = (await session.execute(
        select(func.count(AnalyticsSession.id)).where(
            AnalyticsSession.hotel_id == current_user.hotel_id,
            or_(
                AnalyticsSession.ended_at >= five_mins_ago,
                AnalyticsSession.started_at >= five_mins_ago,
            ),
        )
    )).scalar() or 0
    return {"active_visitors": count}


@router.get("/live/feed")
async def get_live_feed(current_user: CurrentUser, session: DbSession, limit: int = 10):
    """Latest analytics events for the hotel — useful for a live activity ticker."""
    events = (await session.execute(
        select(AnalyticsEvent)
        .join(AnalyticsSession)
        .where(AnalyticsSession.hotel_id == current_user.hotel_id)
        .order_by(AnalyticsEvent.created_at.desc())
        .limit(limit)
    )).scalars().all()

    return [
        {
            "event": e.event_type,
            "page": e.page_url,
            "time": e.created_at.isoformat(),
            "metadata": e.metadata_json,
        }
        for e in events
    ]
