import json
from typing import List, Dict, Any
from datetime import date, timedelta
from collections import defaultdict
from sqlmodel import select, func, and_
from app.models.booking import Booking, BookingStatus, BookingSource, Guest
from app.models.room import RoomType


def _chart(d: dict) -> str:
    return f"\n[CHART_DATA]\n{json.dumps(d, default=str)}\n[/CHART_DATA]\n"


async def logic_get_revenue_trend(session, hotel_id: str, days: int = 30) -> str:
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    query = select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_in >= start_date,
        Booking.check_in <= end_date
    )
    result = await session.execute(query)
    bookings = result.scalars().all()

    # Attribute revenue to check-in date
    daily: Dict[str, float] = {}
    current = start_date
    while current <= end_date:
        daily[current.isoformat()] = 0.0
        current += timedelta(days=1)

    for b in bookings:
        key = b.check_in.isoformat()
        if key in daily:
            daily[key] += b.total_amount

    data = [{"date": k[-5:], "revenue": round(v)} for k, v in sorted(daily.items())]
    total = round(sum(v["revenue"] for v in data))

    chart = {
        "type": "line",
        "title": f"Daily Revenue — Last {days} Days",
        "data": data,
        "xKey": "date",
        "yKeys": [{"key": "revenue", "label": "Revenue (₹)", "color": "#7C3AED"}]
    }
    return f"**Total Revenue (Last {days} days): ₹{total:,}**" + _chart(chart)


async def logic_get_occupancy_trend(session, hotel_id: str, days: int = 30) -> str:
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    # Total inventory
    inv_res = await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == hotel_id)
    )
    total_inventory = inv_res.scalar() or 0
    if total_inventory == 0:
        return "No room inventory found."

    # Bookings overlapping the window
    b_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_in < end_date + timedelta(days=1),
        Booking.check_out > start_date
    ))
    bookings = b_res.scalars().all()

    daily_occ: Dict[str, int] = {}
    current = start_date
    while current <= end_date:
        daily_occ[current.isoformat()] = 0
        current += timedelta(days=1)

    for b in bookings:
        cur = max(b.check_in, start_date)
        stop = min(b.check_out, end_date + timedelta(days=1))
        while cur < stop:
            key = cur.isoformat()
            if key in daily_occ:
                daily_occ[key] += len(b.rooms)
            cur += timedelta(days=1)

    data = [
        {"date": k[-5:], "occupancy": round((v / total_inventory) * 100, 1)}
        for k, v in sorted(daily_occ.items())
    ]
    avg_occ = round(sum(d["occupancy"] for d in data) / len(data), 1)

    chart = {
        "type": "line",
        "title": f"Daily Occupancy % — Last {days} Days",
        "data": data,
        "xKey": "date",
        "yKeys": [{"key": "occupancy", "label": "Occupancy %", "color": "#10B981"}]
    }
    return f"**Average Occupancy (Last {days} days): {avg_occ}%**" + _chart(chart)


async def logic_get_booking_source_breakdown(session, hotel_id: str, days: int = 30) -> str:
    start_date = date.today() - timedelta(days=days)

    b_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status != BookingStatus.CANCELLED,
        Booking.check_in >= start_date
    ))
    bookings = b_res.scalars().all()

    source_data: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    for b in bookings:
        src = (b.source or "direct").replace("_", " ").title()
        source_data[src]["count"] += 1
        source_data[src]["revenue"] += b.total_amount

    if not source_data:
        return "No booking data available for the selected period."

    data = [
        {"source": src, "bookings": v["count"], "revenue": round(v["revenue"])}
        for src, v in sorted(source_data.items(), key=lambda x: -x[1]["revenue"])
    ]

    chart = {
        "type": "pie",
        "title": f"Booking Sources — Last {days} Days",
        "data": data,
        "xKey": "source",
        "yKeys": [{"key": "bookings", "label": "Bookings", "color": "#7C3AED"}]
    }
    return f"**Booking Source Breakdown (Last {days} days):**" + _chart(chart)


