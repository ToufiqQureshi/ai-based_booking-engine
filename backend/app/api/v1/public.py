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
    cache_key = f"public:slug-to-id:{identifier}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return cached
    except Exception as e:
        logger.error(f"Failed to get slug-to-id cache: {e}")

    # Query DB
    query = select(Hotel).where(or_(Hotel.slug == identifier, Hotel.id == identifier))
    result = await session.execute(query)
    hotel = result.scalar_one_or_none()
    
    if hotel:
        # Cache mapping
        try:
            redis_client.set_value(f"public:slug-to-id:{hotel.slug}", hotel.id, expire=86400)
            redis_client.set_value(f"public:slug-to-id:{hotel.id}", hotel.id, expire=86400)
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
    cache_key = f"public:hotel-details:{hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return HotelRead.model_validate_json(cached)
    except Exception as e:
        logger.error(f"Failed to get cached hotel details: {e}")

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    try:
        redis_client.set_value(cache_key, hotel.model_dump_json(), expire=600)
    except Exception as e:
        logger.error(f"Failed to cache hotel details: {e}")
        
    return hotel


@router.get("/hotels/slug/{hotel_slug}/widget-config", response_model=dict)
async def get_widget_config(hotel_slug: str, session: DbSession):
    """
    Get configuration for the booking widget.
    Includes allowed_domains for security check.
    """
    hotel_id = await resolve_hotel_id(hotel_slug, session)
    cache_key = f"public:widget-config:{hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Failed to get cached widget-config: {e}")

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

    try:
        redis_client.set_value(cache_key, json.dumps(res_dict), expire=600)
    except Exception as e:
        logger.error(f"Failed to cache widget-config: {e}")

    return res_dict

@router.get("/hotels/{hotel_identifier}", response_model=HotelRead)
async def get_public_hotel(hotel_identifier: str, session: DbSession):
    """
    Get hotel details for public booking page.
    Supports both ID (UUID) and Slug.
    """
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    cache_key = f"public:hotel-details:{hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return HotelRead.model_validate_json(cached)
    except Exception as e:
        logger.error(f"Failed to get cached hotel details: {e}")

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
        
    try:
        redis_client.set_value(cache_key, hotel.model_dump_json(), expire=600)
    except Exception as e:
        logger.error(f"Failed to cache hotel details: {e}")
        
    return hotel

