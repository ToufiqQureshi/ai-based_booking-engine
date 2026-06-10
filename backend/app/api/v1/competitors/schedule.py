"""
Auto-scrape schedule management: hotelier configures up to 4 local hours per day
for automatic competitor rate fetching. Also hosts the scheduler tick function.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydanticField, field_validator
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession, require_hotel_role
from app.core.feature_flags import require_feature
from app.core.redis_client import redis_client
from app.models.hotel import Hotel
from app.models.competitor import Competitor

from .background import run_background_scrape
from .crud import check_rate_shopper_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])

# Per-hotel dedupe TTL: fires at most once per calendar day even if the scheduler
# ticks hourly and the hour matches for >1 tick (DST edge cases etc.).
AUTO_SCRAPE_DEDUPE_TTL = 23 * 3600


class ScrapeScheduleResponse(BaseModel):
    scrape_hours: List[int] = []   # up to 4 local hours (0-23) per day
    timezone: str = "Asia/Kolkata"


class ScrapeScheduleUpdate(BaseModel):
    scrape_hours: Optional[List[int]] = PydanticField(default=None)

    @field_validator("scrape_hours")
    @classmethod
    def _validate_hours(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v is None:
            return v
        cleaned = sorted({int(h) for h in v})
        invalid = [h for h in cleaned if not (0 <= h <= 23)]
        if invalid:
            raise ValueError(f"Invalid hour(s) {invalid}: each must be 0-23")
        if len(cleaned) > 4:
            raise ValueError("Maximum 4 scrape times per day allowed")
        return cleaned


def _read_scrape_hours(hotel_settings: dict) -> List[int]:
    """Read scrape schedule, handling both the new (list) and legacy (single int) formats."""
    hours = hotel_settings.get("rate_shopper_scrape_hours")
    if isinstance(hours, list):
        return [h for h in hours if isinstance(h, int) and 0 <= h <= 23]
    # Backward compat: old single-hour setting
    legacy = hotel_settings.get("rate_shopper_scrape_hour")
    if isinstance(legacy, int) and 0 <= legacy <= 23:
        return [legacy]
    return []


@router.get(
    "/schedule",
    response_model=ScrapeScheduleResponse,
    dependencies=[Depends(require_feature("feature_rate_shopper"))],
)
async def get_scrape_schedule(current_user: CurrentUser, session: DbSession):
    """Get the hotel's configured automatic scrape schedule."""
    check_rate_shopper_feature(current_user)
    hotel = await session.get(Hotel, current_user.hotel_id)
    hotel_settings = (hotel.settings if hotel else None) or {}
    return ScrapeScheduleResponse(
        scrape_hours=_read_scrape_hours(hotel_settings),
        timezone=hotel_settings.get("timezone") or "Asia/Kolkata",
    )


@router.put(
    "/schedule",
    response_model=ScrapeScheduleResponse,
    dependencies=[
        Depends(require_hotel_role("OWNER", "MANAGER")),
        Depends(require_feature("feature_rate_shopper")),
    ],
)
async def update_scrape_schedule(
    payload: ScrapeScheduleUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    """
    Set up to 4 local hours per day for automatic competitor scraping.
    Empty list / null turns auto-scrape off; manual refresh always works.
    """
    check_rate_shopper_feature(current_user)
    hotel = await session.get(Hotel, current_user.hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    new_settings = dict(hotel.settings or {})
    new_hours = payload.scrape_hours or []
    new_settings["rate_shopper_scrape_hours"] = new_hours
    new_settings.pop("rate_shopper_scrape_hour", None)   # remove legacy single-hour key
    hotel.settings = new_settings
    session.add(hotel)
    await session.commit()

    return ScrapeScheduleResponse(
        scrape_hours=new_hours,
        timezone=new_settings.get("timezone") or "Asia/Kolkata",
    )


async def run_due_auto_scrapes(session) -> None:
    """
    Hourly scheduler tick: kick off competitor scrapes for every Rate-Shopper hotel
    whose configured local hour(s) match the current time.

    Per-hour dedupe key (per hotel, per day, per hour) so both a 9 AM and a 3 PM
    slot can fire independently on the same calendar day.
    """
    from zoneinfo import ZoneInfo

    now_utc = datetime.utcnow().replace(tzinfo=ZoneInfo("UTC"))

    hotels_res = await session.execute(
        select(Hotel.id, Hotel.settings).where(Hotel.feature_rate_shopper == True)
    )

    for hotel_id, hotel_settings in hotels_res.all():
        hotel_settings = hotel_settings or {}
        scrape_hours = _read_scrape_hours(hotel_settings)
        if not scrape_hours:
            continue

        tz_name = hotel_settings.get("timezone") or "UTC"
        try:
            local_now = now_utc.astimezone(ZoneInfo(tz_name))
        except Exception:
            local_now = now_utc

        if local_now.hour not in scrape_hours:
            continue

        dedupe_key = f"rate_shopper_auto_scrape:{hotel_id}:{local_now.strftime('%Y%m%d')}:{local_now.hour}"
        try:
            if not await redis_client.set_nx_ex(dedupe_key, "1", expire=AUTO_SCRAPE_DEDUPE_TTL):
                continue
        except Exception as exc:
            logger.warning(f"Auto-scrape dedupe check failed for hotel {hotel_id}: {exc}")
            continue

        comp_res = await session.execute(
            select(Competitor.id).where(
                Competitor.hotel_id == hotel_id,
                Competitor.is_active == True,
            )
        )
        comp_ids = comp_res.scalars().all()
        if not comp_ids:
            continue

        logger.info(
            f"Auto-scrape: triggering {len(comp_ids)} competitor(s) for hotel {hotel_id} "
            f"(local hour {local_now.hour}, tz {tz_name}, slots: {scrape_hours})"
        )
        for comp_id in comp_ids:
            await run_background_scrape(comp_id)