async def logic_get_room_performance(session, hotel_id: str, days: int = 30) -> str:
    start_date = date.today() - timedelta(days=days)

    rt_res = await session.execute(select(RoomType).where(RoomType.hotel_id == hotel_id))
    room_types = {rt.id: rt.name for rt in rt_res.scalars().all()}

    b_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_in >= start_date
    ))
    bookings = b_res.scalars().all()

    perf: Dict[str, Dict] = defaultdict(lambda: {"bookings": 0, "revenue": 0.0})
    for b in bookings:
        for room in b.rooms:
            rt_id = room.get("room_type_id")
            name = room_types.get(rt_id, "Unknown")
            perf[name]["bookings"] += 1
            perf[name]["revenue"] += room.get("total_price", 0)

    if not perf:
        return "No booking data for room performance."

    data = [
        {"room": name, "bookings": v["bookings"], "revenue": round(v["revenue"])}
        for name, v in sorted(perf.items(), key=lambda x: -x[1]["revenue"])
    ]

    chart = {
        "type": "bar",
        "title": f"Room Performance — Last {days} Days",
        "data": data,
        "xKey": "room",
        "yKeys": [
            {"key": "revenue", "label": "Revenue (₹)", "color": "#7C3AED"},
            {"key": "bookings", "label": "Bookings", "color": "#10B981"}
        ]
    }
    return f"**Room-wise Performance (Last {days} days):**" + _chart(chart)


async def logic_get_revpar(session, hotel_id: str, days: int = 30) -> str:
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    inv_res = await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == hotel_id)
    )
    total_inventory = inv_res.scalar() or 0
    if total_inventory == 0:
        return "No room inventory configured."

    b_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_in < end_date + timedelta(days=1),
        Booking.check_out > start_date
    ))
    bookings = b_res.scalars().all()

    total_revenue = 0.0
    occupied_nights = 0
    for b in bookings:
        overlap_start = max(b.check_in, start_date)
        overlap_end = min(b.check_out, end_date + timedelta(days=1))
        nights = (overlap_end - overlap_start).days
        if nights > 0:
            daily_rate = b.total_amount / max((b.check_out - b.check_in).days, 1)
            total_revenue += daily_rate * nights * len(b.rooms)
            occupied_nights += nights * len(b.rooms)

    available_nights = total_inventory * days
    revpar = round(total_revenue / available_nights, 2) if available_nights > 0 else 0
    adr = round(total_revenue / occupied_nights, 2) if occupied_nights > 0 else 0
    occupancy_pct = round((occupied_nights / available_nights) * 100, 1) if available_nights > 0 else 0

    # Monthly breakdown for chart (last 3 months)
    chart_data = [
        {"metric": "RevPAR", "value": revpar},
        {"metric": "ADR", "value": adr},
        {"metric": "Occupancy %", "value": occupancy_pct},
    ]

    chart = {
        "type": "bar",
        "title": f"KPI Summary — Last {days} Days",
        "data": chart_data,
        "xKey": "metric",
        "yKeys": [{"key": "value", "label": "Value", "color": "#F59E0B"}]
    }

    summary = (
        f"**Hotel KPI — Last {days} Days:**\n"
        f"- **RevPAR**: ₹{revpar:,}\n"
        f"- **ADR** (Avg Daily Rate): ₹{adr:,}\n"
        f"- **Occupancy**: {occupancy_pct}%\n"
        f"- **Total Revenue**: ₹{round(total_revenue):,}"
    )
    return summary + _chart(chart)


async def logic_get_revenue_forecast(session, hotel_id: str, forecast_days: int = 30) -> str:
    # Use last 8 weeks of data to compute avg revenue by day-of-week
    history_start = date.today() - timedelta(weeks=8)
    end_date = date.today() - timedelta(days=1)

    b_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_in >= history_start,
        Booking.check_in <= end_date
    ))
    bookings = b_res.scalars().all()

    dow_totals: Dict[int, float] = defaultdict(float)  # 0=Mon, 6=Sun
    dow_counts: Dict[int, int] = defaultdict(int)

    for b in bookings:
        dow = b.check_in.weekday()
        dow_totals[dow] += b.total_amount
        dow_counts[dow] += 1

    dow_avg = {
        dow: (dow_totals[dow] / dow_counts[dow]) if dow_counts[dow] > 0 else 0
        for dow in range(7)
    }

    # Generate forecast
    forecast = []
    today = date.today()
    for i in range(forecast_days):
        future_date = today + timedelta(days=i)
        dow = future_date.weekday()
        predicted = round(dow_avg.get(dow, 0))
        forecast.append({"date": future_date.strftime("%m/%d"), "predicted": predicted})

    if all(f["predicted"] == 0 for f in forecast):
        return "Not enough historical data to generate a forecast (need at least a few weeks of bookings)."

    total_forecast = sum(f["predicted"] for f in forecast)

    chart = {
        "type": "bar",
        "title": f"Revenue Forecast — Next {forecast_days} Days",
        "data": forecast,
        "xKey": "date",
        "yKeys": [{"key": "predicted", "label": "Predicted Revenue (₹)", "color": "#3B82F6"}]
    }
    return (
        f"**Forecast: ₹{total_forecast:,} expected revenue over next {forecast_days} days**\n"
        f"_(Based on day-of-week patterns from last 8 weeks)_"
        + _chart(chart)
    )