@router.get("/hotels/{hotel_identifier}/rooms", response_model=List[PublicRoomSearchResult])
async def search_public_rooms(
    hotel_identifier: str,
    session: DbSession,
    check_in: date = Query(...),
    check_out: date = Query(...),
    guests: int = Query(2),
    adults: int = Query(1),
    children: int = Query(0),
    promo_code: Optional[str] = Query(None)
):
    """
    Search available rooms for a hotel with multiple rate plans.
    """
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    from datetime import timedelta
    def addDays(d, num):
        return d + timedelta(days=num)

    hotel_policy = hotel.settings.get("cancellation_policy") if hotel.settings else None

    cache_key = f"public:rooms:{hotel_id}:{check_in.isoformat()}:{check_out.isoformat()}:{guests}:{adults}:{children}:{promo_code or ''}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            data = json.loads(cached)
            return [PublicRoomSearchResult(**item) for item in data]
    except Exception as e:
        logger.error(f"Failed to get cached public rooms search: {e}")

    logger.debug("Searching rooms for resolved hotel ID: %s", hotel_id)

    # 1. Get all room types
    query = select(RoomType).where(
        RoomType.hotel_id == hotel_id,
        RoomType.is_active == True
    )
    result = await session.execute(query)
    room_types = result.scalars().all()
    logger.debug("Found %d room types", len(room_types))
    
    if not room_types:
        return []

    # --- FIX: Fetch Amenities real-time (Source of Truth) ---
    # The JSON column 'amenities' might be desynced.
    # We fetch links and amenities manually to ensure accuracy.
    from app.models.amenity import Amenity, RoomAmenityLink
    
    room_ids = [r.id for r in room_types]
    room_amenity_map = {}
    
    if room_ids:
        try:
            # 1. Get Links
            link_stmt = select(RoomAmenityLink).where(RoomAmenityLink.room_id.in_(room_ids))
            link_res = await session.execute(link_stmt)
            links = link_res.scalars().all()
            
            # 2. Get Amenities
            amenity_ids = {link.amenity_id for link in links}
            if amenity_ids:
                am_stmt = select(Amenity).where(Amenity.id.in_(amenity_ids))
                am_res = await session.execute(am_stmt)
                # Create dict for fast lookup
                amenities_dict = {a.id: a for a in am_res.scalars().all()}
                
                # 3. Map to rooms
                for link in links:
                    if link.amenity_id in amenities_dict:
                        a = amenities_dict[link.amenity_id]
                        if link.room_id not in room_amenity_map:
                            room_amenity_map[link.room_id] = []
                        
                        # Format as expected by frontend
                        room_amenity_map[link.room_id].append({
                            "id": a.id, 
                            "name": a.name, 
                            "icon_slug": a.icon_slug, 
                            "category": a.category,
                            "is_featured": a.is_featured
                        })
        except Exception as e:
            logger.warning(f"Error fetching amenities: {e}. Falling back to default.")
            # Continue without real-time amenities, falling back to JSON

    # 1b. Get all Rate Plans
    rp_query = select(RatePlan).where(RatePlan.hotel_id == hotel_id, RatePlan.is_active == True)
    rp_result = await session.execute(rp_query)
    rate_plans = rp_result.scalars().all()
    logger.debug("HotelID=%s - Found %d Rate Plans", hotel_id, len(rate_plans))

    # 1c. Fetch Daily Rates (Base Price Overrides)
    # rate_plan_id=None means it is a base price override
    daily_rates_query = select(RoomRate).where(
        RoomRate.hotel_id == hotel_id,
        RoomRate.rate_plan_id == None,
        and_(
            RoomRate.date_from <= check_out,
            RoomRate.date_to >= check_in
        )
    )
    daily_rates_res = await session.execute(daily_rates_query)
    daily_rates = daily_rates_res.scalars().all()
    
    # Map (room_type_id, date_str) -> price
    daily_price_map = {}
    for dr in daily_rates:
        # Expand date range
        curr = dr.date_from
        while curr <= dr.date_to:
            d_str = curr.strftime("%Y-%m-%d")
            # Store price
            daily_price_map[(dr.room_type_id, d_str)] = dr.price
            curr = addDays(curr, 1)

    # If no rate plans exist, virtual "Standard Rate" will be generated per room below

    # 2. Get overlapping bookings
    booking_query = select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status != BookingStatus.CANCELLED,
        and_(
            Booking.check_in < check_out,
            Booking.check_out > check_in
        )
    )
    booking_result = await session.execute(booking_query)
    existing_bookings = booking_result.scalars().all()

    # 3. Get overlapping blocks
    block_query = select(RoomBlock).where(
        RoomBlock.hotel_id == hotel_id,
        and_(
            RoomBlock.start_date <= check_out,
            RoomBlock.end_date >= check_in
        )
    )
    block_result = await session.execute(block_query)
    existing_blocks = block_result.scalars().all()

    # 4b. Check for Promo Code
    promo = None
    if promo_code:
        promo_query = select(PromoCode).where(
            PromoCode.hotel_id == hotel_id,
            PromoCode.code == promo_code,
            PromoCode.is_active == True
        )
        promo_res = await session.execute(promo_query)
        promo = promo_res.scalar_one_or_none()

    available_rooms_list = []
    nights = (check_out - check_in).days
    if nights < 1: nights = 1

    for rt in room_types:
        # Check Capacity
        # 1. Total guests must be within max_occupancy
        # 2. Children count must be within max_children
        if rt.max_occupancy >= guests and rt.max_children >= children:
            # Availability Logic
            booked_count = 0
            for booking in existing_bookings:
                for r_booked in booking.rooms:
                    if r_booked.get("room_type_id") == rt.id:
                        booked_count += 1
            
            blocked_count = 0
            for block in existing_blocks:
                if block.room_type_id == rt.id:
                    blocked_count += block.blocked_count
            
            total_taken = booked_count + blocked_count
            available = rt.total_inventory - total_taken

            if available > 0:
                # CALCULATE RATES
                rate_options = []
                base_price_total = float(rt.base_price) * nights

                # Logic: Use explicitly configured Rate Plans
                if rate_plans:
                    for plan in rate_plans:
                        # Check for overrides on per-room-type level
                        overrides = getattr(rt, "rate_plan_overrides", {}) or {}
                        plan_override = overrides.get(plan.id) or {} if isinstance(overrides, dict) else {}
                        
                        # Skip if this plan is explicitly disabled for this room type
                        if plan_override.get("is_active", True) is False:
                            continue
                            
                        # Override dynamic values if specified
                        is_refundable = plan_override.get("is_refundable", plan.is_refundable)
                        cancellation_hours = plan_override.get("cancellation_hours", plan.cancellation_hours)

                        # Dynamic Inclusions
                        inclusions = plan.inclusions if plan.inclusions else []
                        if not inclusions:
                            inclusions.append("Free Wi-Fi") # Fallback
                        
                        # Dynamic Cancellation Text
                        cancel_text = f"Free cancellation up to {cancellation_hours} hours before check-in" if is_refundable else "Non-refundable"

                        # use the user-defined price adjustment
                        # Default is Room Base Price + Plan Adjustment
                        # In a real system, we'd check RoomRate table first
                        
                        plan_modifier = plan.price_adjustment if plan.price_adjustment is not None else 0.0
                        
                        # Calculate Total Price (Sum of Nightly Rates)
                        # We must iterate each night to check for Daily Rate updates
                        total_plan_price = 0
                        current_date = check_in
                        
                        while current_date < check_out:
                             d_str = current_date.strftime("%Y-%m-%d")
                             
                             # 1. Base Price (Daily Override OR Static Base)
                             nightly_base = daily_price_map.get((rt.id, d_str), float(rt.base_price))
                             
                             # 2. Add Plan Markup
                             nightly_rate = nightly_base + float(plan_modifier)
                             
                             # 3. Add Extra Person Charge
                             # Priority: Fill base occupancy with adults first, then children.
                             extra_adults = max(0, adults - rt.base_occupancy)
                             remaining_base_slots = max(0, rt.base_occupancy - adults)
                             extra_children = max(0, children - remaining_base_slots)
                             
                             if extra_adults > 0:
                                 rate_adult = float(rt.extra_adult_price) if rt.extra_adult_price else float(rt.extra_person_price or 1000.0)
                                 nightly_rate += (extra_adults * rate_adult)
                                 
                             if extra_children > 0:
                                 rate_child = float(rt.extra_child_price) if rt.extra_child_price else float(rt.extra_person_price or 500.0)
                                 nightly_rate += (extra_children * rate_child)
                                 
                             total_plan_price += nightly_rate
                             current_date = addDays(current_date, 1)

                        # Average nightly price for display (optional)
                        plan_price_nightly = total_plan_price / nights

                        plan_total = total_plan_price
                        
                        # Apply Promo
                        savings_text = None
                        if promo:
                             # Dummy logic for display
                             discount = 0
                             if promo.discount_type == "percentage":
                                 discount = plan_total * (promo.discount_value / 100)
                             else:
                                 discount = promo.discount_value
                             
                             if discount > 0:
                                 savings_text = f"Save INR {int(discount)}"
                                 plan_total -= discount

                        # cancellation policy override
                        specific_policy = cancel_text if ("is_refundable" in plan_override or "cancellation_hours" in plan_override) else (getattr(rt, "cancellation_policy", None) or hotel_policy or cancel_text)

                        rate_options.append(RateOption(
                            id=plan.id,
                            name=plan.name,
                            meal_plan_code=plan.meal_plan,
                            price_per_night=plan_price_nightly,
                            total_price=plan_total,
                            inclusions=inclusions,
                            is_refundable=is_refundable,
                            cancellation_policy=specific_policy,
                            savings_text=savings_text,
                            is_package=getattr(plan, 'is_package', False),
                            image_url=getattr(plan, 'image_url', None)
                        ))
                
                else:
                    # Logic B: No Rate Plans configured — auto-generate a virtual "Standard Rate"
                    # using the room's base_price so rooms remain bookable & visible.
                    total_standard_price = 0
                    current_date = check_in
                    while current_date < check_out:
                        d_str = current_date.strftime("%Y-%m-%d")
                        nightly_base = daily_price_map.get((rt.id, d_str), float(rt.base_price))
                        # Extra person charges
                        extra_adults = max(0, adults - rt.base_occupancy)
                        remaining_base_slots = max(0, rt.base_occupancy - adults)
                        extra_children = max(0, children - remaining_base_slots)
                        if extra_adults > 0:
                            rate_adult = float(rt.extra_adult_price) if rt.extra_adult_price else float(rt.extra_person_price or 1000.0)
                            nightly_base += (extra_adults * rate_adult)
                        if extra_children > 0:
                            rate_child = float(rt.extra_child_price) if rt.extra_child_price else float(rt.extra_person_price or 500.0)
                            nightly_base += (extra_children * rate_child)
                        total_standard_price += nightly_base
                        current_date = addDays(current_date, 1)

                    standard_price_per_night = total_standard_price / nights

                    # Apply promo if any
                    savings_text = None
                    if promo:
                        discount = 0
                        if promo.discount_type == "percentage":
                            discount = total_standard_price * (promo.discount_value / 100)
                        else:
                            discount = promo.discount_value
                        if discount > 0:
                            savings_text = f"Save INR {int(discount)}"
                            total_standard_price -= discount

                    rate_options.append(RateOption(
                        id=f"virtual-standard-{rt.id}",
                        name="Standard Rate",
                        meal_plan_code="EP",
                        price_per_night=standard_price_per_night,
                        total_price=total_standard_price,
                        inclusions=["Free Wi-Fi", "Complimentary Breakfast"],
                        is_refundable=True,
                        cancellation_policy=getattr(rt, "cancellation_policy", None) or hotel_policy or "Free cancellation up to 24 hours before check-in",
                        savings_text=savings_text,
                        is_package=False
                    ))

                if not rate_options:
                    continue

                # STARTING PRICE (Lowest)
                lowest_price = min(r.total_price for r in rate_options)
                
                # Use real-time amenities if available, otherwise fall back to JSON
                # This fixes the issue where JSON column is out of sync but also supports legacy data
                real_amenities = room_amenity_map.get(rt.id)
                if not real_amenities:
                     real_amenities = rt.amenities
                
                # Construct response
                # We override amenities from model_dump
                room_dump = rt.model_dump()
                room_dump["amenities"] = real_amenities
                
                room_res = PublicRoomSearchResult(
                    **room_dump,
                    price_starting_at=lowest_price,
                    available_rooms=available,
                    rate_options=rate_options
                )
                available_rooms_list.append(room_res)

    try:
        rooms_dump = [item.model_dump(mode='json') for item in available_rooms_list]
        redis_client.set_value(cache_key, json.dumps(rooms_dump), expire=120)
    except Exception as e:
        logger.error(f"Failed to cache public rooms search: {e}")

    return available_rooms_list


