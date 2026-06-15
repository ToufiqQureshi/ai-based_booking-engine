import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select, and_, func, or_

from app.core.deps import CurrentUser, DbSession
from app.brand_console.hotel import Hotel
from app.bookings.booking import Booking, BookingStatus, Guest
from app.rooms.room import RoomType
from app.guests.user import User
from app.superadmin.chains.chain import Chain

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chain", tags=["Chain Management"])


async def get_chain_admin(current_user: CurrentUser, session: DbSession) -> User:
    """Verifies the user belongs to an active chain."""
    if not current_user.chain_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to brand/chain administrators only",
        )
    chain = await session.get(Chain, current_user.chain_id)
    if not chain or not getattr(chain, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chain not found or inactive",
        )
    return current_user


# ── Chain Info ─────────────────────────────────────────────────────────────────

@router.get("/info", response_model=Dict[str, Any])
async def get_chain_info(
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """
    Returns basic chain metadata (slug + name) for the authenticated user.
    Used by the Integration page to generate the chain widget embed code.
    """
    chain = await session.get(Chain, current_user.chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    return {
        "id": chain.id,
        "slug": chain.slug,
        "name": chain.name,
        "logo_url": chain.logo_url,
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_date_range(period: str) -> tuple[date, date, date, date]:
    """
    Returns (start, end, prev_start, prev_end) for the requested period.
    Periods: 7d, 30d, 90d, 365d, all
    """
    today = date.today()
    if period == "7d":
        days = 7
    elif period == "30d":
        days = 30
    elif period == "90d":
        days = 90
    elif period == "365d":
        days = 365
    else:  # all
        return (date(2000, 1, 1), today, date(2000, 1, 1), date(2000, 1, 1))

    start = today - timedelta(days=days)
    prev_end = start
    prev_start = start - timedelta(days=days)
    return (start, today, prev_start, prev_end)


def _pct_change(curr: float, prev: float) -> float:
    if prev == 0:
        return 100.0 if curr > 0 else 0.0
    return round(((curr - prev) / prev) * 100, 1)


# ── Analytics ──────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=Dict[str, Any])
async def get_chain_analytics(
    session: DbSession,
    period: str = Query("30d", description="Date range: 7d, 30d, 90d, 365d, all"),
    current_user: User = Depends(get_chain_admin),
):
    """Consolidated brand/chain analytics with real occupancy and period comparison."""
    chain_id = current_user.chain_id
    start, end, prev_start, prev_end = _resolve_date_range(period)

    # 1. Hotels in chain
    hotels = (await session.execute(
        select(Hotel).where(Hotel.chain_id == chain_id, Hotel.is_active == True)
    )).scalars().all()

    if not hotels:
        return {
            "period": period,
            "total_properties": 0,
            "total_revenue": 0.0,
            "average_occupancy": 0.0,
            "total_bookings": 0,
            "total_guests": 0,
            "revenue_change_pct": 0,
            "bookings_change_pct": 0,
            "revenue_by_hotel": [],
            "recent_bookings": [],
            "top_performer": None,
            "needs_attention": None,
        }

    hotel_ids = [h.id for h in hotels]

    # 2. Total room inventory per hotel (real occupancy basis)
    room_inv = await session.execute(
        select(RoomType.hotel_id, func.sum(RoomType.total_inventory))
        .where(RoomType.hotel_id.in_(hotel_ids))
        .group_by(RoomType.hotel_id)
    )
    inventory_map = {row[0]: int(row[1] or 0) for row in room_inv.all()}

    # 3. Aggregate metrics for current period — use SQL aggregates, not full row load
    agg_where = [
        Booking.hotel_id.in_(hotel_ids),
        Booking.status != BookingStatus.CANCELLED,
    ]
    if period != "all":
        agg_where += [Booking.check_in >= start, Booking.check_in <= end]

    agg_res = await session.execute(
        select(
            func.coalesce(func.sum(Booking.total_amount), 0).label("total_revenue"),
            func.count(Booking.id).label("total_bookings"),
            func.count(func.distinct(Booking.guest_id)).label("total_guests"),
        ).where(and_(*agg_where))
    )
    agg_row = agg_res.one()
    total_revenue = float(agg_row.total_revenue)
    total_bookings = int(agg_row.total_bookings)
    total_guests = int(agg_row.total_guests)

    # Previous period aggregates for % change
    prev_revenue = 0.0
    prev_bookings_count = 0
    if period != "all":
        prev_agg = await session.execute(
            select(
                func.coalesce(func.sum(Booking.total_amount), 0).label("rev"),
                func.count(Booking.id).label("cnt"),
            ).where(
                Booking.hotel_id.in_(hotel_ids),
                Booking.status != BookingStatus.CANCELLED,
                Booking.check_in >= prev_start,
                Booking.check_in <= prev_end,
            )
        )
        pr = prev_agg.one()
        prev_revenue = float(pr.rev)
        prev_bookings_count = int(pr.cnt)

    # Load bookings per hotel for occupancy calculation — capped at 5000 rows
    booking_query = (
        select(Booking)
        .where(and_(*agg_where))
        .limit(5000)
    )
    bookings = (await session.execute(booking_query)).scalars().all()

    # Period length for occupancy denominator
    days_in_period = (end - start).days if period != "all" else 365

    # 6. Per-hotel breakdown with REAL occupancy
    revenue_by_hotel = []
    for h in hotels:
        h_bookings = [b for b in bookings if b.hotel_id == h.id]
        h_revenue = sum(b.total_amount or 0 for b in h_bookings)
        h_bookings_count = len(h_bookings)

        # Real occupancy = (nights sold / (total_rooms * period_days)) * 100
        room_nights_sold = 0
        for b in h_bookings:
            try:
                nights = (b.check_out - b.check_in).days
                rooms_in_booking = len(b.rooms) if b.rooms else 1
                room_nights_sold += nights * rooms_in_booking
            except Exception:
                continue

        total_inv = inventory_map.get(h.id, 0)
        available_room_nights = total_inv * days_in_period if total_inv > 0 else 1
        occupancy = round(min(100.0, (room_nights_sold / available_room_nights) * 100), 1) if available_room_nights > 0 else 0

        # ADR = revenue / room nights sold
        adr = round(h_revenue / room_nights_sold, 0) if room_nights_sold > 0 else 0

        revenue_by_hotel.append({
            "hotel_id": h.id,
            "name": h.name,
            "slug": h.slug,
            "logo_url": h.logo_url,
            "revenue": h_revenue,
            "bookings_count": h_bookings_count,
            "occupancy_rate": occupancy,
            "adr": adr,
            "total_rooms": total_inv,
            "room_nights_sold": room_nights_sold,
        })

    revenue_by_hotel.sort(key=lambda x: x["revenue"], reverse=True)

    avg_occupancy = round(
        sum(item["occupancy_rate"] for item in revenue_by_hotel) / len(revenue_by_hotel), 1
    ) if revenue_by_hotel else 0

    # 7. Top performer & needs-attention
    top_performer = revenue_by_hotel[0] if revenue_by_hotel else None
    needs_attention = None
    if len(revenue_by_hotel) > 1:
        # Lowest occupancy hotel
        needs_attention = min(revenue_by_hotel, key=lambda x: x["occupancy_rate"])

    # 8. Recent bookings — bulk-fetch guests in 1 query (fixes N+1)
    sorted_bookings = sorted(bookings, key=lambda x: x.created_at or datetime.utcnow(), reverse=True)[:10]
    recent_guest_ids = list({b.guest_id for b in sorted_bookings if b.guest_id})
    guest_map: Dict[str, Guest] = {}
    if recent_guest_ids:
        gres = await session.execute(select(Guest).where(Guest.id.in_(recent_guest_ids)))
        guest_map = {g.id: g for g in gres.scalars().all()}
    hotel_map = {h.id: h for h in hotels}

    recent_bookings = []
    for b in sorted_bookings:
        h = hotel_map.get(b.hotel_id)
        g = guest_map.get(b.guest_id or "")
        guest_name = f"{g.first_name} {g.last_name}".strip() if g else "Guest"
        recent_bookings.append({
            "id": b.id,
            "hotel_name": h.name if h else "Unknown Hotel",
            "hotel_id": b.hotel_id,
            "guest_name": guest_name,
            "check_in": b.check_in.isoformat() if hasattr(b.check_in, "isoformat") else str(b.check_in),
            "check_out": b.check_out.isoformat() if hasattr(b.check_out, "isoformat") else str(b.check_out),
            "total_amount": b.total_amount or 0.0,
            "status": b.status,
        })

    return {
        "period": period,
        "total_properties": len(hotels),
        "total_revenue": total_revenue,
        "average_occupancy": avg_occupancy,
        "total_bookings": total_bookings,
        "total_guests": total_guests,
        "revenue_change_pct": _pct_change(total_revenue, prev_revenue) if period != "all" else 0,
        "bookings_change_pct": _pct_change(total_bookings, prev_bookings_count) if period != "all" else 0,
        "revenue_by_hotel": revenue_by_hotel,
        "recent_bookings": recent_bookings,
        "top_performer": top_performer,
        "needs_attention": needs_attention,
    }


# ── Chain-Wide Guest Insights ──────────────────────────────────────────────────

@router.get("/guests", response_model=Dict[str, Any])
async def get_chain_guests(
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Returns chain-wide guest insights: total guests, repeat guests (stayed at multiple
    properties), top guests by spend, and cross-property booking patterns.
    """
    chain_id = current_user.chain_id

    hotels = (await session.execute(
        select(Hotel.id).where(Hotel.chain_id == chain_id, Hotel.is_active == True)
    )).scalars().all()

    if not hotels:
        return {"total_guests": 0, "cross_property_guests": 0, "top_guests": []}

    bookings = (await session.execute(
        select(Booking).where(
            Booking.hotel_id.in_(hotels),
            Booking.status != BookingStatus.CANCELLED,
        ).limit(5000)
    )).scalars().all()

    # Aggregate per guest_id
    guest_stats: Dict[str, Dict[str, Any]] = {}
    for b in bookings:
        if not b.guest_id:
            continue
        s = guest_stats.setdefault(b.guest_id, {
            "guest_id": b.guest_id,
            "total_bookings": 0,
            "total_spend": 0.0,
            "hotels_visited": set(),
            "last_booking": None,
        })
        s["total_bookings"] += 1
        s["total_spend"] += b.total_amount or 0
        s["hotels_visited"].add(b.hotel_id)
        if not s["last_booking"] or (b.created_at and b.created_at > s["last_booking"]):
            s["last_booking"] = b.created_at

    # Sort all guests by spend descending, then paginate
    sorted_guests = sorted(guest_stats.values(), key=lambda x: x["total_spend"], reverse=True)
    total_guest_count = len(sorted_guests)
    page_guests = sorted_guests[offset: offset + limit]

    # Enrich page guests with names — single bulk query (fixes N+1)
    page_ids = [g["guest_id"] for g in page_guests]
    gmap = {}
    if page_ids:
        gres = await session.execute(select(Guest).where(Guest.id.in_(page_ids)))
        gmap = {gu.id: gu for gu in gres.scalars().all()}

    for g in page_guests:
        guest = gmap.get(g["guest_id"])
        g["name"] = f"{guest.first_name} {guest.last_name}".strip() if guest else "Unknown"
        g["hotels_count"] = len(g["hotels_visited"])
        g["hotels_visited"] = list(g["hotels_visited"])
        g["last_booking"] = g["last_booking"].isoformat() if g["last_booking"] else None

    cross_property = sum(1 for g in guest_stats.values() if len(g["hotels_visited"]) > 1)

    return {
        "total_guests": total_guest_count,
        "cross_property_guests": cross_property,
        "cross_property_pct": round((cross_property / total_guest_count * 100), 1) if total_guest_count else 0,
        "top_guests": page_guests,
        "limit": limit,
        "offset": offset,
        "has_more": (offset + limit) < total_guest_count,
    }


# ── Chain-Wide Promos & Loyalty ───────────────────────────────────────────────
from pydantic import BaseModel
import uuid as _uuid
from app.rate_plans.promo import PromoCode
from app.loyalty.loyalty_model import LoyaltyProgram, LoyaltyOffer

class ChainPromoCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_type: str = "percentage"
    discount_value: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_usage: Optional[int] = None

class ChainLoyaltyUpdate(BaseModel):
    is_active: Optional[bool] = None
    program_name: Optional[str] = None
    description: Optional[str] = None
    milestone_bookings: Optional[int] = None
    reward_type: Optional[str] = None
    reward_value: Optional[float] = None
    reward_description: Optional[str] = None
    popup_title: Optional[str] = None
    popup_message: Optional[str] = None

@router.get("/promos", response_model=List[PromoCode])
async def list_chain_promos(
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """List all promo codes for the chain group."""
    query = select(PromoCode).where(PromoCode.chain_id == current_user.chain_id)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/promos", response_model=PromoCode)
async def create_chain_promo(
    payload: ChainPromoCreate,
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """Create a new chain-wide promo code."""
    existing = await session.execute(
        select(PromoCode).where(
            PromoCode.code == payload.code,
            PromoCode.chain_id == current_user.chain_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Promo code already exists in this chain")

    promo = PromoCode(
        chain_id=current_user.chain_id,
        hotel_id=None,
        code=payload.code,
        description=payload.description,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        start_date=payload.start_date,
        end_date=payload.end_date,
        max_usage=payload.max_usage,
        is_active=True
    )
    session.add(promo)
    await session.commit()
    await session.refresh(promo)
    return promo

@router.delete("/promos/{promo_id}")
async def delete_chain_promo(
    promo_id: str,
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """Delete a chain-level promo code."""
    promo = await session.get(PromoCode, promo_id)
    if not promo or promo.chain_id != current_user.chain_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    await session.delete(promo)
    await session.commit()
    return {"ok": True}

@router.get("/loyalty", response_model=LoyaltyProgram)
async def get_chain_loyalty(
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """Get or auto-create the chain's loyalty program settings."""
    result = await session.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.chain_id == current_user.chain_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        program = LoyaltyProgram(chain_id=current_user.chain_id, hotel_id=None)
        session.add(program)
        await session.commit()
        await session.refresh(program)
    return program

@router.put("/loyalty", response_model=LoyaltyProgram)
async def update_chain_loyalty(
    payload: ChainLoyaltyUpdate,
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """Update chain loyalty program parameters."""
    result = await session.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.chain_id == current_user.chain_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        program = LoyaltyProgram(chain_id=current_user.chain_id, hotel_id=None)
        session.add(program)

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(program, field, val)
    program.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(program)
    return program


# ── Chain-Wide Upsell Broadcast ────────────────────────────────────────────────
# A chain admin composes one stay-upsell offer and "broadcasts" it to every
# property in the chain. We materialise one LoyaltyOffer per hotel (sharing a
# broadcast_id) so the existing per-hotel guest booking flow picks them up with
# zero changes, while the brand console can manage the broadcast as one unit.

_VALID_REWARD_TYPES = {"percentage", "fixed_amount", "free_night"}


class ChainUpsellBroadcastCreate(BaseModel):
    title: str = "Stay Longer, Save More"
    min_nights: int = 5
    reward_type: str = "percentage"          # percentage | fixed_amount | free_night
    reward_value: float = 10.0
    nudge_from_nights: int = 1
    nudge_title: str = "Stay a little longer!"
    nudge_message: str = "Stay {remaining} more night(s) and unlock {reward}!"
    is_active: bool = True


@router.get("/upsell", response_model=List[Dict[str, Any]])
async def list_chain_upsell_broadcasts(
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """
    List the chain's upsell broadcasts, grouped by broadcast_id. Each entry
    reports how many properties currently carry the offer.
    """
    result = await session.execute(
        select(LoyaltyOffer)
        .where(
            LoyaltyOffer.chain_id == current_user.chain_id,
            LoyaltyOffer.broadcast_id.is_not(None),
        )
        .order_by(LoyaltyOffer.created_at.desc())
    )
    offers = result.scalars().all()

    grouped: Dict[str, Dict[str, Any]] = {}
    for o in offers:
        g = grouped.get(o.broadcast_id)
        if not g:
            grouped[o.broadcast_id] = {
                "broadcast_id": o.broadcast_id,
                "title": o.title,
                "min_nights": o.min_nights,
                "reward_type": o.reward_type,
                "reward_value": o.reward_value,
                "nudge_from_nights": o.nudge_from_nights,
                "nudge_title": o.nudge_title,
                "nudge_message": o.nudge_message,
                "is_active": o.is_active,
                "property_count": 1,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
        else:
            g["property_count"] += 1
            # A broadcast is "active" if any property copy is active
            g["is_active"] = g["is_active"] or o.is_active

    # Preserve newest-first ordering
    return sorted(grouped.values(), key=lambda x: x["created_at"] or "", reverse=True)


@router.post("/upsell/broadcast", response_model=Dict[str, Any])
async def broadcast_chain_upsell(
    payload: ChainUpsellBroadcastCreate,
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """Create one stay-upsell offer and push a copy to every active property."""
    if payload.reward_type not in _VALID_REWARD_TYPES:
        raise HTTPException(status_code=400, detail="Invalid reward_type")
    if payload.min_nights < 1:
        raise HTTPException(status_code=400, detail="min_nights must be at least 1")
    if payload.nudge_from_nights < 1:
        raise HTTPException(status_code=400, detail="nudge_from_nights must be at least 1")
    if payload.nudge_from_nights >= payload.min_nights:
        raise HTTPException(
            status_code=400,
            detail="nudge_from_nights must be less than min_nights",
        )

    hotels = (await session.execute(
        select(Hotel.id).where(
            Hotel.chain_id == current_user.chain_id,
            Hotel.is_active == True,
        )
    )).scalars().all()
    if not hotels:
        raise HTTPException(status_code=400, detail="No active properties in this chain")

    broadcast_id = str(_uuid.uuid4())
    for hid in hotels:
        session.add(LoyaltyOffer(
            hotel_id=hid,
            chain_id=current_user.chain_id,
            broadcast_id=broadcast_id,
            room_type_id=None,           # chain broadcasts apply to all rooms
            is_active=payload.is_active,
            title=payload.title,
            min_nights=payload.min_nights,
            reward_type=payload.reward_type,
            reward_value=payload.reward_value,
            nudge_from_nights=payload.nudge_from_nights,
            nudge_title=payload.nudge_title,
            nudge_message=payload.nudge_message,
        ))
    await session.commit()
    return {"broadcast_id": broadcast_id, "property_count": len(hotels)}


@router.delete("/upsell/{broadcast_id}")
async def delete_chain_upsell_broadcast(
    broadcast_id: str,
    session: DbSession,
    current_user: User = Depends(get_chain_admin),
):
    """Delete a broadcast across all properties. IDOR-guarded by chain_id."""
    result = await session.execute(
        select(LoyaltyOffer).where(
            LoyaltyOffer.broadcast_id == broadcast_id,
            LoyaltyOffer.chain_id == current_user.chain_id,
        )
    )
    offers = result.scalars().all()
    if not offers:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    for o in offers:
        await session.delete(o)
    await session.commit()
    return {"ok": True, "deleted": len(offers)}


