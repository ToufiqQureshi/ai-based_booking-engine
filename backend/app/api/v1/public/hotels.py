from typing import List, Optional, Any, Dict
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks
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
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    unique_part = str(uuid.uuid4())[:6].upper()
    return f"BK{timestamp}{unique_part}"


@router.get("/hotels/slug/{hotel_slug}", response_model=HotelRead)
async def get_public_hotel_by_slug(hotel_slug: str, session: DbSession):
    """
    Get hotel details by slug for public booking page.
    No authentication required.
    """
    hotel_id = await resolve_hotel_id(hotel_slug, session)
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    return hotel


@router.get("/hotels/slug/{hotel_slug}/widget-config", response_model=dict)
async def get_widget_config(hotel_slug: str, session: DbSession):
    """
    Get configuration for the booking widget.
    Includes allowed_domains for security check.
    """
    hotel_id = await resolve_hotel_id(hotel_slug, session)
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

@router.get("/hotels/{hotel_identifier}", response_model=HotelRead)
async def get_public_hotel(hotel_identifier: str, session: DbSession):
    """
    Get hotel details for public booking page.
    Supports both ID (UUID) and Slug.
    """
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    # Get Hotel by ID since we resolved it
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    from app.models.integration import IntegrationSettings
    settings_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
    settings_res = await session.execute(settings_query)
    settings = settings_res.scalar_one_or_none()
    if settings and getattr(settings, 'widget_primary_color', None):
        hotel.primary_color = settings.widget_primary_color
        
        
    return hotel

