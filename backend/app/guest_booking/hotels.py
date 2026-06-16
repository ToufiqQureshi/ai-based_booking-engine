from typing import List, Optional, Any, Dict
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks, Request
from sqlmodel import select, and_, or_
from pydantic import BaseModel, EmailStr
import uuid
import logging
import re

from app.core.db.database import get_session
from app.core.auth.deps import DbSession
from app.brand_console.hotel import Hotel, HotelRead
from app.rooms.room import RoomType, RoomTypeRead, RoomBlock
from app.bookings.booking import Booking, BookingStatus, Guest
from app.rate_plans.rates_model import RatePlan, RoomRate
from app.rate_plans.promo import PromoCode
from app.core.cache.redis_client import redis_client
import json
from app.services.email_service import get_email_service
from app.core.utils.time import utcnow
from app.core.utils.limiter import limiter

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

# Patterns that turn "custom CSS" into an exfiltration / script vector. We allow
# hoteliers to theme the widget, but strip anything that can make a network
# request, break out of the <style> tag, or invoke script. (Leading OTAs do not
# expose tenant JS at all; CSS theming is kept but neutered.)
_CSS_DANGER = re.compile(
    r"(?:</?\s*style|<\s*/?\s*script|expression\s*\(|javascript\s*:|@import|behavior\s*:|-moz-binding|url\s*\()",
    re.IGNORECASE,
)


def _sanitize_widget_css(css: Optional[str]) -> str:
    """Best-effort sanitizer for hotelier-supplied widget CSS served publicly."""
    if not css:
        return ""
    if _CSS_DANGER.search(css):
        # Remove the offending constructs rather than dropping all styling.
        css = _CSS_DANGER.sub("", css)
    # Hard cap to avoid abuse via giant payloads.
    return css[:10000]

class RateOption(BaseModel):
    id: str # rate_plan_id
    name: str # rate_plan_name (e.g. "Room Only", "Breakfast Included")
    meal_plan_code: str
    price_per_night: float
    total_price: float
    inclusions: List[str]
    is_refundable: bool = True
    cancellation_policy: Optional[str] = None
    savings_text: Optional[str] = None # e.g. "Save INR 2,000"
    is_package: bool = False
    image_url: Optional[str] = None

class PublicRoomSearchResult(RoomTypeRead):
    """
    Extended room response for public search.
    Includes calculated price and availability.
    """
    available_rooms: int
    price_starting_at: float
    rate_options: List[RateOption]


async def resolve_hotel_id(identifier: str, session: DbSession) -> str:
    # Normalize identifier (convert spaces and %20 to hyphens, lowercase)
    normalized = identifier.strip().replace("%20", "-").replace(" ", "-").lower()
    
    cache_key = f"public:slug-to-id:{normalized}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return cached
    except Exception as e:
        logger.error(f"Failed to get slug-to-id cache: {e}")

    # Query DB
    query = select(Hotel).where(or_(Hotel.slug == normalized, Hotel.id == identifier, Hotel.id == normalized))
    result = await session.execute(query)
    hotel = result.scalar_one_or_none()
    
    if hotel:
        # Cache mapping
        try:
            redis_client.set_value(f"public:slug-to-id:{hotel.slug}", hotel.id, expire=86400)
            redis_client.set_value(f"public:slug-to-id:{hotel.id}", hotel.id, expire=86400)
            if normalized != hotel.slug:
                redis_client.set_value(f"public:slug-to-id:{normalized}", hotel.id, expire=86400)
        except Exception as e:
            logger.error(f"Failed to set slug-to-id cache: {e}")
        return hotel.id
    return identifier


# --- Public Booking Schemas ---
class PublicGuestCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    nationality: str = "IN"
    id_type: str = "passport"
    id_number: str = "PENDING"

class PublicRoomBooking(BaseModel):
    room_type_id: str
    room_type_name: str
    price_per_night: float
    total_price: float
    guests: int = 1
    rate_plan_id: Optional[str] = None
    rate_plan_name: Optional[str] = None

class PublicAddOn(BaseModel):
    id: str
    name: str
    price: float

class PublicBookingCreate(BaseModel):
    check_in: date
    check_out: date
    guest: PublicGuestCreate
    rooms: List[PublicRoomBooking]
    addons: List[PublicAddOn] = []
    special_requests: Optional[str] = None
    promo_code: Optional[str] = None
    payment_method: Optional[str] = None

class PublicBookingResponse(BaseModel):
    id: str
    booking_number: str
    status: str
    check_in: date
    check_out: date
    total_amount: float
    guest: dict
    rooms: List[dict]



def generate_booking_number() -> str:
    """Unique booking number generate karta hai"""
    timestamp = utcnow().strftime("%Y%m%d")
    unique_part = str(uuid.uuid4())[:6].upper()
    return f"BK{timestamp}{unique_part}"


