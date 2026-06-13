from typing import List, Dict, Any
from datetime import date
from sqlmodel import select, and_
from app.bookings.booking import Booking, BookingStatus, Guest

async def logic_get_todays_arrivals(session, user_id) -> List[Dict[str, Any]]:
    """
    Logic to fetch guests arriving today.
    """
    today = date.today()
    query = select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == user_id,
        Booking.check_in == today,
        Booking.status == BookingStatus.CONFIRMED # Only confirmed guests come
    )
    result = await session.execute(query)
    rows = result.all()
    
    arrivals = []
    for booking, guest in rows:
        arrivals.append({
            "booking_number": booking.booking_number,
            "guest_name": f"{guest.first_name} {guest.last_name}",
            "room_count": len(booking.rooms),
            "special_requests": booking.special_requests or "None",
            "status": booking.status
        })
    return arrivals

async def logic_get_todays_departures(session, user_id) -> List[Dict[str, Any]]:
    """
    Logic to fetch guests checking out today.
    """
    today = date.today()
    # Checkouts are usually active bookings (Checked In) that end today
    query = select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == user_id,
        Booking.check_out == today,
        Booking.status == BookingStatus.CHECKED_IN 
    )
    result = await session.execute(query)
    rows = result.all()
    
    departures = []
    for booking, guest in rows:
        due_amount = booking.total_amount - booking.paid_amount
        departures.append({
            "booking_number": booking.booking_number,
            "guest_name": f"{guest.first_name} {guest.last_name}",
            "room_number": "N/A", # We don't have room assignment per se yet, just room types
            "due_amount": due_amount,
            "due_amount": due_amount,
            "status": booking.status
        })
    return departures

async def logic_get_pending_bookings(session, user_id) -> List[Dict[str, Any]]:
    """
    Logic to fetch bookings waiting for confirmation (Status = PENDING).
    """
    query = select(Booking, Guest).join(Guest).where(
        Booking.hotel_id == user_id,
        Booking.status == BookingStatus.PENDING
    )
    result = await session.execute(query)
    rows = result.all()
    
    pending = []
    for booking, guest in rows:
        pending.append({
            "booking_number": booking.booking_number,
            "guest_name": f"{guest.first_name} {guest.last_name}",
            "dates": f"{booking.check_in} to {booking.check_out}",
            "room_count": len(booking.rooms),
            "amount": booking.total_amount,
            "source": booking.source
        })
    return pending