from app.models.addon import AddOn

@router.get("/hotels/{hotel_identifier}/addons", response_model=List[AddOn])
async def get_public_addons(hotel_identifier: str, session: DbSession):
    """
    Get active add-ons for a hotel by slug or ID.
    """
    hotel_id = await resolve_hotel_id(hotel_identifier, session)
    cache_key = f"public:addons:{hotel_id}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            data = json.loads(cached)
            return [AddOn(**item) for item in data]
    except Exception as e:
        logger.error(f"Failed to get cached addons: {e}")

    # Validate hotel exists
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    addon_query = select(AddOn).where(AddOn.hotel_id == hotel_id, AddOn.is_active == True)
    addon_res = await session.execute(addon_query)
    addons = addon_res.scalars().all()
    
    try:
        addons_dump = [item.model_dump(mode='json') for item in addons]
        redis_client.set_value(cache_key, json.dumps(addons_dump), expire=600)
    except Exception as e:
        logger.error(f"Failed to cache addons: {e}")
        
    return addons


@router.post("/bookings", response_model=PublicBookingResponse)
async def create_public_booking(
    booking_data: PublicBookingCreate,
    session: DbSession,
    background_tasks: BackgroundTasks
):
    """
    Create a public booking without authentication.
    Used by the public booking widget/page.
    """
    try:
        # First, we need to find the hotel from the room_type_id
        if not booking_data.rooms:
            raise HTTPException(status_code=400, detail="At least one room is required")
        
        room_type_id = booking_data.rooms[0].room_type_id
        room_type = await session.get(RoomType, room_type_id)
        
        if not room_type:
            raise HTTPException(status_code=404, detail="Room type not found")
        
        hotel_id = room_type.hotel_id
        
        # Check if guest exists by email for this hotel
        guest_data = booking_data.guest
        result = await session.execute(
            select(Guest).where(
                Guest.email == guest_data.email,
                Guest.hotel_id == hotel_id
            )
        )
        guest = result.scalar_one_or_none()
        
        if not guest:
            guest = Guest(
                first_name=guest_data.first_name,
                last_name=guest_data.last_name,
                email=guest_data.email,
                phone=guest_data.phone,
                nationality=guest_data.nationality,
                id_type=guest_data.id_type,
                id_number=guest_data.id_number,
                hotel_id=hotel_id
            )
            session.add(guest)
            await session.flush()
        
        # Get Hotel Settings for Tax rules
        hotel = await session.get(Hotel, hotel_id)
        settings = hotel.settings if hotel and hotel.settings else {}
        tax_name = settings.get("tax_name", "GST")
        room_tax_rate = float(settings.get("room_tax_rate", 0.0))
        room_tax_type = settings.get("room_tax_type", "exclusive")
        room_tax_calculation_method = settings.get("room_tax_calculation_method", "flat")
        room_tax_slabs = settings.get("room_tax_slabs", [])
        addon_tax_rate = float(settings.get("addon_tax_rate", 0.0))
        addon_tax_type = settings.get("addon_tax_type", "exclusive")

        def resolve_room_rate_tax(nightly_price: float) -> float:
            if room_tax_calculation_method == "flat":
                return room_tax_rate
            for slab in room_tax_slabs:
                if float(slab.get("from", 0.0)) <= nightly_price <= float(slab.get("to", 999999.0)):
                    return float(slab.get("rate", 0.0))
            if nightly_price < 1000:
                return 0.0
            elif nightly_price < 7500:
                return 12.0
            else:
                return 18.0

        # Calculate room subtotal & room tax
        room_subtotal = 0.0
        room_tax_amount = 0.0
        for room in booking_data.rooms:
            r_rate = resolve_room_rate_tax(room.price_per_night)
            r_total = room.total_price
            if room_tax_type == "inclusive":
                r_sub = r_total / (1 + (r_rate / 100))
                r_tax = r_total - r_sub
            else:
                r_sub = r_total
                r_tax = r_total * (r_rate / 100)
            room_subtotal += r_sub
            room_tax_amount += r_tax

        # Calculate addon subtotal & addon tax
        addon_total = sum(addon.price for addon in booking_data.addons)
        if addon_tax_type == "inclusive":
            addon_subtotal = addon_total / (1 + (addon_tax_rate / 100))
            addon_tax_amount = addon_total - addon_subtotal
        else:
            addon_subtotal = addon_total
            addon_tax_amount = addon_total * (addon_tax_rate / 100)
            
        subtotal_amount = round(room_subtotal + addon_subtotal, 2)
        tax_amount = round(room_tax_amount + addon_tax_amount, 2)
        total_before_discount = subtotal_amount + tax_amount
        
        # Apply Promo Code if valid on backend
        discount_amount = 0.0
        if booking_data.promo_code:
            promo_query = select(PromoCode).where(
                PromoCode.code == booking_data.promo_code,
                PromoCode.hotel_id == hotel_id,
                PromoCode.is_active == True
            )
            promo_res = await session.execute(promo_query)
            promo = promo_res.scalar_one_or_none()
            if promo:
                if promo.discount_type == "percentage":
                    discount_amount = (total_before_discount * promo.discount_value) / 100
                else:
                    discount_amount = promo.discount_value
                discount_amount = min(discount_amount, total_before_discount)
                # Increment usage
                promo.current_usage = (promo.current_usage or 0) + 1
                session.add(promo)
                
        total_amount = round(total_before_discount - discount_amount, 2)
        discount_amount = round(discount_amount, 2)
        
        # Build tax details object
        tax_details = {
            "tax_name": tax_name,
            "room_tax_rate": room_tax_rate,
            "room_tax_type": room_tax_type,
            "room_base_amount": round(room_subtotal, 2),
            "room_tax_amount": round(room_tax_amount, 2),
            "addon_tax_rate": addon_tax_rate,
            "addon_tax_type": addon_tax_type,
            "addon_base_amount": round(addon_subtotal, 2),
            "addon_tax_amount": round(addon_tax_amount, 2)
        }
        
        # Convert rooms/addons to dict format with cancellation policy freeze
        rooms_list = []
        hotel_policy = settings.get("cancellation_policy")
        
        for room in booking_data.rooms:
            rt = await session.get(RoomType, room.room_type_id)
            cancellation_policy = rt.cancellation_policy if rt else None
            
            # Resolve rate plan cancellation settings
            is_refundable = True
            cancellation_hours = 24
            
            # Check for overrides on room type level
            plan_override = {}
            if rt and room.rate_plan_id:
                overrides = getattr(rt, "rate_plan_overrides", {}) or {}
                plan_override = overrides.get(room.rate_plan_id) or {} if isinstance(overrides, dict) else {}

            if room.rate_plan_id:
                rp = await session.get(RatePlan, room.rate_plan_id)
                if rp:
                    is_refundable = plan_override.get("is_refundable", rp.is_refundable)
                    cancellation_hours = plan_override.get("cancellation_hours", rp.cancellation_hours)
                    
            if not cancellation_policy:
                # If there are overrides, we prioritize the rate-specific policy text
                if plan_override:
                    cancellation_policy = f"Free cancellation up to {cancellation_hours} hours before check-in" if is_refundable else "Non-refundable"
                else:
                    # If room type doesn't have a specific override policy, check hotel settings
                    cancellation_policy = hotel_policy
                    if not cancellation_policy:
                        # Fallback to rate plan configuration details
                        cancellation_policy = f"Free cancellation up to {cancellation_hours} hours before check-in" if is_refundable else "Non-refundable"
            
            room_dict = room.model_dump()
            room_dict["cancellation_policy"] = cancellation_policy
            room_dict["is_refundable"] = is_refundable
            room_dict["cancellation_hours"] = cancellation_hours
            rooms_list.append(room_dict)

        addons_list = [addon.model_dump() for addon in booking_data.addons]
        
        # Create booking
        booking = Booking(
            hotel_id=hotel_id,
            guest_id=guest.id,
            booking_number=generate_booking_number(),
            check_in=booking_data.check_in,
            check_out=booking_data.check_out,
            rooms=rooms_list,
            addons=addons_list,
            special_requests=booking_data.special_requests,
            promo_code=booking_data.promo_code,
            total_amount=total_amount,
            subtotal_amount=subtotal_amount,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            tax_details=tax_details,
            status=BookingStatus.PENDING
        )
        session.add(booking)
        await session.commit()
        
        # Invalidate availability and public rooms caches
        try:
            from app.api.v1.availability import clear_availability_cache
            clear_availability_cache(hotel_id)
        except Exception as e:
            logger.error(f"Failed clearing availability cache on public booking: {e}")

        await session.refresh(booking)
        
        # Enqueue Email Notifications
        email_service = await get_email_service()
        
        # Extract multi-tenant settings
        h_settings = hotel.settings if hotel and hotel.settings else {}
        sender_email = h_settings.get("email_sender_address")
        sender_name = h_settings.get("email_sender_name")
        cc_list = h_settings.get("email_cc_list")
        signature = h_settings.get("email_signature")
        
        background_tasks.add_task(
            email_service.send_guest_booking_confirmation,
            guest_email=guest.email,
            guest_name=f"{guest.first_name} {guest.last_name}",
            booking_number=booking.booking_number,
            check_in=str(booking.check_in),
            check_out=str(booking.check_out),
            total_amount=booking.total_amount,
            sender_email=sender_email,
            sender_name=sender_name,
            signature=signature
        )
        
        # Send to hotel (can get from hotel contact or settings, fallback to global)
        hotel_emails = hotel.contact.get("email", "") if hotel and hotel.contact else ""
        background_tasks.add_task(
            email_service.send_hotel_booking_notification,
            hotel_emails=hotel_emails, 
            booking_number=booking.booking_number,
            guest_name=f"{guest.first_name} {guest.last_name}",
            check_in=str(booking.check_in),
            check_out=str(booking.check_out),
            total_amount=booking.total_amount,
            cc_list=cc_list,
            sender_email=sender_email,
            sender_name=sender_name
        )
        
        return PublicBookingResponse(
            id=booking.id,
            booking_number=booking.booking_number,
            status=booking.status.value,
            check_in=booking.check_in,
            check_out=booking.check_out,
            total_amount=booking.total_amount,
            guest={
                "first_name": guest.first_name,
                "last_name": guest.last_name,
                "email": guest.email,
                "phone": guest.phone
            },
            rooms=booking.rooms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Public booking error")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Booking failed: {str(e)}")