@router.get("/hotels/slug/{hotel_slug}")
@limiter.limit("120/minute")
async def get_public_hotel_by_slug(request: Request, hotel_slug: str, session: DbSession):
    """
    Get hotel details by slug for public booking page.
    No authentication required.

    SENSITIVE FIELDS ARE STRIPPED. The previous version of this endpoint
    returned the full settings JSON which includes the hotel's SMTP
    password, WhatsApp API key, and Brevo API key. That's a credential
    leak. We now run the same `mask_hotel_for_hotelier` filter that the
    /hotels/me endpoint uses, so the public never sees platform
    credentials.
    """
    from app.core.auth.sensitive_fields import mask_hotel_for_hotelier

    hotel_id = await resolve_hotel_id(hotel_slug, session)

    cache_key = f"public:hotel-details:{hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    if not hotel.is_active:
        raise HTTPException(status_code=404, detail="Hotel not found")

    masked = mask_hotel_for_hotelier(hotel)

    try:
        redis_client.set_value(cache_key, json.dumps(masked, default=str), expire=300)
    except Exception:
        pass

    return masked


@router.get("/hotels/slug/{hotel_slug}/widget-config", response_model=dict)
async def get_widget_config(hotel_slug: str, session: DbSession):
    """
    Get configuration for the booking widget.
    Includes allowed_domains for security check.
    """
    hotel_id = await resolve_hotel_id(hotel_slug, session)

    from app.integration.integration import IntegrationSettings
    
    # Get Hotel by ID since we resolved it
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    # Get Integration Settings for this hotel
    settings_query = select(IntegrationSettings).where(
        IntegrationSettings.hotel_id == hotel.id
    )
    settings_res = await session.execute(settings_query)
    settings = settings_res.scalar_one_or_none()
    
    allowed_domains = ""
    widget_enabled = True
    
    if settings:
        allowed_domains = settings.allowed_domains or ""
        widget_enabled = settings.widget_enabled
        
    res_dict = {
        "hotel_name": hotel.name,
        "logo_url": (getattr(settings, 'widget_logo_url', None) or hotel.logo_url) if settings else hotel.logo_url,
        "primary_color": hotel.primary_color,
        "widget_layout": getattr(settings, 'widget_layout', 'modern') if settings else "modern",
        "widget_background_color": settings.widget_background_color if settings else "#FFFFFF",
        "widget_theme": getattr(settings, 'widget_theme', 'light') if settings else "light",
        # custom CSS is sanitized before it ever reaches a guest browser;
        # custom JS is deliberately NOT exposed on this public endpoint (it would
        # be a remote-code-execution sink in every guest's widget).
        "widget_custom_css": _sanitize_widget_css(getattr(settings, 'widget_custom_css', '') if settings else ''),
        "allowed_domains": allowed_domains,
        "widget_enabled": widget_enabled,
        "min_nights": getattr(settings, 'widget_min_nights', 1) if settings else 1,
        "advance_purchase_days": getattr(settings, 'widget_advance_purchase_days', 0) if settings else 0,
        "room_type_filter": getattr(settings, 'widget_room_type_filter', None) if settings else None,
    }

    return res_dict

@router.get("/hotels/{hotel_identifier}")
@limiter.limit("120/minute")
async def get_public_hotel(request: Request, hotel_identifier: str, session: DbSession):
    """
    Get hotel details for public booking page.
    Supports both ID (UUID) and Slug.

    SENSITIVE FIELDS ARE STRIPPED — see /hotels/slug/{slug} above.
    """
    from app.core.auth.sensitive_fields import mask_hotel_for_hotelier

    hotel_id = await resolve_hotel_id(hotel_identifier, session)

    cache_key = f"public:hotel-details:{hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    if not hotel.is_active:
        raise HTTPException(status_code=404, detail="Hotel not found")

    from app.integration.integration import IntegrationSettings
    settings_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
    settings_res = await session.execute(settings_query)
    int_settings = settings_res.scalar_one_or_none()
    masked = mask_hotel_for_hotelier(hotel)
    if int_settings and getattr(int_settings, 'widget_primary_color', None):
        masked["primary_color"] = int_settings.widget_primary_color

    try:
        redis_client.set_value(cache_key, json.dumps(masked, default=str), expire=300)
    except Exception:
        pass

    return masked