async def logic_get_smart_alerts(session, hotel_id: str) -> str:
    today = date.today()
    alerts: List[str] = []

    # 1. Low upcoming occupancy (next 7 days)
    inv_res = await session.execute(
        select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == hotel_id)
    )
    total_inv = inv_res.scalar() or 0

    if total_inv > 0:
        next_week = today + timedelta(days=7)
        upcoming_res = await session.execute(select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            Booking.check_in < next_week,
            Booking.check_out > today
        ))
        upcoming = upcoming_res.scalars().all()

        daily_booked: Dict[str, int] = {}
        for i in range(7):
            daily_booked[(today + timedelta(days=i)).isoformat()] = 0

        for b in upcoming:
            cur = max(b.check_in, today)
            stop = min(b.check_out, today + timedelta(days=7))
            while cur < stop:
                key = cur.isoformat()
                if key in daily_booked:
                    daily_booked[key] += len(b.rooms)
                cur += timedelta(days=1)

        low_days = [d for d, cnt in daily_booked.items() if (cnt / total_inv) < 0.4]
        if low_days:
            alerts.append(
                f"🔴 **Low Occupancy Alert**: {len(low_days)} days in the next 7 have <40% occupancy. "
                f"Consider a promo or rate drop to fill rooms."
            )

        high_days = [d for d, cnt in daily_booked.items() if (cnt / total_inv) >= 0.85]
        if high_days:
            alerts.append(
                f"🟢 **High Demand Alert**: {len(high_days)} days in the next 7 have ≥85% occupancy. "
                f"Consider raising rates to maximise revenue."
            )

    # 2. Stale pending approvals (> 12 hours old)
    stale_cutoff = today - timedelta(hours=12)
    pending_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status == BookingStatus.PENDING
    ))
    pending_bookings = pending_res.scalars().all()
    if pending_bookings:
        alerts.append(
            f"⏳ **{len(pending_bookings)} Pending Booking(s)** waiting for your confirmation. "
            f"Guests are waiting — confirm or cancel now."
        )

    # 3. Unpaid confirmed bookings
    unpaid_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        Booking.paid_amount < Booking.total_amount
    ))
    unpaid = unpaid_res.scalars().all()
    if unpaid:
        total_due = sum(b.total_amount - b.paid_amount for b in unpaid)
        alerts.append(
            f"💰 **₹{round(total_due):,} in Unpaid Dues** across {len(unpaid)} booking(s). "
            f"Follow up before check-out to avoid revenue loss."
        )

    # 4. Check-ins with no payment today
    todays_arrivals_res = await session.execute(select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.check_in == today,
        Booking.status == BookingStatus.CONFIRMED,
        Booking.paid_amount == 0
    ))
    unpaid_arrivals = todays_arrivals_res.scalars().all()
    if unpaid_arrivals:
        alerts.append(
            f"🚨 **{len(unpaid_arrivals)} Guest(s) arriving TODAY with zero payment recorded.** "
            f"Collect payment at check-in."
        )

    if not alerts:
        return "✅ **All Clear!** No critical alerts right now. Hotel is running smoothly."

    return "### 🔔 Smart Alerts\n\n" + "\n\n".join(alerts)


async def logic_get_vip_guests(session, hotel_id: str, limit: int = 10) -> str:
    b_res = await session.execute(select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT])
    ))
    rows = b_res.all()

    guest_stats: Dict[str, Dict] = defaultdict(lambda: {"name": "", "email": "", "visits": 0, "total_spent": 0.0, "last_visit": None})
    for booking, guest in rows:
        gid = str(guest.id)
        guest_stats[gid]["name"] = f"{guest.first_name} {guest.last_name}".strip()
        guest_stats[gid]["email"] = guest.email or ""
        guest_stats[gid]["visits"] += 1
        guest_stats[gid]["total_spent"] += booking.total_amount
        if guest_stats[gid]["last_visit"] is None or booking.check_in > guest_stats[gid]["last_visit"]:
            guest_stats[gid]["last_visit"] = booking.check_in

    if not guest_stats:
        return "No guest history found."

    top = sorted(guest_stats.values(), key=lambda x: -x["total_spent"])[:limit]

    chart_data = [
        {"guest": g["name"] or "Unknown", "spent": round(g["total_spent"])}
        for g in top[:8]
    ]

    chart = {
        "type": "bar",
        "title": f"Top {min(limit, 8)} Guests by Total Spend",
        "data": chart_data,
        "xKey": "guest",
        "yKeys": [{"key": "spent", "label": "Total Spent (₹)", "color": "#EC4899"}]
    }

    lines = [f"### 🏆 Top {limit} VIP Guests\n"]
    for i, g in enumerate(top, 1):
        tier = "💎 VIP" if g["total_spent"] >= 50000 else ("⭐ Loyal" if g["visits"] >= 3 else "")
        lines.append(
            f"{i}. **{g['name'] or 'Unknown'}** {tier}\n"
            f"   - Spent: ₹{round(g['total_spent']):,} | Visits: {g['visits']} | "
            f"Last: {g['last_visit']}"
        )

    return "\n".join(lines) + _chart(chart)