# --- Guest AI Chat ---
from langchain_core.messages import HumanMessage, AIMessage

class GuestChatRequest(BaseModel):
    hotel_slug: str
    message: str
    history: List[Dict[str, str]] = [] # [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}]

class GuestChatResponse(BaseModel):
    response: str

@router.post("/chat/guest", response_model=GuestChatResponse)
async def chat_with_guest_ai(
    request: GuestChatRequest,
    session: DbSession
):
    """
    Chat endpoint for hotel guests.
    Uses LLM with tools to answer guest questions.
    """
    try:
        import uuid
        is_uuid = False
        try:
            uuid.UUID(request.hotel_slug)
            is_uuid = True
        except ValueError:
            pass
            
        if is_uuid:
            query = select(Hotel).where(or_(Hotel.slug == request.hotel_slug, Hotel.id == request.hotel_slug))
        else:
            query = select(Hotel).where(Hotel.slug == request.hotel_slug)
            
        result = await session.execute(query)
        hotel = result.scalar_one_or_none()
        
        if not hotel:
            # Fallback: Check if it's a valid ID but passed as slug
            # (This logic is now covered by the OR condition above)
            raise HTTPException(status_code=404, detail="Hotel not found")

        # Enforce SaaS feature flag guard
        if not getattr(hotel, "feature_guest_bot", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest chatbot feature is not enabled for this hotel"
            )

        # Fetch integration settings for dynamic AI provider/keys
        from app.models.integration import IntegrationSettings
        int_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
        int_res = await session.execute(int_query)
        integration_settings = int_res.scalar_one_or_none()

        # 2. Prepare History
        messages = []
        for msg in request.history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        
        # Add current message
        messages.append(HumanMessage(content=request.message))

        # 3. Initialize Agent
        from app.core.guest_agent import create_guest_agent_graph
        agent = create_guest_agent_graph(
            session, 
            hotel.id, 
            getattr(integration_settings, 'ai_provider', None) if integration_settings else getattr(hotel, 'ai_provider', None), 
            getattr(integration_settings, 'ai_api_key', None) if integration_settings else getattr(hotel, 'ai_api_key', None),
            getattr(integration_settings, 'ai_model', None) if integration_settings else None,
            getattr(integration_settings, 'ai_base_url', None) if integration_settings else None,
            hotel.name
        )
        if not agent:
            return GuestChatResponse(response="AI Concierge is currently offline for this hotel. Please contact the front desk directly.")

        # 4. Invoke Agent
        # LangGraph inputs: {"messages": [...]}
        response = await agent.ainvoke({"messages": messages})
        
        # Extract last message content
        ai_msg = response["messages"][-1]
        
        return GuestChatResponse(response=ai_msg.content)
            
    except Exception as e:
        import traceback
        logger.error(f"Guest AI Error: {traceback.format_exc()}")
        return GuestChatResponse(response=f"I'm having trouble connecting. Please try again or reach out directly!")