@router.get("/hotels/{hotel_identifier}/seasonal-deal")
@limiter.limit("120/minute")
async def get_public_seasonal_deal(request: Request, hotel_identifier: str, session: DbSession):
    """
    Returns the active auto-apply seasonal deal for a hotel (or its chain), for
    showing a banner on the booking page. The actual discount is always
    recomputed server-side at booking time — this is display-only.
    """
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    chain_id = (await session.execute(
        select(Hotel.chain_id).where(Hotel.id == hotel_id)
    )).scalar_one_or_none()

    today = date.today()
    candidates = (await session.execute(
        select(PromoCode).where(
            PromoCode.auto_apply == True,
            PromoCode.is_active == True,
            or_(PromoCode.hotel_id == hotel_id, PromoCode.chain_id == chain_id),
        )
    )).scalars().all()

    # Best currently-valid deal by headline value (ties: percentage wins).
    best = None
    for ap in candidates:
        if (ap.start_date and ap.start_date > today) or (ap.end_date and ap.end_date < today):
            continue
        if ap.max_usage is not None and (ap.current_usage or 0) >= ap.max_usage:
            continue
        if best is None or ap.discount_value > best.discount_value:
            best = ap

    if not best:
        return {"active": False}

    return {
        "active": True,
        "name": best.name or best.description or "Special Offer",
        "discount_type": best.discount_type,
        "discount_value": best.discount_value,
        "end_date": best.end_date.isoformat() if best.end_date else None,
    }


# ── Public Chain / Multi-Property Widget ──────────────────────────────────────

@router.get("/chain/{chain_slug}")
@limiter.limit("120/minute")
async def get_public_chain(request: Request, chain_slug: str, session: DbSession):
    """
    Public endpoint — no auth required.
    Returns chain info + list of all active properties.
    Used by the ChainBookingWidget (iframe embed) to populate the property selector.
    """
    from app.superadmin.chains.chain import Chain

    cache_key = f"public:chain:{chain_slug}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # Fetch chain by slug
    chain_result = await session.execute(
        select(Chain).where(Chain.slug == chain_slug)
    )
    chain = chain_result.scalar_one_or_none()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")

    # Fetch all active hotels in this chain
    hotels_result = await session.execute(
        select(Hotel).where(
            Hotel.chain_id == chain.id,
            Hotel.is_active == True,
        )
    )
    hotels = hotels_result.scalars().all()

    properties = [
        {
            "hotel_id": h.id,
            "name": h.name,
            "slug": h.slug,
            "city": h.address.get("city") if isinstance(h.address, dict) else None,
            "logo_url": h.logo_url,
            "star_rating": getattr(h, "star_rating", None),
            "primary_color": h.primary_color or "#7C3AED",
        }
        for h in hotels
    ]

    response = {
        "id": chain.id,
        "name": chain.name,
        "slug": chain.slug,
        "logo_url": chain.logo_url,
        "primary_color": getattr(chain, "primary_color", None) or "#4f46e5",
        "properties": properties,
    }

    try:
        redis_client.set_value(cache_key, json.dumps(response, default=str), expire=300)
    except Exception:
        pass

    return response


@router.get("/chain/{chain_slug}/recommendations")
@limiter.limit("60/minute")
async def get_chain_recommendations(
    request: Request,
    chain_slug: str,
    session: DbSession,
    check_in: date = Query(...),
    check_out: date = Query(...),
    guests: int = Query(2),
    exclude_hotel_id: Optional[str] = Query(None)
):
    """
    Get alternative properties in the same chain with rooms available.
    """
    from app.superadmin.chains.chain import Chain
    
    # 1. Resolve chain
    chain_res = await session.execute(select(Chain).where(Chain.slug == chain_slug))
    chain = chain_res.scalar_one_or_none()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
        
    cache_key = f"public:recommendations:{chain.id}:{check_in}:{check_out}:{guests}:{exclude_hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # 2. Get active hotels in the chain, excluding exclude_hotel_id
    stmt = select(Hotel).where(
        Hotel.chain_id == chain.id,
        Hotel.is_active == True
    )
    if exclude_hotel_id:
        stmt = stmt.where(Hotel.id != exclude_hotel_id)
    hotels_res = await session.execute(stmt)
    hotels = hotels_res.scalars().all()
    
    recommendations = []
    
    # 3. For each hotel, check availability of room types
    for h in hotels:
        rt_stmt = select(RoomType).where(
            RoomType.hotel_id == h.id,
            RoomType.is_active == True,
            RoomType.max_occupancy >= guests
        )
        rt_res = await session.execute(rt_stmt)
        room_types = rt_res.scalars().all()
        if not room_types:
            continue
            
        bk_stmt = select(Booking).where(
            Booking.hotel_id == h.id,
            Booking.status != BookingStatus.CANCELLED,
            and_(
                Booking.check_in < check_out,
                Booking.check_out > check_in
            )
        )
        bk_res = await session.execute(bk_stmt)
        bookings = bk_res.scalars().all()
        
        bl_stmt = select(RoomBlock).where(
            RoomBlock.hotel_id == h.id,
            and_(
                RoomBlock.start_date <= check_out,
                RoomBlock.end_date >= check_in
            )
        )
        bl_res = await session.execute(bl_stmt)
        blocks = bl_res.scalars().all()
        
        hotel_min_price = None
        hotel_total_available = 0
        
        for rt in room_types:
            booked_count = sum(
                1 for b in bookings for rb in b.rooms if rb.get("room_type_id") == rt.id
            )
            blocked_count = sum(
                block.blocked_count for block in blocks if block.room_type_id == rt.id
            )
            available = rt.total_inventory - (booked_count + blocked_count)
            
            if available > 0:
                hotel_total_available += available
                price = float(rt.base_price)
                if hotel_min_price is None or price < hotel_min_price:
                    hotel_min_price = price
                    
        if hotel_total_available > 0 and hotel_min_price is not None:
            nights = max(1, (check_out - check_in).days)
            recommendations.append({
                "hotel_id": h.id,
                "name": h.name,
                "slug": h.slug,
                "city": h.address.get("city") if isinstance(h.address, dict) else None,
                "logo_url": h.logo_url,
                "star_rating": getattr(h, "star_rating", None),
                "price_starting_at": round(hotel_min_price * nights, 2),
                "available_rooms": hotel_total_available
            })
            
    try:
        redis_client.set_value(cache_key, json.dumps(recommendations), expire=60)
    except Exception:
        pass
        
    return recommendations


