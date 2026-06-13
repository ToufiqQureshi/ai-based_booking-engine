"""
Background refresh task for the social proof cache.

The public /api/v1/public/social-proof/{slug} endpoint must respond
under 100ms. To achieve that without scanning the bookings table on
every request, we pre-aggregate the numbers into
HotelSocialProofSettings.cached_* columns on a 5-minute cadence.

Triggered by:
  1. The super-admin's manual "Refresh" button (POST
     /api/v1/superadmin/social-proof/refresh) — for testing / after
     a config change.
  2. A FastAPI lifespan startup hook that runs immediately on boot
     (so the very first page load after a deploy doesn't have cold
     stats).
  3. (Future) a periodic task — for now we run it lazily: any
     successful write to a booking / review can enqueue a refresh
     via `safe_background`, but we don't spin up a cron here.

The function deliberately swallows per-hotel errors so a single
bad row can't kill the whole batch.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select

from app.core.time import utcnow
from app.bookings.booking import Booking, BookingStatus
from app.brand_console.hotel import Hotel
from app.google_reviews.social_proof_model import HotelSocialProofSettings
from app.models.review import Review  # type: ignore  # may not exist yet

logger = logging.getLogger(__name__)

STALE_AFTER_SECONDS = 5 * 60  # refresh every 5 min


async def _refresh_one_hotel(session, hotel_id: str, slug: str) -> bool:
    """Recompute cached stats for one hotel. Returns True on success."""
    try:
        # Bookings this calendar month
        now = utcnow()
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        bookings_q = select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id,
            Booking.created_at >= first_of_month,
            Booking.status.in_([
                BookingStatus.CONFIRMED,
                BookingStatus.CHECKED_IN,
                BookingStatus.CHECKED_OUT,
            ]),
        )
        bookings_count = (await session.execute(bookings_q)).scalar_one() or 0

        # Hours since the most recent completed booking
        last_booking_q = (
            select(Booking.created_at)
            .where(
                Booking.hotel_id == hotel_id,
                Booking.status == BookingStatus.CONFIRMED,
            )
            .order_by(Booking.created_at.desc())
            .limit(1)
        )
        last_booking_at = (await session.execute(last_booking_q)).scalar_one_or_none()
        hours_since: Optional[float] = None
        if last_booking_at is not None:
            delta = now - last_booking_at
            hours_since = max(0.0, delta.total_seconds() / 3600.0)

        # Review aggregate (if a Review model exists)
        review_count = 0
        avg_rating = 0.0
        try:
            review_q = select(
                func.count(Review.id), func.avg(Review.rating)
            ).where(Review.hotel_id == hotel_id)
            r_res = await session.execute(review_q)
            rc, ar = r_res.one()
            review_count = int(rc or 0)
            avg_rating = float(ar or 0.0)
        except Exception:
            # Review model not present in this build — skip.
            review_count = 0
            avg_rating = 0.0

        # Upsert settings
        sp_q = select(HotelSocialProofSettings).where(
            HotelSocialProofSettings.hotel_id == hotel_id
        )
        sp = (await session.execute(sp_q)).scalar_one_or_none()
        if sp is None:
            sp = HotelSocialProofSettings(hotel_id=hotel_id)
            session.add(sp)
        sp.cached_booking_count = int(bookings_count)
        sp.cached_review_count = int(review_count)
        sp.cached_avg_rating = float(avg_rating)
        sp.cached_hours_since_last_booking = hours_since
        sp.cache_refreshed_at = utcnow()
        sp.updated_at = utcnow()

        # Bust public cache so the next request sees fresh data
        from app.core.redis_client import redis_client
        try:
            redis_client.delete_key(f"public:social-proof:{slug}")
            redis_client.delete_key(f"public:social-proof:{hotel_id}")
        except Exception:
            pass

        return True
    except Exception as e:
        logger.exception("Failed to refresh social proof for hotel %s: %s", hotel_id, e)
        return False


async def refresh_all_social_proof_stats(session) -> dict:
    """Refresh stats for every hotel. Returns a summary dict."""
    hotels_q = select(Hotel.id, Hotel.slug).where(Hotel.is_active == True)  # noqa: E712
    rows = (await session.execute(hotels_q)).all()
    success = 0
    failed = 0
    for hid, slug in rows:
        ok = await _refresh_one_hotel(session, hid, slug)
        if ok:
            success += 1
        else:
            failed += 1
    try:
        await session.commit()
    except Exception as e:
        logger.warning("social proof refresh commit failed: %s", e)
    return {"hotels_total": len(rows), "success": success, "failed": failed}


async def refresh_one_hotel_now(session, hotel_id: str) -> bool:
    """Refresh stats for a single hotel. Used by the super-admin
    manual-trigger endpoint."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        return False
    ok = await _refresh_one_hotel(session, hotel.id, hotel.slug)
    if ok:
        try:
            await session.commit()
        except Exception as e:
            logger.warning("single-hotel refresh commit failed: %s", e)
    return ok