# --- Loyalty & Personalization ---

class LoyaltyCheckRequest(BaseModel):
    email: str
    hotel_id: str

class LoyaltyCheckResponse(BaseModel):
    is_repeat_guest: bool
    message: str
    coupon_code: Optional[str] = None
    discount_text: Optional[str] = None

@router.post("/loyalty-check", response_model=LoyaltyCheckResponse)
async def check_guest_loyalty(
    data: LoyaltyCheckRequest,
    session: DbSession
):
    """
    Checks if the guest has booked at this hotel before.
    If yes, returns a special AI-powered loyalty discount.
    """
    try:
        # 1. Check if guest exists for this hotel
        guest_query = select(Guest).where(
            Guest.email == data.email,
            Guest.hotel_id == data.hotel_id
        )
        result = await session.execute(guest_query)
        guest = result.scalar_one_or_none()
        
        if not guest:
            return LoyaltyCheckResponse(
                is_repeat_guest=False,
                message="Welcome! We're excited to have you here."
            )
        
        # 2. Check booking count (confirmed or checked out)
        booking_query = select(Booking).where(
            Booking.guest_id == guest.id,
            or_(Booking.status == BookingStatus.CONFIRMED, Booking.status == BookingStatus.CHECKED_OUT)
        )
        b_result = await session.execute(booking_query)
        bookings = b_result.scalars().all()
        
        if len(bookings) == 0:
             return LoyaltyCheckResponse(
                is_repeat_guest=False,
                message="Welcome back! We hope to see you stay with us soon."
            )

        # 3. Repeat guest found!
        # Try to find a 'LOYALTY' promo or use a default one
        promo_query = select(PromoCode).where(
            PromoCode.hotel_id == data.hotel_id,
            PromoCode.code.like("%LOYALTY%"),
            PromoCode.is_active == True
        )
        p_result = await session.execute(promo_query)
        promo = p_result.scalar_one_or_none()
        
        # Default loyalty info if no specific promo found
        coupon_code = promo.code if promo else "LOYALTY10"
        discount_text = "10% Loyalty Discount"
        
        if promo:
            if promo.discount_type == "percentage":
                discount_text = f"{int(promo.discount_value)}% Loyalty Discount"
            else:
                discount_text = f"₹{int(promo.discount_value)} Loyalty Reward"

        return LoyaltyCheckResponse(
            is_repeat_guest=True,
            message=f"Welcome back, {guest.first_name}! Our AI system recognized your previous stay. As a valued guest, we've unlocked a special loyalty discount for you.",
            coupon_code=coupon_code,
            discount_text=discount_text
        )
    except Exception as e:
        logger.error(f"Loyalty check error: {str(e)}")
        return LoyaltyCheckResponse(
            is_repeat_guest=False,
            message="Welcome! Enjoy your booking experience."
        )


