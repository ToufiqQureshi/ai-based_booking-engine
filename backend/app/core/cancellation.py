from datetime import datetime, timezone
from app.models.booking import Booking

def calculate_cancellation_fee(booking: Booking, check_in_time_str: str = "14:00") -> tuple[float, float, str]:
    """
    Calculates the cancellation fee, refund amount, and refund status.
    Returns (cancellation_fee, refund_amount, refund_status)

    Note on time zones: the database stores check_in as a `date` (no tz info)
    and the caller passes `check_in_time_str` (e.g. "14:00") which is the
    hotel's local check-in time. We treat it as UTC for comparison against
    "now in UTC". For hotels in non-UTC timezones this is a small skew equal
    to the hotel's UTC offset at check-in time — this is a known limitation
    that will be addressed when the Hotel model gains a `timezone` field
    (tracked in P2.5 / P4.1). Within a single timezone the calculation is
    accurate, which is what matters for fee math.
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
    # Convert check-in date to a timezone-aware UTC datetime at hotel's
    # check-in time. Previously this used datetime.utcnow() (naive + deprecated
    # in 3.12) and produced a naive `check_in_dt` — subtracting two naive
    # datetimes is technically allowed but masks tz confusion and will break
    # once anyone in a non-UTC zone runs a free-cancellation check.
    try:
        check_in_time = datetime.strptime(check_in_time_str, "%H:%M").time()
    except Exception:
        import datetime as dt_mod
        check_in_time = dt_mod.time(14, 0)

    check_in_dt = datetime.combine(booking.check_in, check_in_time, tzinfo=timezone.utc)
    cancellation_dt = datetime.now(timezone.utc)

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
