from datetime import datetime
from app.models.booking import Booking

def calculate_cancellation_fee(booking: Booking, check_in_time_str: str = "14:00") -> tuple[float, float, str]:
    """
    Calculates the cancellation fee, refund amount, and refund status.
    Returns (cancellation_fee, refund_amount, refund_status)
    """
    # 1. Check if the booking has room details
    if not booking.rooms:
        return 0.0, booking.paid_amount, "refunded" if booking.paid_amount > 0 else "none"
        
    # We evaluate policy from the first room in the booking
    room = booking.rooms[0]
    is_refundable = room.get("is_refundable", True)
    cancellation_hours = room.get("cancellation_hours", 24)
    price_per_night = room.get("price_per_night", 0.0)
    
    # 2. If non-refundable
    if not is_refundable:
        # Full booking amount is retained as fee
        cancellation_fee = booking.total_amount
        refund_amount = 0.0
        return cancellation_fee, refund_amount, "retained"
        
    # 3. If refundable, calculate elapsed time before check-in
    # Convert check-in date to datetime at hotel's check-in time
    try:
        check_in_time = datetime.strptime(check_in_time_str, "%H:%M").time()
    except Exception:
        import datetime as dt_mod
        check_in_time = dt_mod.time(14, 0)
        
    check_in_dt = datetime.combine(booking.check_in, check_in_time)
    cancellation_dt = datetime.utcnow() # Bookings are stored in UTC
    
    time_diff = check_in_dt - cancellation_dt
    hours_before_check_in = time_diff.total_seconds() / 3600.0
    
    if hours_before_check_in >= cancellation_hours:
        # Free cancellation
        cancellation_fee = 0.0
        refund_amount = booking.paid_amount
        refund_status = "refunded" if booking.paid_amount > 0 else "none"
    else:
        # Late cancellation: fee is 1 night's price (or full amount if total is less than 1 night)
        cancellation_fee = min(price_per_night, booking.total_amount)
        refund_amount = max(0.0, booking.paid_amount - cancellation_fee)
        refund_status = "pending" if refund_amount > 0 else "retained"
        
    return cancellation_fee, refund_amount, refund_status