class GuestCancelRequest(BaseModel):
    booking_number: str
    email: str

class GuestCancelInfoResponse(BaseModel):
    booking_number: str
    guest_name: str
    check_in: date
    check_out: date
    rooms: List[dict]
    total_amount: float
    paid_amount: float
    cancellation_policy: str
    is_refundable: bool
    cancellation_hours: int
    potential_fee: float
    potential_refund: float
    refund_status: str
    status: str
    cancellation_mode: str

@router.post("/bookings/cancel-request", response_model=GuestCancelInfoResponse)
async def public_cancel_request(data: GuestCancelRequest, session: DbSession):
    """
    Look up booking and calculate cancellation fee details.
    """
    query = select(Booking).where(Booking.booking_number == data.booking_number)
    res = await session.execute(query)
    booking = res.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking is already cancelled")
        
    if booking.status == BookingStatus.CANCEL_REQUESTED:
        raise HTTPException(status_code=400, detail="Cancellation request is already pending approval")
        
    guest = await session.get(Guest, booking.guest_id)
    if not guest or guest.email.lower().strip() != data.email.lower().strip():
        raise HTTPException(status_code=403, detail="Invalid guest email verification")
        
    from app.core.cancellation import calculate_cancellation_fee
    fee, refund, ref_status = calculate_cancellation_fee(booking)
    
    room = booking.rooms[0] if booking.rooms else {}
    cancellation_policy = room.get("cancellation_policy", "Standard policy applies.")
    is_refundable = room.get("is_refundable", True)
    cancellation_hours = room.get("cancellation_hours", 24)
    
    hotel = await session.get(Hotel, booking.hotel_id)
    cancellation_mode = hotel.settings.get("cancellation_mode", "instant") if hotel and hotel.settings else "instant"
    
    return GuestCancelInfoResponse(
        booking_number=booking.booking_number,
        guest_name=f"{guest.first_name} {guest.last_name}",
        check_in=booking.check_in,
        check_out=booking.check_out,
        rooms=booking.rooms,
        total_amount=booking.total_amount,
        paid_amount=booking.paid_amount,
        cancellation_policy=cancellation_policy,
        is_refundable=is_refundable,
        cancellation_hours=cancellation_hours,
        potential_fee=fee,
        potential_refund=refund,
        refund_status=ref_status,
        status=booking.status.value,
        cancellation_mode=cancellation_mode
    )

