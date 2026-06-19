"""
Super Admin — Hotel health monitoring and onboarding tracker.
"""
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import func, select

from app.core.auth.deps import DbSession
from app.bookings.booking import Booking, BookingStatus
from app.brand_console.hotel import Hotel
from app.integration.integration import IntegrationSettings
from app.rate_plans.rates_model import RatePlan
from app.rooms.room import RoomType
from app.superadmin.subscriptions.subscription import Subscription
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _db_pool_stats() -> dict:
    """Live SQLAlchemy connection-pool usage so admins can watch headroom
    against the Supabase connection limit (the #1 scale crash risk)."""
    try:
        from app.core.db.database import engine
        pool = engine.pool
        checked_out = pool.checkedout()
        size = pool.size()
        overflow = pool.overflow()
        capacity = size + max(overflow, 0)
        return {
            "pool_size": size,
            "checked_out": checked_out,
            "checked_in": pool.checkedin(),
            "overflow": overflow,
            "capacity_per_worker": capacity,
            "utilization_pct": round((checked_out / capacity) * 100, 1) if capacity else 0,
        }
    except Exception as e:  # pragma: no cover - telemetry only
        return {"error": str(e)}


async def _hotel_health(session, hotel: Hotel) -> dict:
    """Compute health metrics for a single hotel."""
    now = date.today()
    month_start = now.replace(day=1)

    # Bookings this month
    month_bk_res = await session.execute(
        select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel.id,
            Booking.created_at >= month_start,
        )
    )
    bookings_this_month = month_bk_res.scalar() or 0

    # Last booking date
    last_bk_res = await session.execute(
        select(Booking.created_at)
        .where(Booking.hotel_id == hotel.id)
        .order_by(Booking.created_at.desc())
        .limit(1)
    )
    last_booking_row = last_bk_res.scalar_one_or_none()
    last_booking_at = last_booking_row.isoformat() if last_booking_row else None

    # Onboarding checklist
    rooms_count = (await session.execute(
        select(func.count(RoomType.id)).where(RoomType.hotel_id == hotel.id)
    )).scalar() or 0

    plans_count = (await session.execute(
        select(func.count(RatePlan.id)).where(RatePlan.hotel_id == hotel.id)
    )).scalar() or 0

    int_settings = (await session.execute(
        select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
    )).scalar_one_or_none()

    total_bookings = (await session.execute(
        select(func.count(Booking.id)).where(Booking.hotel_id == hotel.id)
    )).scalar() or 0

    subscription = (await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel.id)
    )).scalar_one_or_none()

    onboarding_steps = {
        "rooms_added": rooms_count > 0,
        "rate_plans_set": plans_count > 0,
        "integration_configured": bool(int_settings),
        "ai_configured": bool(int_settings and int_settings.ai_api_key),
        "first_booking_received": total_bookings > 0,
        "subscription_active": bool(subscription and subscription.status == "active"),
    }
    onboarding_score = sum(onboarding_steps.values())
    onboarding_total = len(onboarding_steps)

    # Determine health status
    days_since_booking = None
    is_dormant = False
    if last_booking_row:
        days_since = (date.today() - last_booking_row.date()).days
        days_since_booking = days_since
        is_dormant = days_since > 30

    if not hotel.is_active:
        health_status = "disabled"
    elif hotel.is_paused:
        health_status = "paused"
    elif is_dormant:
        health_status = "dormant"
    elif onboarding_score < 3:
        health_status = "incomplete"
    else:
        health_status = "healthy"

    return {
        "hotel_id": hotel.id,
        "hotel_name": hotel.name,
        "slug": hotel.slug,
        "health_status": health_status,
        "is_active": hotel.is_active,
        "is_paused": hotel.is_paused,
        "bookings_this_month": bookings_this_month,
        "total_bookings": total_bookings,
        "last_booking_at": last_booking_at,
        "days_since_booking": days_since_booking,
        "rooms_count": rooms_count,
        "rate_plans_count": plans_count,
        "subscription_plan": subscription.plan_name if subscription else None,
        "subscription_status": subscription.status if subscription else "none",
        "subscription_end_date": subscription.end_date.isoformat() if subscription and subscription.end_date else None,
        "whatsapp_credits": subscription.whatsapp_credits if subscription else 0,
        "ai_hotelier_daily_limit": subscription.ai_hotelier_daily_limit if subscription else 0,
        "ai_guest_chat_daily_limit": subscription.ai_guest_chat_daily_limit if subscription else 0,
        "ai_whatsapp_daily_limit": subscription.ai_whatsapp_daily_limit if subscription else 0,
        "onboarding": {
            "steps": onboarding_steps,
            "score": onboarding_score,
            "total": onboarding_total,
            "percentage": round((onboarding_score / onboarding_total) * 100),
        },
        "features": {
            "ai_agent": hotel.feature_ai_agent,
            "guest_bot": hotel.feature_guest_bot,
            "google_ads": hotel.feature_google_ads,
        },
    }


@router.get("/health")
async def platform_health(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.health.read")),
):
    """Platform-wide health overview — all hotels, statuses, dormant alerts."""
    hotels_res = await session.execute(select(Hotel))
    hotels = hotels_res.scalars().all()

    results = []
    for hotel in hotels:
        try:
            results.append(await _hotel_health(session, hotel))
        except Exception as e:
            logger.error("Health check failed for hotel %s: %s", hotel.id, e)

    total = len(results)
    healthy = sum(1 for h in results if h["health_status"] == "healthy")
    dormant = sum(1 for h in results if h["health_status"] == "dormant")
    incomplete = sum(1 for h in results if h["health_status"] == "incomplete")
    disabled = sum(1 for h in results if h["health_status"] in ("disabled", "paused"))

    return {
        "summary": {
            "total": total,
            "healthy": healthy,
            "dormant": dormant,
            "incomplete": incomplete,
            "disabled": disabled,
        },
        "infra": _db_pool_stats(),
        "hotels": sorted(results, key=lambda x: (
            0 if x["health_status"] == "healthy" else
            1 if x["health_status"] == "dormant" else
            2 if x["health_status"] == "incomplete" else 3
        )),
    }


@router.get("/health/{hotel_id}")
async def hotel_health(
    hotel_id: str,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.health.read")),
):
    """Detailed health report for a single hotel."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Hotel not found")
    return await _hotel_health(session, hotel)