@router.get("/hotels/{hotel_identifier}/recommendations")
@limiter.limit("60/minute")
async def get_hotel_recommendations(
    request: Request,
    hotel_identifier: str,
    session: DbSession,
    check_in: date = Query(...),
    check_out: date = Query(...),
    guests: int = Query(2)
):
    """
    Get alternative properties in the same chain as this hotel with rooms available.
    """
    # 1. Resolve hotel ID
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    hotel = await session.get(Hotel, hotel_id)
    if not hotel or not hotel.chain_id:
        return []
        
    cache_key = f"public:recommendations:hotel:{hotel_id}:{check_in}:{check_out}:{guests}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # 2. Get active hotels in the chain, excluding this hotel
    stmt = select(Hotel).where(
        Hotel.chain_id == hotel.chain_id,
        Hotel.id != hotel_id,
        Hotel.is_active == True
    )
    hotels_res = await session.execute(stmt)
    hotels = hotels_res.scalars().all()
    
    recommendations = []
    
    # 3. For each hotel, check availability of room types
    for h in hotels:
        rt_stmt = select(RoomType).where(
            RoomType.hotel_id == h.id,
            RoomType.is_active == True,
            RoomType.max_occupancy >= guests
        )
        rt_res = await session.execute(rt_stmt)
        room_types = rt_res.scalars().all()
        if not room_types:
            continue
            
        bk_stmt = select(Booking).where(
            Booking.hotel_id == h.id,
            Booking.status != BookingStatus.CANCELLED,
            and_(
                Booking.check_in < check_out,
                Booking.check_out > check_in
            )
        )
        bk_res = await session.execute(bk_stmt)
        bookings = bk_res.scalars().all()
        
        bl_stmt = select(RoomBlock).where(
            RoomBlock.hotel_id == h.id,
            and_(
                RoomBlock.start_date <= check_out,
                RoomBlock.end_date >= check_in
            )
        )
        bl_res = await session.execute(bl_stmt)
        blocks = bl_res.scalars().all()
        
        hotel_min_price = None
        hotel_total_available = 0
        
        for rt in room_types:
            booked_count = sum(
                1 for b in bookings for rb in b.rooms if rb.get("room_type_id") == rt.id
            )
            blocked_count = sum(
                block.blocked_count for block in blocks if block.room_type_id == rt.id
            )
            available = rt.total_inventory - (booked_count + blocked_count)
            
            if available > 0:
                hotel_total_available += available
                price = float(rt.base_price)
                if hotel_min_price is None or price < hotel_min_price:
                    hotel_min_price = price
                    
        if hotel_total_available > 0 and hotel_min_price is not None:
            nights = max(1, (check_out - check_in).days)
            recommendations.append({
                "hotel_id": h.id,
                "name": h.name,
                "slug": h.slug,
                "city": h.address.get("city") if isinstance(h.address, dict) else None,
                "logo_url": h.logo_url,
                "star_rating": getattr(h, "star_rating", None),
                "price_starting_at": round(hotel_min_price * nights, 2),
                "available_rooms": hotel_total_available
            })
            
    try:
        redis_client.set_value(cache_key, json.dumps(recommendations), expire=60)
    except Exception:
        pass
        
    return recommendations