@router.post("/bookings/cancel-confirm")
async def public_cancel_confirm(data: GuestCancelRequest, session: DbSession):
    """
    Confirm booking cancellation or request it, based on hotel settings.
    """
    query = select(Booking).where(Booking.booking_number == data.booking_number)
    res = await session.execute(query)
    booking = res.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking.status == BookingStatus.CANCELLED:
        return {"status": "already_cancelled", "message": "Booking is already cancelled"}
        
    if booking.status == BookingStatus.CANCEL_REQUESTED:
        return {"status": "already_requested", "message": "Cancellation request is already pending approval"}
        
    guest = await session.get(Guest, booking.guest_id)
    if not guest or guest.email.lower().strip() != data.email.lower().strip():
        raise HTTPException(status_code=403, detail="Invalid guest email verification")
        
    from app.core.cancellation import calculate_cancellation_fee
    fee, refund, ref_status = calculate_cancellation_fee(booking)
    
    hotel = await session.get(Hotel, booking.hotel_id)
    cancellation_mode = hotel.settings.get("cancellation_mode", "instant") if hotel and hotel.settings else "instant"
    
    if cancellation_mode == "request":
        booking.status = BookingStatus.CANCEL_REQUESTED
        booking.cancellation_fee = fee
        booking.refund_amount = refund
        booking.refund_status = ref_status
        booking.updated_at = datetime.utcnow()
        session.add(booking)
        await session.commit()
        return {
            "status": "cancel_requested",
            "booking_number": booking.booking_number,
            "cancellation_fee": fee,
            "refund_amount": refund,
            "refund_status": ref_status,
            "message": "Your cancellation request has been successfully submitted for approval."
        }
    
    booking.status = BookingStatus.CANCELLED
    booking.cancellation_fee = fee
    booking.refund_amount = refund
    booking.refund_status = ref_status
    booking.updated_at = datetime.utcnow()
    
    session.add(booking)
    await session.commit()
    
    try:
        from app.api.v1.availability import clear_availability_cache
        clear_availability_cache(booking.hotel_id)
    except Exception as e:
        logger.error(f"Failed clearing availability cache on guest cancellation: {e}")
        
    return {
        "status": "cancelled",
        "booking_number": booking.booking_number,
        "cancellation_fee": fee,
        "refund_amount": refund,
        "refund_status": ref_status,
        "message": "Your booking has been successfully cancelled."
    }

