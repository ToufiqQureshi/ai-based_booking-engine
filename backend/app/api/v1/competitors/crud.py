"""
Competitor CRUD endpoints: list, add, delete, toggle-schedule.
Also defines the shared check_rate_shopper_feature guard used across sub-modules.
"""
import re
import logging
from typing import List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.core.redis_client import redis_client
from app.models.competitor import Competitor, CompetitorSource

from .scraper import _is_stale_running

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])


def check_rate_shopper_feature(current_user: CurrentUser) -> None:
    """Raise 403 if the hotel's subscription doesn't include Rate Shopper."""
    if not current_user.hotel or not getattr(current_user.hotel, "feature_rate_shopper", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rate Shopper feature is not enabled for your subscription plan",
        )


class CompetitorCreate(BaseModel):
    """
    Narrow request schema — prevents mass-assignment of server-managed fields
    (id, hotel_id, is_active, last_scrape_status, etc.).
    """
    name: str
    url: str
    source: CompetitorSource = CompetitorSource.MAKEMYTRIP

    @field_validator("name")
    @classmethod
    def _name_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("url")
    @classmethod
    def _url_must_be_http(cls, v: str) -> str:
        v = (v or "").strip()
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("URL must start with http:// or https://")
        return v


@router.get("", response_model=List[Competitor])
async def list_competitors(current_user: CurrentUser, session: DbSession):
    """List all competitors for the current hotel."""
    check_rate_shopper_feature(current_user)
    query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    competitors = result.scalars().all()

    # Self-heal: competitors stuck on "running" after a server restart show as
    # retryable failures the moment the hotelier loads the page — otherwise the
    # Refresh button stays disabled and the UI polls forever.
    healed = False
    for comp in competitors:
        if _is_stale_running(comp):
            comp.last_scrape_status = "failed"
            comp.last_scrape_error = "Scrape timed out (server may have restarted mid-run). Please try refreshing again."
            session.add(comp)
            healed = True
    if healed:
        await session.commit()

    return competitors


@router.post("", response_model=Competitor)
async def add_competitor(comp_data: CompetitorCreate, current_user: CurrentUser, session: DbSession):
    """Add a new competitor to track."""
    check_rate_shopper_feature(current_user)

    # Enforce per-hotel limit (configurable by super-admin, default 5)
    count_res = await session.execute(
        select(func.count()).select_from(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    )
    current_count = count_res.scalar() or 0
    max_comps = getattr(current_user.hotel, "max_competitors", None) or 5
    if current_count >= max_comps:
        raise HTTPException(status_code=409, detail=f"COMPETITOR_LIMIT_REACHED:{max_comps}")

    # Return existing if URL or name duplicated — idempotent add
    existing = await session.execute(
        select(Competitor).where(
            Competitor.hotel_id == current_user.hotel_id,
            (Competitor.url == comp_data.url) | (Competitor.name == comp_data.name),
        )
    )
    existing_comp = existing.scalars().first()
    if existing_comp:
        return existing_comp

    comp = Competitor(
        hotel_id=current_user.hotel_id,
        name=comp_data.name,
        url=comp_data.url,
        source=comp_data.source,
    )
    session.add(comp)
    await session.commit()
    await session.refresh(comp)
    return comp


@router.delete("/{comp_id}")
async def delete_competitor(comp_id: str, current_user: CurrentUser, session: DbSession):
    """Delete a competitor and all their rate history."""
    check_rate_shopper_feature(current_user)
    comp = await session.get(Competitor, comp_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    if comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.models.competitor import CompetitorRate, ScraperUsage

    # Delete child rows in dependency order before deleting the parent.
    # Supabase enforces FK constraints — skipping either delete causes a
    # "violates foreign key constraint" error.
    rates_res = await session.execute(
        select(CompetitorRate).where(CompetitorRate.competitor_id == comp_id)
    )
    for r in rates_res.scalars().all():
        await session.delete(r)

    usage_res = await session.execute(
        select(ScraperUsage).where(ScraperUsage.competitor_id == comp_id)
    )
    for u in usage_res.scalars().all():
        await session.delete(u)

    await session.delete(comp)
    await session.commit()

    # Clean up any live Redis keys for this competitor (progress, cooldown, cancel).
    for key in (
        f"scrape_progress:{comp_id}",
        f"scrape_cancel:{comp_id}",
        f"scrape_cooldown:{comp_id}",
    ):
        try:
            redis_client.delete_value(key)
        except Exception:
            pass

    return {"message": "Competitor deleted successfully"}


@router.patch("/{comp_id}/schedule", response_model=Competitor)
async def toggle_competitor_schedule(
    comp_id: str,
    payload: dict,
    current_user: CurrentUser,
    session: DbSession,
):
    """Toggle automatic daily refresh for a competitor."""
    check_rate_shopper_feature(current_user)
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")

    comp.is_scheduled = payload.get("is_scheduled", False)
    session.add(comp)
    await session.commit()
    await session.refresh(comp)
    return comp
