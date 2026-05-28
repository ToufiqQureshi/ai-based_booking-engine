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
        
        # --- Strict Payment Mode Validation ---
        hotel_payment_mode = settings.get("payment_mode", "both")
        if booking_data.payment_method == "pay_at_property" and hotel_payment_mode == "online":
            raise HTTPException(status_code=400, detail="This property requires online payment.")
        if booking_data.payment_method == "online" and hotel_payment_mode == "property":
            raise HTTPException(status_code=400, detail="This property only accepts payment at property.")
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
        
        # Enqueue Email Notifications ONLY if Pay at Property
        # For Razorpay, we'll send it upon successful verification
        if booking_data.payment_method == "pay_at_property":
            booking.status = BookingStatus.CONFIRMED
            session.add(booking)
            await session.commit()
            
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