# --- Razorpay Integration ---
import razorpay
from app.core.config import get_settings

class RazorpayOrderRequest(BaseModel):
    amount: float
    currency: str = "INR"
    receipt: str

@router.post("/razorpay/create-order")
async def create_razorpay_order(data: RazorpayOrderRequest):
    """
    Creates a Razorpay order and returns the order details.
    Amount should be in INR (not paise, we convert it here).
    """
    settings = get_settings()
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured on the server")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    try:
        # Razorpay expects amount in smallest currency unit (paise for INR)
        amount_in_paise = int(data.amount * 100)
        
        order_data = {
            "amount": amount_in_paise,
            "currency": data.currency,
            "receipt": data.receipt,
            "payment_capture": 1 # Auto capture
        }
        
        order = client.order.create(data=order_data)
        return order
    except Exception as e:
        logger.error(f"Failed to create razorpay order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    booking_id: str

@router.post("/razorpay/verify")
async def verify_razorpay_payment(data: RazorpayVerifyRequest, session: DbSession):
    """
    Verifies the Razorpay signature and updates the booking status to CONFIRMED.
    """
    settings = get_settings()
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured on the server")
        
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    
    try:
        # Verify Signature
        client.utility.verify_payment_signature({
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        })
        
        # If verification is successful, update booking status
        booking = await session.get(Booking, data.booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
            
        booking.status = BookingStatus.CONFIRMED
        booking.paid_amount = booking.total_amount # Assuming full payment was made online
        booking.updated_at = datetime.utcnow()
        
        # Record the payment in DB if payment model exists
        from app.models.payment import Payment
        payment = Payment(
            hotel_id=booking.hotel_id,
            booking_id=booking.id,
            amount=booking.total_amount,
            payment_method="razorpay",
            transaction_id=data.razorpay_payment_id,
            status="completed",
            reference_number=data.razorpay_order_id
        )
        session.add(payment)
        
        session.add(booking)
        await session.commit()
        
        return {"status": "success", "message": "Payment verified and booking confirmed"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during verification")