async def logic_get_at_risk_bookings(session, hotel_id: str) -> str:
    today = date.today()
    alerts: List[str] = []

    # 1. PENDING bookings with check-in <= 3 days away
    urgent_res = await session.execute(select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == hotel_id,
        Booking.status == BookingStatus.PENDING,
        Booking.check_in <= today + timedelta(days=3)
    ))
    urgent = urgent_res.all()
    for b, g in urgent:
        days_left = (b.check_in - today).days
        label = "TODAY" if days_left == 0 else f"in {days_left} day(s)"
        alerts.append(
            f"🔴 **{g.first_name} {g.last_name}** — Check-in {label} "
            f"but booking still PENDING. Booking: `{b.booking_number}`"
        )

    # 2. CONFIRMED bookings checking in soon with zero payment
    unpaid_res = await session.execute(select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == hotel_id,
        Booking.status == BookingStatus.CONFIRMED,
        Booking.check_in <= today + timedelta(days=2),
        Booking.paid_amount == 0
    ))
    unpaid = unpaid_res.all()
    for b, g in unpaid:
        alerts.append(
            f"🟡 **{g.first_name} {g.last_name}** — Arriving {b.check_in} with "
            f"₹{round(b.total_amount):,} still unpaid. Booking: `{b.booking_number}`"
        )

    # 3. Long-pending bookings (pending > 1 day)
    old_pending_res = await session.execute(select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == hotel_id,
        Booking.status == BookingStatus.PENDING,
        Booking.check_in > today + timedelta(days=3)
    ))
    old_pending = old_pending_res.all()
    if old_pending:
        alerts.append(
            f"⏳ **{len(old_pending)} booking(s)** are PENDING without recent action "
            f"(check-in is not imminent but still needs confirmation)."
        )

    if not alerts:
        return "✅ No at-risk bookings found. All upcoming stays look healthy."

    return "### ⚠️ At-Risk Bookings\n\n" + "\n\n".join(alerts)


async def logic_get_upsell_opportunities(session, hotel_id: str) -> str:
    today = date.today()

    # Current in-house guests
    checked_in_res = await session.execute(select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == hotel_id,
        Booking.status == BookingStatus.CHECKED_IN
    ))
    checked_in = checked_in_res.all()

    # All room types sorted by price
    rt_res = await session.execute(
        select(RoomType).where(RoomType.hotel_id == hotel_id).order_by(RoomType.base_price.desc())
    )
    room_types = rt_res.scalars().all()
    rt_by_name = {rt.name.lower(): rt for rt in room_types}

    if not checked_in:
        # Check upcoming confirmed bookings (next 7 days)
        upcoming_res = await session.execute(select(Booking, Guest).join(Guest).where(
            Booking.hotel_id == hotel_id,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.check_in >= today,
            Booking.check_in <= today + timedelta(days=7)
        ))
        checked_in = upcoming_res.all()

    if not checked_in:
        return "No current guests or upcoming arrivals to upsell right now."

    opps: List[str] = []
    for b, g in checked_in:
        if not b.rooms:
            continue
        current_room_name = b.rooms[0].get("room_type_name", "").lower()
        current_price = b.rooms[0].get("price_per_night", 0)

        # Find upgrade options
        upgrades = [rt for rt in room_types if rt.base_price > current_price]
        if upgrades:
            best = upgrades[0]  # Most premium first
            premium = round(best.base_price - current_price)
            nights = (b.check_out - b.check_in).days
            opps.append(
                f"- **{g.first_name} {g.last_name}** (Booking `{b.booking_number}`)\n"
                f"  Currently in: **{b.rooms[0].get('room_type_name', 'N/A')}** @ ₹{round(current_price):,}/night\n"
                f"  Upgrade offer: **{best.name}** @ ₹{round(best.base_price):,}/night "
                f"(+₹{premium}/night = +₹{premium * nights:,} extra for {nights} night(s))"
            )

    if not opps:
        return "All current guests are already in your best available rooms — no upgrades possible."

    return (
        f"### 💡 Upsell Opportunities ({len(opps)} guest(s))\n\n"
        + "\n\n".join(opps)
        + "\n\n_Tip: Offer a 10-15% discount on the upgrade price to increase acceptance rate._"
    )
