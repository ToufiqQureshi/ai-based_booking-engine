from typing import List, Optional, Any, Dict
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks, Request, Header
from sqlmodel import select, and_, or_
from pydantic import BaseModel, EmailStr, Field
import uuid
import hmac
import hashlib
import logging

from app.core.database import get_session
from app.core.deps import DbSession
from app.brand_console.hotel import Hotel, HotelRead
from app.rooms.room import RoomType, RoomTypeRead, RoomBlock
from app.bookings.booking import Booking, BookingStatus, Guest
from app.rate_plans.rates_model import RatePlan, RoomRate
from app.rate_plans.promo import PromoCode
from app.integration.integration import IntegrationSettings
from app.core.redis_client import redis_client
import json
from app.services.email_service import get_email_service
from app.core.config import get_settings
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
    amount: float = Field(gt=0, le=10_000_000, description="Amount in INR (will be converted to paise)")
    currency: str = Field(default="INR", min_length=3, max_length=3)
    receipt: str = Field(min_length=1, max_length=64)

@router.post("/razorpay/create-order")
@limiter.limit("10/minute")
async def create_razorpay_order(
    request: Request,
    data: RazorpayOrderRequest,
    session: DbSession,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key", max_length=128),
):
    """
    Creates a Razorpay order and returns the order details.
    Amount should be in INR (not paise, we convert it here).
    """
    # --- Idempotency Check (atomic) ---
    # Previously this used get-then-set which is racy: two concurrent requests for
    # the same receipt can both read "no key", both set it, and both create a Razorpay
    # order — leading to duplicate payments being reconciled. Replaced with Redis
    # SET NX EX (atomic) and an in-process asyncio.Lock for the in-memory fallback.
    lock_key = f"razorpay_order_lock:{data.receipt}"
    if idempotency_key:
        lock_key = f"razorpay_order_lock:{idempotency_key}:{data.receipt}"
    acquired = await redis_client.set_nx_ex(lock_key, "locked", expire=60)
    if not acquired:
        raise HTTPException(status_code=409, detail="Order creation already in progress for this receipt.")

    # Fetch hotel to get its specific Razorpay keys if available
    booking = await session.get(Booking, data.receipt)
    if not booking:
        # Release the lock so the user can retry after fixing the receipt.
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=404, detail="Booking not found for order creation")

    hotel = await session.get(Hotel, booking.hotel_id)
    h_settings = hotel.settings if hotel and hotel.settings else {}
    from app.core.vault import resolve_settings_secrets
    h_settings = await resolve_settings_secrets(session, h_settings)
    hotel_key_id = h_settings.get("razorpay_key_id")
    hotel_key_secret = h_settings.get("razorpay_key_secret")

    # Strict per-hotel: each property must configure its own Razorpay keys
    # (set via Super Admin → Hotel Integrations). No platform-global fallback,
    # so each hotel's payments settle into its own Razorpay account.
    key_id = hotel_key_id
    key_secret = hotel_key_secret

    if not key_id or not key_secret:
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=503, detail="Online payment is not configured for this property")

    # SECURITY: Never trust the client-supplied amount. A guest could request an
    # order for ₹1 and the booking would still be marked fully paid by the
    # /verify + webhook flow. Always charge the server-computed booking total.
    server_amount = float(booking.total_amount or 0)
    if server_amount <= 0:
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=400, detail="Booking has no payable amount")

    client = razorpay.Client(auth=(key_id, key_secret))

    try:
        # Razorpay expects amount in smallest currency unit (paise for INR)
        amount_in_paise = int(round(server_amount * 100))

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
        # Release the lock so legitimate retries can succeed.
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=500, detail="Failed to create payment order")


class RazorpayVerifyRequest(BaseModel):
    razorpay_order_id: str = Field(min_length=8, max_length=64)
    razorpay_payment_id: str = Field(min_length=8, max_length=64)
    razorpay_signature: str = Field(min_length=32, max_length=256)
    booking_id: str

