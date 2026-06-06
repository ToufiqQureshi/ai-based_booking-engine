"""
Payments Router
"""
from typing import List, Optional
from fastapi import Depends, APIRouter, HTTPException, status, Request
from sqlmodel import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import logging

from app.api.deps import CurrentUser, DbSession, require_hotel_role
from app.models.payment import Payment, PaymentCreate, PaymentRead
from app.models.booking import Booking, BookingStatus, Guest
from app.models.hotel import Hotel
from app.core.time import utcnow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.get("", response_model=List[PaymentRead])
async def get_payments(current_user: CurrentUser, session: DbSession):
    """Get all payments for the hotel"""
    # Optimised query - prefetch booking and guest in a single roundtrip to resolve N+1 issue
    query = select(Payment).where(Payment.hotel_id == current_user.hotel_id).options(
        selectinload(Payment.booking).selectinload(Booking.guest)
    )
    result = await session.execute(query)
    payments = result.scalars().all()
    
    # Enrich with booking and guest info
    enriched_payments = []
    for payment in payments:
        p_dict = payment.model_dump()
        booking = payment.booking
        
        if booking:
            p_dict["booking_number"] = booking.booking_number
            guest = booking.guest
            if guest:
                p_dict["guest_name"] = f"{guest.first_name} {guest.last_name}"
            else:
                p_dict["guest_name"] = "Unknown Guest"
        else:
            p_dict["booking_number"] = "N/A"
            p_dict["guest_name"] = "Unknown Guest"
            
        enriched_payments.append(p_dict)
        
    return enriched_payments

@router.post("", response_model=PaymentRead, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_payment(
    payment_data: PaymentCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """Record a new payment"""
    # Verify booking exists and belongs to hotel
    result = await session.execute(
        select(Booking).where(
            Booking.id == payment_data.booking_id,
            Booking.hotel_id == current_user.hotel_id
        )
    )
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
        
    payment = Payment(
        **payment_data.model_dump(),
        hotel_id=current_user.hotel_id
    )
    session.add(payment)
    await session.commit()
    await session.refresh(payment)
    
    # Also update booking paid amount
    booking.paid_amount += payment.amount
    session.add(booking)
    await session.commit()

    # Get guest info for response
    guest_result = await session.execute(select(Guest).where(Guest.id == booking.guest_id))
    guest = guest_result.scalar_one_or_none()

    response = payment.model_dump()
    response["booking_number"] = booking.booking_number
    response["guest_name"] = f"{guest.first_name} {guest.last_name}"
    return response


class RefundRequest(BaseModel):
    booking_id: str
    amount: Optional[float] = None  # None = full refund
    reason: str = "requested_by_customer"


@router.post("/refund", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_razorpay_refund(
    data: RefundRequest,
    current_user: CurrentUser,
    session: DbSession,
):
    """
    Initiate a Razorpay refund for a confirmed booking.
    Only hoteliers for their own hotel can refund.
    """
    import razorpay
    from app.core.config import get_settings

    # Verify booking belongs to this hotel
    booking = await session.get(Booking, data.booking_id)
    if not booking or booking.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Find the completed payment record
    stmt = select(Payment).where(
        Payment.booking_id == data.booking_id,
        Payment.hotel_id == current_user.hotel_id,
        Payment.status == "completed"
    )
    result = await session.execute(stmt)
    payment = result.scalar_one_or_none()

    if not payment or not payment.transaction_id:
        raise HTTPException(status_code=404, detail="No completed payment found for this booking")

    hotel = await session.get(Hotel, booking.hotel_id)
    h_settings = hotel.settings if hotel and hotel.settings else {}

    # Strict per-hotel keys (no platform-global fallback).
    key_id = h_settings.get("razorpay_key_id")
    key_secret = h_settings.get("razorpay_key_secret")

    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay not configured for this property")

    # Patch Razorpay User-Agent (same as in public/payments.py)
    def _patched_update_user_agent_header(self, options):
        user_agent = "{}{}".format('Razorpay-Python/', self._get_version())
        if 'headers' in options:
            options['headers']['User-Agent'] = user_agent
        else:
            options['headers'] = {'User-Agent': user_agent}
        return options

    razorpay.Client._update_user_agent_header = _patched_update_user_agent_header
    client = razorpay.Client(auth=(key_id, key_secret))

    refund_amount = int((data.amount or booking.total_amount) * 100)  # paise

    try:
        refund = client.payment.refund(payment.transaction_id, {
            "amount": refund_amount,
            "notes": {"reason": data.reason, "booking_id": data.booking_id}
        })

        # Update payment and booking status
        payment.status = "refunded"
        booking.status = BookingStatus.CANCELLED
        booking.updated_at = utcnow()
        session.add(payment)
        session.add(booking)
        await session.commit()

        # Clear availability cache
        try:
            from app.api.v1.availability import clear_availability_cache
            clear_availability_cache(booking.hotel_id)
        except Exception:
            pass

        logger.info(f"Refund initiated for booking {data.booking_id}: {refund.get('id')}")
        return {
            "status": "success",
            "refund_id": refund.get("id"),
            "amount": data.amount or booking.total_amount
        }
    except Exception as e:
        logger.error(f"Refund failed for booking {data.booking_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")

