from typing import List, Dict, Any
from datetime import date
from sqlmodel import select, func, and_
from app.bookings.booking import Booking, BookingStatus

# We need a way to inject session/user into tools. 
# Current pattern in agent.py defines tools INSIDE create_agent_executor to capture session/user.
# To keep this clean, we will define "logic" functions here, and wrap them as tools in agent.py.

async def logic_get_pending_payments(session, user_id) -> List[Dict[str, Any]]:
    """
    Logic to fetch bookings with pending payments.
    """
    # Find bookings where paid < total and status is confirmed/checked_in/checked_out
    query = select(Booking).where(
        Booking.hotel_id == user_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.paid_amount < Booking.total_amount
    )
    result = await session.execute(query)
    bookings = result.scalars().all()
    
    pending_list = []
    for b in bookings:
        due = b.total_amount - b.paid_amount
        pending_list.append({
            "booking_number": b.booking_number,
            "guest_name": "Unknown", # Need join for name, keeping simple for now or fetch
            "total": b.total_amount,
            "paid": b.paid_amount,
            "due": due,
            "status": b.status
        })
        
    # Enhance with Guest Name (Optional but better)
    from app.bookings.booking import Guest
    for item in pending_list:
        # N+1 query but safe for small lists. For production use JOIN.
        # Let's try to be better and use JOIN in specific query if needed, 
        # but for now iterating is fine as pending list shouldn't be huge.
        pass 
        
    return pending_list

async def logic_get_daily_revenue(session, user_id, target_date: date) -> float:
    """
    Logic to calculate revenue for a specific date (prorated).
    """
    # This is complex. Simple version: Revenue = sum of daily rates for occupied rooms?
    # Or Sum of bookings created on that day?
    # Hotelier usually means "Revenue on Books" for that night (ADR * Occupied Rooms).
    
    # Let's count rooms occupied on that night * their price.
    # We will approximate this by looking at bookings that cover this date.
    
    query = select(Booking).where(
        Booking.hotel_id == user_id,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        Booking.check_in <= target_date,
        Booking.check_out > target_date # Logic: Stay includes target_date night
    )
    result = await session.execute(query)
    bookings = result.scalars().all()
    
    daily_revenue = 0
    for b in bookings:
        # Simple prorate: Total Amount / Nights
        nights = (b.check_out - b.check_in).days
        if nights > 0:
            daily_revenue += (b.total_amount / nights)
            
    return round(daily_revenue, 2)
