"""
Payments Router
"""
from typing import List
from fastapi import APIRouter, HTTPException, status
from sqlmodel import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.payment import Payment, PaymentCreate, PaymentRead
from app.models.booking import Booking, Guest

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

@router.post("", response_model=PaymentRead)
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

