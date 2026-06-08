"""
Analytics Dashboard — full aggregated report for the hotelier dashboard.
Single heavy endpoint; broken into numbered computation steps for readability.
Cached 10 min per hotel_id to keep DB load manageable.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.core.cache import cache_response
from app.models.analytics import AnalyticsEvent, AnalyticsSession
from app.models.booking import Booking, BookingSource, BookingStatus
from app.models.room import RoomType

logger = logging.getLogger(__name__)
router = APIRouter()

# ISO-3166-1 alpha-2 codes for the countries we see most in Indian hotel traffic
_COUNTRY_CODES: dict[str, str] = {
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


def _nights(booking) -> int:
    """Safe night-count that always returns at least 1 (handles walk-ins and backdated bookings)."""
    try:
        return max(1, (booking.check_out - booking.check_in).days)
    except Exception:
        return 1


@router.get("/dashboard")
@cache_response(expire=600, key_prefix="analytics_dashboard")
async def get_analytics_dashboard(current_user: CurrentUser, session: DbSession, days: int = 7):
    """
    Full analytics report: traffic, revenue, funnel, heatmap, rooms, AI, geo, forecasts.
    Use the focused sub-endpoints (/dashboard/revenue etc.) for partial refreshes.
    """
    try:
        hotel_id = current_user.hotel_id
        if not hotel_id:
            return {"error": "No hotel linked"}

        start = (datetime.now(timezone.utc) - timedelta(days=days)).replace(tzinfo=None)

        # --- 1. Raw data fetch (3 queries total, no N+1) ---
        sessions = (await session.execute(
            select(AnalyticsSession)
            .where(AnalyticsSession.hotel_id == hotel_id, AnalyticsSession.started_at >= start)
            .options(selectinload(AnalyticsSession.events))
        )).scalars().unique().all()

        bookings = (await session.execute(
            select(Booking).where(Booking.hotel_id == hotel_id, Booking.created_at >= start)
        )).scalars().all()

        room_types = (await session.execute(
            select(RoomType).where(RoomType.hotel_id == hotel_id)
        )).scalars().all()
        total_inventory = sum(r.total_inventory for r in room_types) or 1

        # --- 2. Basic traffic metrics ---
        total_visitors = len(sessions)
        active_bookings = [b for b in bookings if b.status != BookingStatus.CANCELLED]
        total_conversions = len(active_bookings)
        conversion_rate = round(total_conversions / total_visitors * 100, 2) if total_visitors else 0
        avg_time = int(sum(s.time_spent_seconds or 0 for s in sessions) / total_visitors) if total_visitors else 0

        # --- 3. Cancellation metrics ---
        cancellations = [b for b in bookings if b.status == BookingStatus.CANCELLED]
        cancellation_rate = round(len(cancellations) / len(bookings) * 100, 2) if bookings else 0
        lost_revenue = sum(float(b.total_amount or 0) for b in cancellations)
        cancellation_fees = sum(float(b.cancellation_fee or 0) for b in cancellations)

        # --- 4. Device split ---
        device_counts: dict[str, int] = {}
        for s in sessions:
            k = s.device_type or "unknown"
            device_counts[k] = device_counts.get(k, 0) + 1
        device_stats = [{"type": k, "count": v} for k, v in device_counts.items()]

        # --- 5. Daily chart (visitors + revenue + cancellations) ---
        chart_map = {
            (datetime.utcnow() - timedelta(days=i)).strftime("%d %b"): {"visitors": 0, "revenue": 0, "cancellations": 0}
            for i in range(days)
        }
        for s in sessions:
            ds = s.started_at.strftime("%d %b")
            if ds in chart_map:
                chart_map[ds]["visitors"] += 1
        for b in bookings:
            ds = b.created_at.strftime("%d %b")
            if b.status != BookingStatus.CANCELLED:
                if ds in chart_map:
                    chart_map[ds]["revenue"] += float(b.total_amount or 0)
            else:
                if ds in chart_map:
                    chart_map[ds]["cancellations"] += 1
        chart_data = [{"date": k, **v} for k, v in reversed(chart_map.items())]

        # --- 6. Booking funnel ---
        funnel_stages = ["page_view", "search", "room_view", "booking_complete"]
        funnel_counts = {s: 0 for s in funnel_stages}
        for s in sessions:
            event_types = {e.event_type for e in s.events}
            for stage in funnel_stages:
                if stage in event_types:
                    funnel_counts[stage] += 1
        funnel_data = [{"stage": k, "count": v} for k, v in funnel_counts.items()]
        funnel_dropoffs = [
            {
                "stage": funnel_data[i]["stage"],
                "drop_percentage": round((funnel_data[i]["count"] - funnel_data[i + 1]["count"]) / funnel_data[i]["count"] * 100, 1)
                if funnel_data[i]["count"] else 0,
            }
            for i in range(len(funnel_data) - 1)
        ]

        # --- 7. Traffic heatmap (hotel's local timezone) ---
        from zoneinfo import ZoneInfo
        from app.models.hotel import Hotel
        hotel_obj = await session.get(Hotel, hotel_id)
        tz_name = (hotel_obj.settings or {}).get("timezone", "Asia/Kolkata") if hotel_obj else "Asia/Kolkata"
        target_tz = ZoneInfo(tz_name)
        heatmap_counts: dict[str, int] = {}
        for s in sessions:
            dt_local = s.started_at.replace(tzinfo=timezone.utc).astimezone(target_tz)
            k = f"{dt_local.weekday()}-{dt_local.hour}"
            heatmap_counts[k] = heatmap_counts.get(k, 0) + 1
        heatmap_list = [
            {"weekday": wd, "hour": hr, "visitors": heatmap_counts.get(f"{wd}-{hr}", 0)}
            for wd in range(7) for hr in range(24)
        ]

        # --- 8. Revenue KPIs (ADR / RevPAR / occupancy) ---
        revenue_total = sum(float(b.total_amount or 0) for b in active_bookings)
        total_room_nights = sum(len(b.rooms or []) * _nights(b) for b in active_bookings)
        total_available = total_inventory * days
        avg_daily_rate = round(revenue_total / total_room_nights, 2) if total_room_nights else 0
        rev_par = round(revenue_total / total_available, 2) if total_available else 0
        occupancy_rate = round(min(100.0, total_room_nights / total_available * 100), 2) if total_available else 0

        # --- 9. AI efficiency ---
        from app.models.lead import Lead
        leads = (await session.execute(
            select(Lead).where(Lead.hotel_id == hotel_id, Lead.created_at >= start)
        )).scalars().all()
        ai_bookings = [b for b in bookings if b.source == BookingSource.AI_AGENT]
        ai_engaged = sum(1 for s in sessions if any(e.event_type == "ai_inquiry" for e in s.events))
        ai_revenue = round(sum(float(b.total_amount or 0) for b in ai_bookings if b.status != BookingStatus.CANCELLED), 2)
        res_rate = round(len(ai_bookings) / ai_engaged * 100, 2) if ai_engaged else 0
        room_interest: dict[str, int] = {}
        for lead in leads:
            if lead.room_type_preference:
                k = lead.room_type_preference.strip()
                room_interest[k] = room_interest.get(k, 0) + 1
        popular_questions = [
            {"text": k, "value": v}
            for k, v in sorted(room_interest.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        # --- 10. Geo stats ---
        geo_counts: dict[str, int] = {}
        for s in sessions:
            country = s.country or "Unknown"
            geo_counts[country] = geo_counts.get(country, 0) + 1
        geo_stats = sorted(
            [
                {
                    "country": c,
                    "code": _COUNTRY_CODES.get(c, c[:2].upper()),
                    "visitors": cnt,
                    "percentage": round(cnt / total_visitors * 100, 1) if total_visitors else 0,
                }
                for c, cnt in geo_counts.items()
            ],
            key=lambda x: x["visitors"],
            reverse=True,
        )

        # --- 11. Room popularity ---
        room_stats = {r.id: {"id": r.id, "name": r.name, "views": 0, "bookings": 0, "revenue": 0} for r in room_types}
        for s in sessions:
            for e in s.events:
                if e.event_type == "room_view" and e.room_type_id in room_stats:
                    room_stats[e.room_type_id]["views"] += 1
        for b in active_bookings:
            for rm in b.rooms:
                rt_id = rm.get("room_type_id")
                if rt_id in room_stats:
                    room_stats[rt_id]["bookings"] += 1
                    room_stats[rt_id]["revenue"] += rm.get("total_price", 0)
        sorted_rooms = sorted(room_stats.values(), key=lambda x: x["bookings"], reverse=True)
        revenue_mix = [{"name": r["name"], "value": r["revenue"]} for r in sorted_rooms if r["revenue"] > 0]

        # --- 12. Booking window distribution ---
        window_buckets = {"0-3 days": 0, "4-7 days": 0, "8-14 days": 0, "15-30 days": 0, "30+ days": 0}
        for b in bookings:
            d = max(0, (b.check_in - b.created_at.date()).days)
            if d <= 3:    window_buckets["0-3 days"] += 1
            elif d <= 7:  window_buckets["4-7 days"] += 1
            elif d <= 14: window_buckets["8-14 days"] += 1
            elif d <= 30: window_buckets["15-30 days"] += 1
            else:         window_buckets["30+ days"] += 1

        # --- 13. Occupancy forecast (next 7 days) ---
        future_bookings = (await session.execute(
            select(Booking).where(
                Booking.hotel_id == hotel_id,
                Booking.check_out >= datetime.utcnow().date(),
                Booking.status != BookingStatus.CANCELLED,
            )
        )).scalars().all()
        forecast = [
            {
                "date": (datetime.utcnow() + timedelta(days=i)).date().strftime("%m/%d"),
                "occupancy": round(min(100.0, sum(
                    len(b.rooms) for b in future_bookings
                    if b.check_in <= (datetime.utcnow() + timedelta(days=i)).date() < b.check_out
                ) / total_inventory * 100), 1) if total_inventory else 0,
            }
            for i in range(7)
        ]

        # --- 14. Pickup stats ---
        today = datetime.utcnow().date()
        pickup_today = sum(1 for b in bookings if b.created_at.date() == today)
        pickup_yesterday = sum(1 for b in bookings if b.created_at.date() == today - timedelta(days=1))

        # --- 15. Promo usage ---
        promo_counts: dict[str, int] = {}
        for b in bookings:
            if b.promo_code:
                promo_counts[b.promo_code] = promo_counts.get(b.promo_code, 0) + 1

        return {
            "total_visitors": total_visitors,
            "avg_time_spent_seconds": avg_time,
            "total_conversions": total_conversions,
            "conversion_rate": conversion_rate,
            "cancellations_count": len(cancellations),
            "cancellation_rate": cancellation_rate,
            "lost_revenue": lost_revenue,
            "cancellation_fees_collected": cancellation_fees,
            "chart_data": chart_data,
            "funnel_data": funnel_data,
            "funnel_dropoffs": funnel_dropoffs,
            "revenue_total": revenue_total,
            "avg_daily_rate": avg_daily_rate,
            "rev_par": rev_par,
            "occupancy_rate": occupancy_rate,
            "traffic_heatmap": heatmap_list,
            "ai_resolution_rate": res_rate,
            "ai_revenue": ai_revenue,
            "popular_questions": popular_questions,
            "total_leads": len(leads),
            "ai_assisted_bookings": len(ai_bookings),
            "device_stats": device_stats,
            "geo_stats": geo_stats,
            "most_booked_rooms": sorted_rooms[:5],
            "least_booked_rooms": sorted_rooms[-5:],
            "revenue_by_room_type": revenue_mix,
            "booking_window_data": [{"window": k, "count": v} for k, v in window_buckets.items()],
            "occupancy_forecast": forecast,
            "promo_stats": [{"code": k, "bookings": v} for k, v in promo_counts.items()],
            "pickup_stats": {
                "today": pickup_today,
                "yesterday": pickup_yesterday,
                "trend": "up" if pickup_today >= pickup_yesterday else "down",
            },
            "commission_saved": round(revenue_total * 0.15, 2),
        }

    except Exception as e:
        logger.error("Analytics dashboard error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
