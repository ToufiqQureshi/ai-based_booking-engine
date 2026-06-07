from typing import List, Optional, Any, Dict
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks, Request
from sqlmodel import select, and_, or_
from pydantic import BaseModel, EmailStr
import uuid
import logging

from app.core.database import get_session
from app.api.deps import DbSession
from app.models.hotel import Hotel, HotelRead
from app.models.room import RoomType, RoomTypeRead, RoomBlock
from app.models.booking import Booking, BookingStatus, Guest
from app.models.rates import RatePlan, RoomRate
from app.models.promo import PromoCode
from app.core.redis_client import redis_client
import json
from app.services.email_service import get_email_service
from app.core.time import utcnow
from app.core.limiter import limiter

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

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
    from app.core.sensitive_fields import mask_hotel_for_hotelier

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

    from app.models.integration import IntegrationSettings
    
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
        "widget_custom_css": getattr(settings, 'widget_custom_css', '') if settings else '',
        "widget_custom_js": getattr(settings, 'widget_custom_js', '') if settings else '',
        "allowed_domains": allowed_domains,
        "widget_enabled": widget_enabled
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
    from app.core.sensitive_fields import mask_hotel_for_hotelier

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

    from app.models.integration import IntegrationSettings
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


# ── Public Chain / Multi-Property Widget ──────────────────────────────────────

@router.get("/chain/{chain_slug}")
@limiter.limit("120/minute")
async def get_public_chain(request: Request, chain_slug: str, session: DbSession):
    """
    Public endpoint — no auth required.
    Returns chain info + list of all active properties.
    Used by the ChainBookingWidget (iframe embed) to populate the property selector.
    """
    from app.models.chain import Chain

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
            "city": getattr(h, "city", None),
            "logo_url": h.logo_url,
            "star_rating": getattr(h, "star_rating", None),
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
