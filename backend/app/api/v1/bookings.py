"""
Bookings Router
Booking CRUD aur guest management.
Bookings page ke liye.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Query, BackgroundTasks
from sqlmodel import select
import uuid

from fastapi import Request
from app.api.deps import CurrentUser, DbSession
from app.core.cache import cache_response, invalidate_cache
from app.models.timeline import BookingTimeline
from app.models.booking import (
    Booking, BookingCreate, BookingRead, BookingUpdate,
    Guest, GuestCreate, GuestRead, BookingStatus, BookingSource,
)
from app.models.room import RoomType
from app.api.v1.availability import clear_availability_cache
from app.services.email_service import get_email_service
from app.core.redis_client import redis_client as _redis

def _clear_booking_caches(hotel_id: str):
    """Clear all booking-related caches when bookings change."""
    try:
        _redis.delete_pattern(f"dashboard_stats:{hotel_id}:*")
        _redis.delete_pattern(f"dashboard_recent_bookings:{hotel_id}:*")
        _redis.delete_pattern(f"bookings:{hotel_id}:*")
        _redis.delete_pattern(f"reports_dashboard:{hotel_id}:*")
        _redis.delete_pattern(f"reports_occupancy:{hotel_id}:*")
        # INF-02: analytics dashboards are cached 600s; bust them too so
        # revenue/occupancy numbers don't go stale for 10 min after a
        # booking is created/updated/cancelled.
        for prefix in (
            "analytics_dashboard", "analytics_overview", "analytics_revenue",
            "analytics_traffic", "analytics_ai", "analytics_cancellations",
            "analytics_kpis",
        ):
            _redis.delete_pattern(f"{prefix}:{hotel_id}:*")
    except Exception:
        pass

# Keep old name as alias for compatibility with existing callers
_clear_dashboard_cache = _clear_booking_caches

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def generate_booking_number() -> str:
    """Unique booking number generate karta hai"""
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    unique_part = str(uuid.uuid4())[:6].upper()
    return f"BK{timestamp}{unique_part}"


@router.get("", response_model=List[BookingRead])
@cache_response(expire=30, key_prefix="bookings")
async def get_bookings(
    request: Request,
    current_user: CurrentUser,
    session: DbSession,
    status_filter: Optional[BookingStatus] = Query(None, alias="status"),
    source_filter: Optional[BookingSource] = Query(None, alias="source"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Hotel ki saari bookings get karo.
    Optional status / source filter ke saath.
    """
    query = select(Booking).where(Booking.hotel_id == current_user.hotel_id)

    if status_filter:
        query = query.where(Booking.status == status_filter)

    if source_filter:
        query = query.where(Booking.source == source_filter)
    
    query = query.offset(offset).limit(limit).order_by(Booking.created_at.desc())
    
    result = await session.execute(query)
    bookings = result.scalars().all()
    
    # 1. Collect unique Guest IDs
    guest_ids = [b.guest_id for b in bookings if b.guest_id]
    guests_map = {}
    
    if guest_ids:
        # 2. Batch fetch all guests in one single query
        guest_query = select(Guest).where(Guest.id.in_(guest_ids))
        guest_res = await session.execute(guest_query)
        guests_map = {g.id: g for g in guest_res.scalars().all()}
    
    # 3. Attach guest data
    booking_responses = []
    for booking in bookings:
        guest = guests_map.get(booking.guest_id)
        booking_dict = booking.model_dump()
        booking_dict["guest"] = guest.model_dump() if guest else {}
        booking_responses.append(booking_dict)
    
    return booking_responses


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: CurrentUser,
    session: DbSession,
    background_tasks: BackgroundTasks
):
    """
    New booking create karo.
    Guest bhi saath mein create hota hai.
    """
    # Create or find guest
    guest_data = booking_data.guest
    
    # Check if guest exists by email
    result = await session.execute(
        select(Guest).where(
            Guest.email == guest_data.email,
            Guest.hotel_id == current_user.hotel_id
        )
    )
    guest = result.scalar_one_or_none()
    
    if not guest:
        guest = Guest(
            **guest_data.model_dump(),
            hotel_id=current_user.hotel_id
        )
        session.add(guest)
        await session.flush()
    
    # Create booking
    # --- CONCURRENCY SAFETY: Lock room inventory during transaction ---
    rooms_list = []
    from app.models.hotel import Hotel
    from app.models.rates import RatePlan
    hotel = await session.get(Hotel, current_user.hotel_id)
    hotel_policy = hotel.settings.get("cancellation_policy") if hotel and hotel.settings else None

    for room_req in booking_data.rooms:
        rt_id = room_req.get("room_type_id")
        # Lock this room type for the duration of this transaction.
        # SECURITY (TEN-02): scope to the caller's hotel so a foreign
        # room_type_id can't disclose another tenant's policy config or
        # lock another tenant's inventory row.
        rt_query = select(RoomType).where(
            RoomType.id == rt_id,
            RoomType.hotel_id == current_user.hotel_id,
        ).with_for_update()
        rt_result = await session.execute(rt_query)
        room_type = rt_result.scalar_one_or_none()

        if not room_type:
             raise HTTPException(status_code=404, detail=f"Room type {rt_id} not found")
             
        # Resolve policy and freeze
        cancellation_policy = room_type.cancellation_policy
        is_refundable = True
        cancellation_hours = 24
        
        rp_id = room_req.get("rate_plan_id")
        
        # Check for overrides on room type level
        plan_override = {}
        if room_type and rp_id:
            overrides = getattr(room_type, "rate_plan_overrides", {}) or {}
            plan_override = overrides.get(rp_id) or {} if isinstance(overrides, dict) else {}

        if rp_id:
            # SECURITY (TEN-02): only honour a rate plan owned by this hotel.
            rp = await session.get(RatePlan, rp_id)
            if rp and rp.hotel_id == current_user.hotel_id:
                is_refundable = plan_override.get("is_refundable", rp.is_refundable)
                cancellation_hours = plan_override.get("cancellation_hours", rp.cancellation_hours)
                
        if not cancellation_policy:
            if plan_override:
                cancellation_policy = f"Free cancellation up to {cancellation_hours} hours before check-in" if is_refundable else "Non-refundable"
            else:
                cancellation_policy = hotel_policy
                if not cancellation_policy:
                    cancellation_policy = f"Free cancellation up to {cancellation_hours} hours before check-in" if is_refundable else "Non-refundable"
                
        room_dict = dict(room_req)
        room_dict["cancellation_policy"] = cancellation_policy
        room_dict["is_refundable"] = is_refundable
        room_dict["cancellation_hours"] = cancellation_hours
        rooms_list.append(room_dict)

    # Get Hotel Settings for Tax rules
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
    for room in rooms_list:
        price_per_night = room.get("price_per_night")
        total_price = room.get("total_price", 0.0)
        if price_per_night is None:
            nights = (booking_data.check_out - booking_data.check_in).days
            if nights < 1:
                nights = 1
            price_per_night = total_price / nights
        
        r_rate = resolve_room_rate_tax(float(price_per_night))
        r_total = float(total_price)
        if room_tax_type == "inclusive":
            r_sub = r_total / (1 + (r_rate / 100))
            r_tax = r_total - r_sub
        else:
            r_sub = r_total
            r_tax = r_total * (r_rate / 100)
        room_subtotal += r_sub
        room_tax_amount += r_tax

    addon_total = sum(addon.get("price", 0) for addon in booking_data.addons) if booking_data.addons else 0.0
    
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
    from app.models.promo import PromoCode
    if booking_data.promo_code:
        promo_query = select(PromoCode).where(
            PromoCode.code == booking_data.promo_code,
            PromoCode.hotel_id == current_user.hotel_id,
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

    addons_list = [dict(addon) for addon in booking_data.addons] if booking_data.addons else []

    booking = Booking(
        hotel_id=current_user.hotel_id,
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
        status=BookingStatus.PENDING,
        source=booking_data.source,
    )
    session.add(booking)
    await session.flush() # Get booking ID
    
    from app.core.tasks import log_timeline_task
    # Log to Timeline in background
    background_tasks.add_task(
        log_timeline_task,
        booking_id=booking.id,
        event_type="booking_created",
        old_value=None,
        new_value=BookingStatus.PENDING,
        message=f"New booking created via {booking.source}",
        changed_by=str(current_user.id)
    )
    
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    _clear_dashboard_cache(current_user.hotel_id)
    await session.refresh(booking)
    await session.refresh(guest)
    
    # Enqueue Email Notifications
    email_service = await get_email_service()
    
    # Extract multi-tenant settings
    h_settings = hotel.settings if hotel and hotel.settings else {}
    
    background_tasks.add_task(
        email_service.send_guest_booking_confirmation,
        guest_email=guest.email,
        guest_name=f"{guest.first_name} {guest.last_name}",
        booking_number=booking.booking_number,
        check_in=str(booking.check_in),
        check_out=str(booking.check_out),
        total_amount=booking.total_amount,
        hotel_settings=h_settings
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
        hotel_settings=h_settings
    )
    
    response = booking.model_dump()
    response["guest"] = guest.model_dump()
    return response



# ============== Guest Endpoints ==============

@router.get("/guests", response_model=List[GuestRead], tags=["Guests"])
async def get_guests(
    current_user: CurrentUser,
    session: DbSession,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
):
    """Hotel ke guests get karo (paginated).

    DB-02: previously returned the entire guest table for the hotel with no
    limit — an OOM/timeout risk for properties with large guest histories.
    """
    result = await session.execute(
        select(Guest)
        .where(Guest.hotel_id == current_user.hotel_id)
        .order_by(Guest.id)
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


@router.get("/guests/stats", response_model=dict, tags=["Guests"])
async def get_guest_stats(current_user: CurrentUser, session: DbSession):
    """
    Guest statistics calculation.
    Repeat guests = Guests with > 1 total bookings.
    """
    from sqlalchemy import func
    
    # Count bookings per guest for this hotel
    # Subquery to count bookings by guest
    # Using raw SQL or complex query building for simplicity:
    # Select guest_id, count(*) from bookings where hotel_id = X group by guest_id having count(*) > 1
    
    # Optimized approach:
    query = select(Booking.guest_id).where(Booking.hotel_id == current_user.hotel_id).group_by(Booking.guest_id).having(func.count(Booking.id) > 1)
    result = await session.execute(query)
    repeat_guests_count = len(result.all())
    
    return {
        "repeat_guests": repeat_guests_count,
        "total_guests": 0 # Frontend can calculate total from list, or we add here
    }


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(booking_id: str, current_user: CurrentUser, session: DbSession):
    """Single booking get karo"""
    result = await session.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.hotel_id == current_user.hotel_id
        )
    )
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    guest_result = await session.execute(select(Guest).where(Guest.id == booking.guest_id))
    guest = guest_result.scalar_one_or_none()
    
    response = booking.model_dump()
    response["guest"] = guest.model_dump() if guest else {}
    return response


