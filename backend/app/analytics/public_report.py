"""
Public, no-login analytics report — the read side of a ReportShareLink.

A hotelier mints a token (see /analytics/share) and sends the link to anyone.
This endpoint resolves the token to exactly ONE hotel and returns aggregate
report data only. It never accepts a client-supplied hotel_id and never returns
guest PII (names / emails / phones) — only the same aggregate KPIs the hotelier
dashboard shows. That keeps multi-tenant isolation intact even without auth.
"""
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select

from app.core.auth.deps import DbSession
from app.core.utils.limiter import limiter
from app.brand_console.hotel import Hotel
from app.analytics.models import ReportShareLink
from app.analytics.analytics import _compute_dashboard

router = APIRouter(prefix="/public", tags=["Public Report"])


@router.get("/report/{token}")
@limiter.limit("60/minute")
async def public_report(request: Request, token: str, session: DbSession):
    """Resolve a share token to its hotel's aggregate report. Public — no auth."""
    link = (await session.execute(
        select(ReportShareLink).where(ReportShareLink.token == token)
    )).scalar_one_or_none()

    # Same 404 for missing/revoked so a probe can't distinguish the two.
    if not link or link.is_revoked:
        raise HTTPException(status_code=404, detail="Report link not found")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This report link has expired")

    hotel = await session.get(Hotel, link.hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Report link not found")

    # Data is scoped to the token's hotel — never to anything the caller supplies.
    data = await _compute_dashboard(session, link.hotel_id, link.days)

    # Best-effort view accounting; never let it fail the read.
    link.view_count = (link.view_count or 0) + 1
    link.last_viewed_at = datetime.utcnow()
    session.add(link)
    await session.commit()

    return {
        "hotel_name": hotel.name,
        "days": link.days,
        "generated_at": datetime.utcnow().isoformat(),
        "data": data,  # aggregate only — no guest PII
    }
