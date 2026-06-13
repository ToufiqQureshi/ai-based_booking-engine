from typing import List, Optional, Any, Dict
from datetime import date, datetime, timedelta
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks, Request
from sqlmodel import select, and_, or_
from pydantic import BaseModel, EmailStr
import uuid
import logging
from collections import defaultdict

from app.core.database import get_session
from app.api.deps import DbSession
from app.models.hotel import Hotel, HotelRead
from app.models.room import RoomType, RoomTypeRead, RoomBlock
from app.models.booking import Booking, BookingStatus, Guest
from app.models.rates import RatePlan, RoomRate
from app.models.promo import PromoCode
from app.core.time import utcnow
from app.core.redis_client import redis_client
import json
from app.services.email_service import get_email_service
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


@router.get("/hotels/{hotel_identifier}/rooms", response_model=List[PublicRoomSearchResult])
@limiter.limit("60/minute")
async def search_public_rooms(
    request: Request,
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
    Optimized for performance with pre-aggregation and batch lookups.
    """
    hotel_id = await resolve_hotel_id(hotel_identifier, session)

    # Short-lived cache for public searches to prevent DB hammering
    cache_key = f"public:rooms:{hotel_id}:{check_in}:{check_out}:{guests}:{adults}:{children}:{promo_code}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Failed to get rooms cache: {e}")
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    hotel_policy = hotel.settings.get("cancellation_policy") if hotel.settings else None

    # 1. Get all room types
    query = select(RoomType).where(
        RoomType.hotel_id == hotel_id,
        RoomType.is_active == True
    )
    result = await session.execute(query)
    room_types = result.scalars().all()
    
    if not room_types:
        return []

    # --- Fetch Amenities real-time ---
    from app.models.amenity import Amenity, RoomAmenityLink
    
    room_ids = [r.id for r in room_types]
    room_amenity_map = {}
    
    if room_ids:
        try:
            link_stmt = select(RoomAmenityLink).where(RoomAmenityLink.room_id.in_(room_ids))
            link_res = await session.execute(link_stmt)
            links = link_res.scalars().all()
            
            amenity_ids = {link.amenity_id for link in links}
            if amenity_ids:
                am_stmt = select(Amenity).where(Amenity.id.in_(amenity_ids))
                am_res = await session.execute(am_stmt)
                amenities_dict = {a.id: a for a in am_res.scalars().all()}
                
                for link in links:
                    if link.amenity_id in amenities_dict:
                        a = amenities_dict[link.amenity_id]
                        if link.room_id not in room_amenity_map:
                            room_amenity_map[link.room_id] = []
                        
                        room_amenity_map[link.room_id].append({
                            "id": a.id, "name": a.name, "icon_slug": a.icon_slug,
                            "category": a.category, "is_featured": a.is_featured
                        })
        except Exception as e:
            logger.warning(f"Error fetching amenities: {e}")

    # 1b. Get all Rate Plans
    rp_query = select(RatePlan).where(RatePlan.hotel_id == hotel_id, RatePlan.is_active == True)
    rp_result = await session.execute(rp_query)
    rate_plans = rp_result.scalars().all()

    # 1c. Fetch Daily Rates (Base Price Overrides)
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
    
    daily_price_map = {}
    for dr in daily_rates:
        curr = max(dr.date_from, check_in)
        while curr <= min(dr.date_to, check_out):
            daily_price_map[(dr.room_type_id, curr.isoformat())] = dr.price
            curr += timedelta(days=1)

    # 2. Get overlapping bookings
    booking_query = select(Booking).where(
        Booking.hotel_id == hotel_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.PENDING]),
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

    # --- Pre-aggregate Availability (Optimized) ---
    # O(bookings * nights) instead of O(room_types * nights * bookings)
    booked_counters: dict = defaultdict(int)
    for b in existing_bookings:
        curr = max(b.check_in, check_in)
        end = min(b.check_out, check_out)
        while curr < end:
            for rm in (b.rooms or []):
                rt_id = rm.get("room_type_id")
                if rt_id:
                    booked_counters[(rt_id, curr.isoformat())] += 1
            curr += timedelta(days=1)

    blocked_counters: dict = defaultdict(int)
    for bl in existing_blocks:
        curr = max(bl.start_date, check_in)
        end = min(bl.end_date, check_out - timedelta(days=1))
        while curr <= end:
            blocked_counters[(bl.room_type_id, curr.isoformat())] += bl.blocked_count
            curr += timedelta(days=1)

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
    nights = max(1, (check_out - check_in).days)

    for rt in room_types:
        if rt.max_occupancy >= guests and rt.max_children >= children:
            # Availability logic uses pre-aggregated counters
            min_available_in_range = rt.total_inventory
            curr_day = check_in
            while curr_day < check_out:
                d_str = curr_day.isoformat()
                booked_on_day = booked_counters[(rt.id, d_str)]
                blocked_on_day = blocked_counters[(rt.id, d_str)]
                available_on_day = rt.total_inventory - booked_on_day - blocked_on_day
                min_available_in_range = min(min_available_in_range, available_on_day)
                if min_available_in_range <= 0:
                    break
                curr_day += timedelta(days=1)

            if min_available_in_range > 0:
                rate_options = []
                if rate_plans:
                    for plan in rate_plans:
                        overrides = getattr(rt, "rate_plan_overrides", {}) or {}
                        plan_override = overrides.get(plan.id) or {} if isinstance(overrides, dict) else {}
                        
                        if plan_override.get("is_active", True) is False:
                            continue
                            
                        is_refundable = plan_override.get("is_refundable", plan.is_refundable)
                        cancellation_hours = plan_override.get("cancellation_hours", plan.cancellation_hours)
                        inclusions = plan.inclusions if plan.inclusions else ["Free Wi-Fi"]
                        cancel_text = f"Free cancellation up to {cancellation_hours} hours before check-in" if is_refundable else "Non-refundable"
                        plan_modifier = plan.price_adjustment if plan.price_adjustment is not None else 0.0
                        
                        total_plan_price = 0
                        current_date = check_in
                        while current_date < check_out:
                             d_str = current_date.isoformat()
                             nightly_base = daily_price_map.get((rt.id, d_str), float(rt.base_price))
                             nightly_rate = nightly_base + float(plan_modifier)
                             
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
                             current_date += timedelta(days=1)

                        plan_price_nightly = total_plan_price / nights
                        plan_total = total_plan_price
                        
                        savings_text = None
                        if promo:
                             discount = 0
                             if promo.discount_type == "percentage":
                                 discount = plan_total * (promo.discount_value / 100)
                             else:
                                 discount = promo.discount_value
                             if discount > 0:
                                 savings_text = f"Save INR {int(discount)}"
                                 plan_total -= discount

                        specific_policy = cancel_text if ("is_refundable" in plan_override or "cancellation_hours" in plan_override) else (getattr(rt, "cancellation_policy", None) or hotel_policy or cancel_text)

                        rate_options.append(RateOption(
                            id=plan.id, name=plan.name, meal_plan_code=plan.meal_plan,
                            price_per_night=plan_price_nightly, total_price=plan_total,
                            inclusions=inclusions, is_refundable=is_refundable,
                            cancellation_policy=specific_policy, savings_text=savings_text,
                            is_package=getattr(plan, 'is_package', False),
                            image_url=getattr(plan, 'image_url', None)
                        ))
                
                else:
                    total_standard_price = 0
                    current_date = check_in
                    while current_date < check_out:
                        d_str = current_date.isoformat()
                        nightly_base = daily_price_map.get((rt.id, d_str), float(rt.base_price))
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
                        current_date += timedelta(days=1)

                    standard_price_per_night = total_standard_price / nights
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
                        id=f"virtual-standard-{rt.id}", name="Standard Rate", meal_plan_code="EP",
                        price_per_night=standard_price_per_night, total_price=total_standard_price,
                        inclusions=["Free Wi-Fi", "Complimentary Breakfast"], is_refundable=True,
                        cancellation_policy=getattr(rt, "cancellation_policy", None) or hotel_policy or "Free cancellation up to 24 hours before check-in",
                        savings_text=savings_text, is_package=False
                    ))

                if rate_options:
                    lowest_price = min(r.total_price for r in rate_options)
                    real_amenities = room_amenity_map.get(rt.id) or rt.amenities
                    room_dump = rt.model_dump()
                    room_dump["amenities"] = real_amenities

                    available_rooms_list.append(PublicRoomSearchResult(
                        **room_dump,
                        price_starting_at=lowest_price,
                        available_rooms=min_available_in_range,
                        rate_options=rate_options
                    ))

    try:
        redis_client.set_value(cache_key, json.dumps([r.model_dump(mode='json') for r in available_rooms_list]), expire=30)
    except Exception as e:
        logger.error(f"Failed to set rooms cache: {e}")

    return available_rooms_list


from app.models.addon import AddOn
import calendar as cal_mod


@router.get("/hotels/{hotel_slug}/calendar")
async def get_calendar_availability(
    hotel_slug: str,
    session: DbSession,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
):
    """
    Per-date availability + min price for a calendar month.
    Response: {"2026-07-01": {"min_price": 2500.0, "available": true}, ...}
    """
    hotel_id = await resolve_hotel_id(hotel_slug, session)

    cache_key = f"public:calendar:{hotel_id}:{month}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    year, mon = int(month[:4]), int(month[5:])
    start_date = date(year, mon, 1)
    last_day = cal_mod.monthrange(year, mon)[1]
    end_date = date(year, mon, last_day)

    room_types = (await session.execute(
        select(RoomType).where(RoomType.hotel_id == hotel_id, RoomType.is_active == True)
    )).scalars().all()
    if not room_types:
        return {}

    bookings = (await session.execute(
        select(Booking).where(
            Booking.hotel_id == hotel_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.PENDING]),
            Booking.check_in <= end_date,
            Booking.check_out > start_date,
        )
    )).scalars().all()

    blocks = (await session.execute(
        select(RoomBlock).where(
            RoomBlock.hotel_id == hotel_id,
            RoomBlock.start_date <= end_date,
            RoomBlock.end_date >= start_date,
        )
    )).scalars().all()

    rate_overrides = (await session.execute(
        select(RoomRate).where(
            RoomRate.hotel_id == hotel_id,
            RoomRate.rate_plan_id == None,
            RoomRate.date_from <= end_date,
            RoomRate.date_to >= start_date,
        )
    )).scalars().all()

    booked: dict = defaultdict(int)
    for b in bookings:
        d = max(b.check_in, start_date)
        end = min(b.check_out, end_date + timedelta(days=1))
        while d < end:
            for r in (b.rooms or []):
                if r.get("room_type_id"):
                    booked[(r["room_type_id"], d.isoformat())] += 1
            d += timedelta(days=1)

    blocked: dict = defaultdict(int)
    for bl in blocks:
        d = max(bl.start_date, start_date)
        end = min(bl.end_date, end_date)
        while d <= end:
            blocked[(bl.room_type_id, d.isoformat())] += bl.blocked_count
            d += timedelta(days=1)

    rate_override: dict = {}
    for ro in rate_overrides:
        d = max(ro.date_from, start_date)
        end = min(ro.date_to, end_date)
        while d <= end:
            key = (ro.room_type_id, d.isoformat())
            if key not in rate_override:
                rate_override[key] = float(ro.price)
            d += timedelta(days=1)

    result = {}
    curr = start_date
    while curr <= end_date:
        day_min_price: float | None = None
        day_available = False
        d_str = curr.isoformat()
        for rt in room_types:
            avail = rt.total_inventory - booked[(rt.id, d_str)] - blocked[(rt.id, d_str)]
            if avail > 0:
                day_available = True
                price = rate_override.get((rt.id, d_str), float(rt.base_price))
                if day_min_price is None or price < day_min_price:
                    day_min_price = price
        result[d_str] = {"min_price": day_min_price, "available": day_available}
        curr += timedelta(days=1)

    try:
        redis_client.set_value(cache_key, json.dumps(result), expire=30)
    except Exception:
        pass
    return result


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
            return json.loads(cached)
    except Exception:
        pass

    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    addon_query = select(AddOn).where(AddOn.hotel_id == hotel_id, AddOn.is_active == True)
    addon_res = await session.execute(addon_query)
    addons = addon_res.scalars().all()
    
    try:
        redis_client.set_value(cache_key, json.dumps([a.model_dump(mode='json') for a in addons]), expire=3600)
    except Exception:
        pass
        
    return addons