@router.post("/razorpay/verify")
@limiter.limit("20/minute")
async def verify_razorpay_payment(
    request: Request,
    data: RazorpayVerifyRequest,
    session: DbSession,
    background_tasks: BackgroundTasks,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key", max_length=128),
):
    """
    Verifies the Razorpay signature and updates the booking status to CONFIRMED.
    """
    # --- Idempotency Check (atomic) ---
    lock_key = f"payment_verify_lock:{data.booking_id}"
    if idempotency_key:
        lock_key = f"payment_verify_lock:{idempotency_key}:{data.booking_id}"
    acquired = await redis_client.set_nx_ex(lock_key, "locked", expire=120)
    if not acquired:
        raise HTTPException(status_code=409, detail="Payment verification already in progress for this booking.")

    # Fetch hotel to get its specific Razorpay keys if available
    booking = await session.get(Booking, data.booking_id)
    if not booking:
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=404, detail="Booking not found")

    hotel = await session.get(Hotel, booking.hotel_id)
    h_settings = hotel.settings if hotel and hotel.settings else {}
    from app.core.vault import resolve_settings_secrets
    h_settings = await resolve_settings_secrets(session, h_settings)
    hotel_key_id = h_settings.get("razorpay_key_id")
    hotel_key_secret = h_settings.get("razorpay_key_secret")

    # Strict per-hotel keys (no platform-global fallback).
    key_id = hotel_key_id
    key_secret = hotel_key_secret

    if not key_id or not key_secret:
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=503, detail="Online payment is not configured for this property")

    client = razorpay.Client(auth=(key_id, key_secret))

    try:
        # Verify Signature — this raises SignatureVerificationError on mismatch.
        client.utility.verify_payment_signature({
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        })

        # If verification is successful, update booking status.
        # Guard against double-confirm: if booking is already in a terminal state,
        # we still respond 200 (idempotent) but skip the side effects.
        already_confirmed = booking.status == BookingStatus.CONFIRMED
        guest = None
        if not already_confirmed:
            booking.status = BookingStatus.CONFIRMED
            booking.paid_amount = booking.total_amount
            booking.updated_at = utcnow()

            from app.payments.payment import Payment
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

            # Update loyalty progress for this confirmed booking
            from app.api.v1.public.bookings import _update_guest_loyalty
            guest_res = await session.execute(
                select(Guest).where(Guest.id == booking.guest_id)
            )
            _guest = guest_res.scalar_one_or_none()
            if _guest:
                rooms_count = len(booking.rooms) if isinstance(booking.rooms, list) else 1
                await _update_guest_loyalty(
                    session, booking.hotel_id, _guest.email,
                    booking.total_amount, rooms_count
                )

            await session.commit()

            # Send confirmation emails using FastAPI's BackgroundTasks — the
            # previous code constructed a new BackgroundTasks() and called
            # await on it, which only ran those tasks inline (and would block
            # the response). Using the injected instance schedules the work
            # to run after the response is sent, so the user sees the
            # confirmation immediately while the emails are processed.
            # safe_background() wraps each task with exception logging so a
            # failure in one email doesn't crash the worker silently.
            guest = await session.get(Guest, booking.guest_id)
            if hotel and guest:
                email_service = await get_email_service()

                from app.core.tasks import safe_background
                safe_background(
                    background_tasks,
                    lambda svc=email_service, ge=guest.email, gn=f"{guest.first_name} {guest.last_name}", bn=booking.booking_number, ci=str(booking.check_in), co=str(booking.check_out), ta=booking.total_amount, hs=h_settings: svc.send_guest_booking_confirmation(
                        guest_email=ge,
                        guest_name=gn,
                        booking_number=bn,
                        check_in=ci,
                        check_out=co,
                        total_amount=ta,
                        hotel_settings=hs,
                    ),
                    task_name="send_guest_booking_confirmation",
                )

                hotel_emails = hotel.contact.get("email", "") if hotel.contact else ""
                safe_background(
                    background_tasks,
                    lambda svc=email_service, he=hotel_emails, bn=booking.booking_number, gn=f"{guest.first_name} {guest.last_name}", ci=str(booking.check_in), co=str(booking.check_out), ta=booking.total_amount, hs=h_settings: svc.send_hotel_booking_notification(
                        hotel_emails=he,
                        booking_number=bn,
                        guest_name=gn,
                        check_in=ci,
                        check_out=co,
                        total_amount=ta,
                        hotel_settings=hs,
                    ),
                    task_name="send_hotel_booking_notification",
                )

        # Send WhatsApp confirmation if hotel has WhatsApp configured
        try:
            if guest and hotel and booking:
                integration = (await session.execute(
                    select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
                )).scalar_one_or_none()
                if integration and integration.whatsapp_api_key and integration.whatsapp_phone_number_id and guest.phone:
                    import httpx
                    wa_message = f"✅ Booking Confirmed!\n\nDear {guest.first_name},\nYour booking #{booking.booking_number} at {hotel.name} is confirmed.\n\nCheck-in: {booking.check_in}\nCheck-out: {booking.check_out}\nTotal: ₹{booking.total_amount:,.0f}\n\nThank you for choosing us!"
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://graph.facebook.com/v19.0/{integration.whatsapp_phone_number_id}/messages",
                            headers={"Authorization": f"Bearer {integration.whatsapp_api_key}", "Content-Type": "application/json"},
                            json={"messaging_product": "whatsapp", "to": guest.phone, "type": "text", "text": {"body": wa_message}},
                            timeout=10.0
                        )
        except Exception as wa_err:
            logger.warning(f"WhatsApp confirmation failed (non-critical): {wa_err}")

        return {"status": "success", "message": "Payment verified and booking confirmed", "already_confirmed": already_confirmed}

    except razorpay.errors.SignatureVerificationError:
        # Don't leak whether the signature failed for this booking or generally.
        # Always 400 with a generic message + log details server-side.
        logger.warning(
            "Razorpay signature verification failed for booking %s (order=%s payment=%s)",
            data.booking_id, data.razorpay_order_id, data.razorpay_payment_id,
        )
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Payment verification failed for booking {data.booking_id}: {e}")
        # Release lock so user can retry, but only if it's a transient error.
        redis_client.delete_value(lock_key)
        raise HTTPException(status_code=500, detail="Internal Server Error during verification")


