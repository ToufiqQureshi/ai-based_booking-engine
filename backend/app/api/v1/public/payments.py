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


# --- Razorpay Integration ---
import razorpay
from app.core.config import get_settings

# Patch Razorpay Client to fix Python 3.12+/3.13+ strict header validation issue (Illegal header value due to trailing space in User-Agent)
def patched_update_user_agent_header(self, options):
    user_agent = "{}{}".format('Razorpay-Python/', self._get_version())
    if 'headers' in options:
        options['headers']['User-Agent'] = user_agent
    else:
        options['headers'] = {'User-Agent': user_agent}
    return options

razorpay.Client._update_user_agent_header = patched_update_user_agent_header


class RazorpayOrderRequest(BaseModel):
    amount: float
    currency: str = "INR"
    receipt: str

@router.post("/razorpay/create-order")
async def create_razorpay_order(data: RazorpayOrderRequest, session: DbSession):
    """
    Creates a Razorpay order and returns the order details.
    Amount should be in INR (not paise, we convert it here).
    """
    # --- Idempotency Check ---
    # One order per receipt (booking_id) within a short window
    lock_key = f"razorpay_order_lock:{data.receipt}"
    try:
        if redis_client.get_value(lock_key):
            raise HTTPException(status_code=409, detail="Order creation already in progress.")
        redis_client.set_value(lock_key, "locked", expire=60)
    except HTTPException: raise
    except: pass

    # Fetch hotel to get its specific Razorpay keys if available
    booking = await session.get(Booking, data.receipt)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for order creation")

    hotel = await session.get(Hotel, booking.hotel_id)
    h_settings = hotel.settings if hotel and hotel.settings else {}
    hotel_key_id = h_settings.get("razorpay_key_id")
    hotel_key_secret = h_settings.get("razorpay_key_secret")

    settings = get_settings()

    # Use hotel-specific keys or platform fallback
    key_id = hotel_key_id or settings.RAZORPAY_KEY_ID
    key_secret = hotel_key_secret or settings.RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Razorpay is not configured for this property")
        
    client = razorpay.Client(auth=(key_id, key_secret))
    
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
    # --- Idempotency Check ---
    lock_key = f"payment_verify_lock:{data.booking_id}"
    try:
        if redis_client.get_value(lock_key):
            raise HTTPException(status_code=409, detail="Verification already in progress.")
        redis_client.set_value(lock_key, "locked", expire=60)
    except HTTPException: raise
    except: pass

    # Fetch hotel to get its specific Razorpay keys if available
    booking = await session.get(Booking, data.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    hotel = await session.get(Hotel, booking.hotel_id)
    h_settings = hotel.settings if hotel and hotel.settings else {}
    hotel_key_id = h_settings.get("razorpay_key_id")
    hotel_key_secret = h_settings.get("razorpay_key_secret")

    settings = get_settings()
    key_id = hotel_key_id or settings.RAZORPAY_KEY_ID
    key_secret = hotel_key_secret or settings.RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Razorpay is not configured for this property")
        
    client = razorpay.Client(auth=(key_id, key_secret))
    
    try:
        # Verify Signature
        client.utility.verify_payment_signature({
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        })
        
        # If verification is successful, update booking status
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
        
        # Send confirmation email
        guest = await session.get(Guest, booking.guest_id)
        
        if hotel and guest:
            from fastapi import BackgroundTasks
            background_tasks = BackgroundTasks()
            
            email_service = await get_email_service()
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
            
            hotel_emails = hotel.contact.get("email", "") if hotel.contact else ""
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
            # Execute background tasks immediately for this route
            await background_tasks()
        
        return {"status": "success", "message": "Payment verified and booking confirmed"}
        
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except Exception as e:
        logger.error(f"Payment verification failed: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during verification")
