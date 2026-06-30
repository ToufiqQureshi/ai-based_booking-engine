from sqlmodel import select, Session
from app.rooms.room import RoomType
from app.rate_plans.promo import PromoCode
from app.core.db.database import engine
from sqlalchemy.orm import sessionmaker
import logging

logger = logging.getLogger(__name__)

# Roles permitted to perform destructive / money-affecting changes via the
# assistant. STAFF is intentionally excluded (CLAUDE.md RBAC: STAFF cannot modify
# critical data). The agno requires_confirmation gate only enforces hotelier
# approval — it does NOT check role — so each money-affecting tool must verify
# this itself.
_DESTRUCTIVE_ALLOWED_ROLES = {"OWNER", "MANAGER", "SUPER_ADMIN"}
# Back-compat alias (used by cancel logic / tests).
_CANCEL_ALLOWED_ROLES = _DESTRUCTIVE_ALLOWED_ROLES

_PERMISSION_DENIED = (
    "ERROR: You do not have permission to perform this action. "
    "Only an OWNER or MANAGER can — please ask them."
)


def _role_allows_destructive(user) -> bool:
    role = getattr(user.role, "value", str(user.role)).upper()
    return role in _DESTRUCTIVE_ALLOWED_ROLES


# Logic functions to be wrapped as @tool in agent.py


async def logic_cancel_booking(session, user, booking_number: str) -> str:
    """Cancel a single booking — destructive, role-gated, status-guarded, audited.

    Lives here (not as a closure in agent.py) so it can be unit-tested directly.

    The hotelier's explicit go-ahead is enforced one layer up by agno's
    human-in-the-loop gate (`@tool(requires_confirmation=True)`), which pauses the
    run and will not invoke this function until the hotelier clicks "Proceed". By
    the time we get here, consent has already been given — so this function just
    performs the cancellation, with these server-side safety layers that the LLM
    cannot talk its way past:

      - RBAC: only OWNER / MANAGER / SUPER_ADMIN may cancel.
      - Status guard: a CHECKED_IN / CHECKED_OUT stay can't be cancelled here.
      - Tenant isolation: the booking must belong to the caller's hotel.
      - Audit: writes a BookingTimeline row attributing the change to the AI agent.
    """
    # Imported here to avoid a heavy import at module load for the tool layer.
    from app.bookings.booking import Booking, BookingStatus
    from app.bookings.timeline import BookingTimeline

    role = getattr(user.role, "value", str(user.role)).upper()
    if role not in _CANCEL_ALLOWED_ROLES:
        return (
            "ERROR: You do not have permission to cancel bookings. "
            "Only an OWNER or MANAGER can do this — please ask them."
        )

    try:
        result = await session.execute(
            select(Booking).where(
                Booking.hotel_id == user.hotel_id,
                Booking.booking_number == booking_number,
            )
        )
        booking = result.scalar_one_or_none()

        if not booking:
            return f"ERROR: Booking {booking_number} not found in this hotel."

        if booking.status == BookingStatus.CANCELLED:
            return f"Booking {booking_number} is already cancelled (no action taken)."

        if booking.status in (BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT):
            return (
                f"ERROR: Booking {booking_number} is '{booking.status.value}'. "
                "A checked-in or checked-out booking cannot be cancelled from the "
                "assistant — handle it at the front desk."
            )

        old_status = booking.status
        booking.status = BookingStatus.CANCELLED
        session.add(booking)
        session.add(BookingTimeline(
            booking_id=booking.id,
            event_type="booking_cancelled",
            old_value=old_status.value,
            new_value=BookingStatus.CANCELLED.value,
            message=f"Cancelled via AI assistant on hotelier confirmation (user {user.id}).",
            changed_by="ai_agent",
        ))
        await session.commit()
        await session.refresh(booking)

        logger.info(f"Booking {booking_number} cancelled via AI assistant by user {user.id}")
        return f"SUCCESS: Booking {booking_number} has been cancelled."
    except Exception as e:
        await session.rollback()
        logger.error(f"logic_cancel_booking {booking_number}: {e}", exc_info=True)
        return (
            f"ERROR cancelling {booking_number}: database error — {type(e).__name__}. "
            "Please try again one at a time."
        )


async def logic_update_room_price(session, user, room_name: str, new_price: float) -> str:
    """Updates the base price of a room type. Money-affecting → OWNER/MANAGER only."""
    # RBAC: requires_confirmation gates approval, not role — enforce role here too.
    if not _role_allows_destructive(user):
        return _PERMISSION_DENIED
    # SECURITY: Input validation
    if new_price < 0:
        return "ERROR: Price cannot be negative."
    if new_price > 1000000:
        return "ERROR: Price seems unreasonably high. Maximum allowed is 10,00,000."
    
    query = select(RoomType).where(
        RoomType.hotel_id == user.hotel_id,
        RoomType.name.ilike(f"%{room_name}%")
    )
    result = await session.execute(query)
    room = result.scalars().first()
    
    if not room:
        return f"Room '{room_name}' not found."
    
    old_price = room.base_price
    room.base_price = new_price
    session.add(room)
    await session.commit()
    await session.refresh(room)
    
    logger.info(f"Room price updated: {room.name} from {old_price} to {new_price} by hotel {user.hotel_id}")
    return f"SUCCESS: Updated {room.name} price from {old_price} to {new_price}."


async def logic_create_promo_code(session, user, code: str, discount_percent: int) -> str:
    """Creates a new promo code. Money-affecting → OWNER/MANAGER only."""
    # RBAC: requires_confirmation gates approval, not role — enforce role here too.
    if not _role_allows_destructive(user):
        return _PERMISSION_DENIED
    # SECURITY: Input validation
    if not code or len(code) < 3:
        return "ERROR: Promo code must be at least 3 characters."
    if len(code) > 20:
        return "ERROR: Promo code cannot exceed 20 characters."
    if not code.isalnum():
        return "ERROR: Promo code must be alphanumeric only."
    if discount_percent < 1 or discount_percent > 100:
        return "ERROR: Discount must be between 1% and 100%."
    
    # Check if exists
    query = select(PromoCode).where(
        PromoCode.hotel_id == user.hotel_id,
        PromoCode.code == code.upper()
    )
    result = await session.execute(query)
    existing = result.scalars().first()
    
    if existing:
        return f"Promo code '{code}' already exists."
    
    new_promo = PromoCode(
        hotel_id=user.hotel_id,
        code=code.upper(),
        discount_value=discount_percent,
        is_active=True
    )
    session.add(new_promo)
    await session.commit()
    
    logger.info(f"Promo code created: {code.upper()} with {discount_percent}% discount for hotel {user.hotel_id}")
    return f"SUCCESS: Created promo code '{code.upper()}' with {discount_percent}% discount."

