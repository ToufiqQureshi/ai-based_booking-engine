"""
Helper functions for public booking creation:
  - generate_booking_number: unique human-readable booking ref
  - _update_guest_loyalty: update counters + mint reward promos on milestones
"""
import logging
import secrets
from datetime import datetime, date as _date

from sqlmodel import select

from app.core.time import utcnow
from app.loyalty.loyalty_model import LoyaltyProgram, GuestLoyalty
from app.rate_plans.promo import PromoCode

logger = logging.getLogger(__name__)

import uuid


def generate_booking_number() -> str:
    """Unique booking reference in format BK{YYYYMMDD}{6-hex}."""
    timestamp = utcnow().strftime("%Y%m%d")
    unique_part = str(uuid.uuid4())[:6].upper()
    return f"BK{timestamp}{unique_part}"


async def _update_guest_loyalty(
    session,
    hotel_id: str,
    guest_email: str,
    total_amount: float,
    rooms_count: int,
) -> None:
    """
    Called every time a booking moves to CONFIRMED status.
    Updates GuestLoyalty counters and — when a milestone is hit — creates
    a single-use PromoCode so the loyalty-check endpoint can hand it to the guest.
    Runs inside the calling session; caller is responsible for commit.

    Errors are swallowed so loyalty tracking never breaks a booking confirmation.
    """
    try:
        prog_res = await session.execute(
            select(LoyaltyProgram).where(
                LoyaltyProgram.hotel_id == hotel_id,
                LoyaltyProgram.is_active == True,
            )
        )
        program = prog_res.scalar_one_or_none()
        if not program:
            return

        loyal_res = await session.execute(
            select(GuestLoyalty).where(
                GuestLoyalty.guest_email == guest_email,
                GuestLoyalty.hotel_id == hotel_id,
            )
        )
        loyal = loyal_res.scalar_one_or_none()
        if not loyal:
            loyal = GuestLoyalty(hotel_id=hotel_id, guest_email=guest_email)
            session.add(loyal)

        loyal.total_completed_bookings += 1
        loyal.total_rooms_booked += rooms_count
        loyal.total_spend = float(loyal.total_spend) + total_amount
        loyal.last_booking_at = datetime.utcnow()
        loyal.updated_at = datetime.utcnow()

        # Award points if the hotel's points wallet is enabled.
        if getattr(program, "points_enabled", False) and (program.points_per_currency or 0) > 0:
            loyal.points_balance = float(loyal.points_balance) + total_amount * program.points_per_currency

        session.add(loyal)

        milestone = program.milestone_bookings or 5
        if milestone > 0 and loyal.total_completed_bookings % milestone == 0:
            code = f"LOYAL-{secrets.token_hex(4).upper()}-{loyal.total_completed_bookings}"
            disc_type = "percentage" if program.reward_type == "percentage" else "fixed_amount"
            disc_value = program.reward_value if program.reward_type != "free_night" else 100.0
            if program.reward_type == "free_night":
                disc_type = "percentage"

            session.add(PromoCode(
                hotel_id=hotel_id,
                code=code,
                description=f"Loyalty reward for {guest_email} — {program.reward_description or program.program_name}",
                discount_type=disc_type,
                discount_value=disc_value,
                max_usage=1,
                current_usage=0,
                is_active=True,
                end_date=_date.fromordinal(_date.today().toordinal() + 180),
            ))
            loyal.rewards_earned += 1
            session.add(loyal)
            logger.info(
                f"Loyalty milestone reached: hotel={hotel_id} guest={guest_email} "
                f"bookings={loyal.total_completed_bookings} coupon={code}"
            )
    except Exception as exc:
        logger.warning(f"_update_guest_loyalty failed for {guest_email}@{hotel_id}: {exc}")