def _verify_razorpay_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """
    Verify the X-Razorpay-Signature header against the raw request body.
    Razorpay signs the body with HMAC-SHA256(secret, body) and hex-encodes it.
    Returns True if valid, False otherwise.
    """
    if not signature or not secret:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    # Constant-time compare to avoid timing side channels.
    return hmac.compare_digest(expected, signature)


class RazorpayWebhookPayload(BaseModel):
    """Loose schema — Razorpay sends many event types; we only need a few fields.

    We keep this permissive (extra='allow') because Razorpay regularly adds new
    fields and we don't want to reject real webhooks over schema drift.
    """
    entity: Optional[str] = None
    account_id: Optional[str] = None
    event: Optional[str] = None
    created_at: Optional[int] = None
    payload: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"


@router.post("/razorpay/webhook")
@limiter.limit("300/minute")
async def razorpay_webhook(
    request: Request,
    session: DbSession,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
):
    """
    Server-side webhook handler called by Razorpay when payment state changes.
    This is the AUTHORITATIVE source of payment confirmation — the /verify endpoint
    is best-effort. Even if the user closes the browser mid-checkout, this endpoint
    will still flip the booking to CONFIRMED.

    Signature verification: HMAC-SHA256(RAZORPAY_WEBHOOK_SECRET, raw_body) compared
    against the X-Razorpay-Signature header (constant-time compare). This prevents
    forged webhooks from malicious actors.
    """
    settings = get_settings()
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    raw_body = await request.body()
    if not _verify_razorpay_webhook_signature(raw_body, x_razorpay_signature or "", webhook_secret):
        logger.warning("Razorpay webhook signature verification failed (signature header missing or invalid)")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.error(f"Razorpay webhook sent unparseable body: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event_type = event.get("event", "")
    payload = event.get("payload", {}) or {}
    payment_entity = (payload.get("payment") or {}).get("entity") or {}
    order_entity = (payload.get("order") or {}).get("entity") or {}

    razorpay_order_id = payment_entity.get("order_id") or order_entity.get("id")
    razorpay_payment_id = payment_entity.get("id")
    if not razorpay_order_id:
        # We can't do anything useful without an order id; ack to stop Razorpay retrying.
        logger.info(f"Razorpay webhook '{event_type}' missing order_id — acking")
        return {"status": "ignored", "reason": "no order_id"}

    # Resolve the booking via the receipt (we use the order receipt = booking id).
    receipt = order_entity.get("receipt")
    booking = None
    if receipt:
        booking = await session.get(Booking, receipt)
    if not booking and razorpay_order_id:
        # Fallback: look up via the Payment record we wrote from /verify (if any).
        from app.payments.payment import Payment
        stmt = select(Payment).where(Payment.reference_number == razorpay_order_id)
        result = await session.execute(stmt)
        existing_payment = result.scalar_one_or_none()
        if existing_payment:
            booking = await session.get(Booking, existing_payment.booking_id)

    if not booking:
        logger.warning(f"Razorpay webhook '{event_type}' for unknown order {razorpay_order_id} — acking")
        return {"status": "ignored", "reason": "unknown order"}

    if event_type in ("payment.captured", "order.paid"):
        if booking.status != BookingStatus.CONFIRMED:
            booking.status = BookingStatus.CONFIRMED
            booking.paid_amount = booking.total_amount
            booking.updated_at = utcnow()
            from app.payments.payment import Payment
            payment = Payment(
                hotel_id=booking.hotel_id,
                booking_id=booking.id,
                amount=booking.total_amount,
                payment_method="razorpay",
                transaction_id=razorpay_payment_id or razorpay_order_id,
                status="completed",
                reference_number=razorpay_order_id,
            )
            session.add(payment)
            session.add(booking)

            # Update loyalty counters via webhook confirmation path
            from app.api.v1.public.bookings import _update_guest_loyalty
            guest_res = await session.execute(
                select(Guest).where(Guest.id == booking.guest_id)
            )
            _guest = guest_res.scalar_one_or_none()
            if _guest:
                rooms_count = len(booking.rooms) if isinstance(booking.rooms, list) else 1
                await _update_guest_loyalty(
                    session, booking.hotel_id, _guest.email,
                    booking.total_amount, rooms_count
                )

            await session.commit()
            logger.info(f"Webhook CONFIRMED booking {booking.id} via {event_type}")
            try:
                import sentry_sdk
                sentry_sdk.add_breadcrumb(
                    category="payment",
                    message="payment_success",
                    level="info",
                    data={
                        "booking_id": str(booking.id),
                        "hotel_id": str(booking.hotel_id),
                        "amount": float(booking.total_amount),
                        "event": event_type,
                    },
                )
            except Exception:
                pass
        return {"status": "ok", "booking_id": booking.id, "event": event_type}

    if event_type in ("payment.failed", "order.payment_failed"):
        logger.info(f"Webhook {event_type} for booking {booking.id} (no DB change — status remains PENDING)")
        try:
            import sentry_sdk
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("hotel_id", str(booking.hotel_id))
                scope.set_tag("payment_event", event_type)
                scope.set_context("payment", {
                    "booking_id": str(booking.id),
                    "hotel_id": str(booking.hotel_id),
                    "amount": float(booking.total_amount),
                    "razorpay_order_id": razorpay_order_id,
                })
                sentry_sdk.capture_message(
                    f"Payment failed: {event_type} for booking {booking.id}",
                    level="warning",
                )
        except Exception:
            pass
        return {"status": "ok", "event": event_type}

    # Other events (refund.processed, dispute.created, etc.) are acknowledged but
    # not handled here. Add handlers as needed.
    return {"status": "ok", "event": event_type, "handled": False}