@router.patch("/{booking_id}", response_model=BookingRead)
async def update_booking(
    booking_id: str,
    booking_update: BookingUpdate,
    current_user: CurrentUser,
    session: DbSession,
    background_tasks: BackgroundTasks
):
    """Booking status/details update karo"""
    result = await session.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.hotel_id == current_user.hotel_id
        )
    )
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    old_status = booking.status
    update_data = booking_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking, field, value)
    
    new_status = booking.status
    
    if new_status == BookingStatus.CANCELLED and old_status != BookingStatus.CANCELLED:
        if old_status == BookingStatus.CANCEL_REQUESTED:
            # Keep pre-calculated values from guest request time
            pass
        else:
            from app.core.cancellation import calculate_cancellation_fee
            fee, refund, ref_status = calculate_cancellation_fee(booking)
            booking.cancellation_fee = fee
            booking.refund_amount = refund
            booking.refund_status = ref_status
    elif old_status == BookingStatus.CANCEL_REQUESTED and new_status != BookingStatus.CANCEL_REQUESTED:
        # Request was rejected, reset cancellation details
        booking.cancellation_fee = 0.0
        booking.refund_amount = 0.0
        booking.refund_status = "none"

    # Log to timeline in background if status changed
    if old_status != new_status:
        from app.core.tasks import log_timeline_task
        background_tasks.add_task(
            log_timeline_task,
            booking_id=booking.id,
            event_type="status_change",
            old_value=old_status,
            new_value=new_status,
            message=f"Booking status updated from {old_status} to {new_status}",
            changed_by=str(current_user.id)
        )
        if new_status == BookingStatus.CHECKED_OUT:
            from app.core.tasks import process_loyalty_checkout_task
            from app.core.tasks import safe_background
            bid = booking.id
            safe_background(
                background_tasks,
                lambda: process_loyalty_checkout_task(booking_id=bid),
                task_name="loyalty_checkout",
            )
        
    booking.updated_at = datetime.utcnow()
    session.add(booking)
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    _clear_dashboard_cache(current_user.hotel_id)
    await session.refresh(booking)
    
    guest_result = await session.execute(select(Guest).where(Guest.id == booking.guest_id))
    guest = guest_result.scalar_one_or_none()
    
    response = booking.model_dump()
    response["guest"] = guest.model_dump() if guest else {}
    return response



