from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.core.deps import DbSession, CurrentUser, require_hotel_role
from app.loyalty.loyalty_model import LoyaltyProgram, GuestLoyalty

router = APIRouter()


# ── Request/Response Schemas ──────────────────────────────────────────────────

class LoyaltyProgramUpdate(BaseModel):
    is_active: Optional[bool] = None
    program_name: Optional[str] = None
    description: Optional[str] = None
    milestone_bookings: Optional[int] = None
    reward_type: Optional[str] = None       # percentage | fixed_amount | free_night
    reward_value: Optional[float] = None
    reward_description: Optional[str] = None
    popup_title: Optional[str] = None
    popup_message: Optional[str] = None


class GuestLoyaltySummary(BaseModel):
    guest_email: str
    total_completed_bookings: int
    total_rooms_booked: int
    total_spend: float
    rewards_earned: int
    last_booking_at: Optional[datetime]
    # computed
    bookings_to_next_reward: int
    reward_progress_pct: int


# ── Admin Endpoints ───────────────────────────────────────────────────────────

@router.get("/program")
async def get_loyalty_program(current_user: CurrentUser, session: DbSession):
    """Get or auto-create the hotel's loyalty program config."""
    result = await session.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.hotel_id == current_user.hotel_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        program = LoyaltyProgram(hotel_id=current_user.hotel_id)
        session.add(program)
        await session.commit()
        await session.refresh(program)
    return program


@router.put("/program", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_loyalty_program(
    data: LoyaltyProgramUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Update the hotel's loyalty program settings."""
    result = await session.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.hotel_id == current_user.hotel_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        program = LoyaltyProgram(hotel_id=current_user.hotel_id)
        session.add(program)

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(program, field, value)
    program.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(program)
    return program


@router.get("/guests", response_model=List[GuestLoyaltySummary])
async def list_loyal_guests(
    current_user: CurrentUser,
    session: DbSession,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List guests with loyalty data for this hotel."""
    program_result = await session.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.hotel_id == current_user.hotel_id)
    )
    program = program_result.scalar_one_or_none()
    milestone = program.milestone_bookings if program else 5

    result = await session.execute(
        select(GuestLoyalty)
        .where(GuestLoyalty.hotel_id == current_user.hotel_id)
        .order_by(GuestLoyalty.total_completed_bookings.desc())
        .offset(offset)
        .limit(limit)
    )
    guests = result.scalars().all()

    summaries = []
    for g in guests:
        bookings_since_last_reward = g.total_completed_bookings - (g.rewards_earned * milestone)
        remaining = max(0, milestone - bookings_since_last_reward)
        progress = min(100, int((bookings_since_last_reward / milestone) * 100)) if milestone > 0 else 0
        summaries.append(GuestLoyaltySummary(
            guest_email=g.guest_email,
            total_completed_bookings=g.total_completed_bookings,
            total_rooms_booked=g.total_rooms_booked,
            total_spend=g.total_spend,
            rewards_earned=g.rewards_earned,
            last_booking_at=g.last_booking_at,
            bookings_to_next_reward=remaining,
            reward_progress_pct=progress,
        ))
    return summaries

