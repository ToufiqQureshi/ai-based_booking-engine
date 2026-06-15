from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from app.core.deps import DbSession, CurrentUser, require_hotel_role
from app.loyalty.loyalty_model import LoyaltyProgram, GuestLoyalty, LoyaltyOffer
from app.rooms.room import RoomType

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

@router.get("/program", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER", "STAFF"))])
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


@router.get("/guests", response_model=List[GuestLoyaltySummary], dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
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


# ── Points Wallet Config ──────────────────────────────────────────────────────

class PointsConfigUpdate(BaseModel):
    points_enabled: Optional[bool] = None
    points_per_currency: Optional[float] = None   # ₹1 spent → N points
    point_value: Optional[float] = None           # 1 point → ₹X on redemption


@router.put("/points-config", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_points_config(
    data: PointsConfigUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Configure the hotel's points earn/redeem rates. Lives on the hotel's program."""
    result = await session.execute(
        select(LoyaltyProgram).where(LoyaltyProgram.hotel_id == current_user.hotel_id)
    )
    program = result.scalar_one_or_none()
    if not program:
        program = LoyaltyProgram(hotel_id=current_user.hotel_id)
        session.add(program)

    for field, value in data.model_dump(exclude_none=True).items():
        if field in ("points_per_currency", "point_value") and value < 0:
            raise HTTPException(status_code=400, detail=f"{field} cannot be negative")
        setattr(program, field, value)
    program.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(program)
    return {
        "points_enabled": program.points_enabled,
        "points_per_currency": program.points_per_currency,
        "point_value": program.point_value,
    }


# ── Stay Offers (room-specific, night-threshold) ──────────────────────────────

class LoyaltyOfferCreate(BaseModel):
    room_type_id: Optional[str] = None          # None = applies to all rooms
    is_active: bool = True
    title: str = "Stay Longer, Save More"
    min_nights: int = 5
    reward_type: str = "percentage"             # percentage | fixed_amount | free_night
    reward_value: float = 10.0
    nudge_title: str = "Stay a little longer!"
    nudge_message: str = "Stay {remaining} more night(s) and unlock {reward}!"


class LoyaltyOfferUpdate(BaseModel):
    room_type_id: Optional[str] = None
    is_active: Optional[bool] = None
    title: Optional[str] = None
    min_nights: Optional[int] = None
    reward_type: Optional[str] = None
    reward_value: Optional[float] = None
    nudge_title: Optional[str] = None
    nudge_message: Optional[str] = None


_VALID_REWARD_TYPES = {"percentage", "fixed_amount", "free_night"}


async def _assert_room_belongs_to_hotel(session, room_type_id: Optional[str], hotel_id: str):
    """Tenant isolation: a room-scoped offer must reference this hotel's room."""
    if not room_type_id:
        return
    rt = await session.get(RoomType, room_type_id)
    if not rt or rt.hotel_id != hotel_id:
        raise HTTPException(status_code=400, detail="Room type does not belong to this hotel")


@router.get("/offers", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER", "STAFF"))])
async def list_offers(current_user: CurrentUser, session: DbSession):
    """List all stay offers for the hotel."""
    result = await session.execute(
        select(LoyaltyOffer)
        .where(LoyaltyOffer.hotel_id == current_user.hotel_id)
        .order_by(LoyaltyOffer.created_at.desc())
    )
    return result.scalars().all()


@router.post("/offers", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_offer(
    data: LoyaltyOfferCreate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Create a stay offer, optionally scoped to a single room type."""
    if data.reward_type not in _VALID_REWARD_TYPES:
        raise HTTPException(status_code=400, detail="Invalid reward_type")
    if data.min_nights < 1:
        raise HTTPException(status_code=400, detail="min_nights must be at least 1")
    await _assert_room_belongs_to_hotel(session, data.room_type_id, current_user.hotel_id)

    offer = LoyaltyOffer(
        hotel_id=current_user.hotel_id,
        chain_id=current_user.chain_id,
        room_type_id=data.room_type_id,
        is_active=data.is_active,
        title=data.title,
        min_nights=data.min_nights,
        reward_type=data.reward_type,
        reward_value=data.reward_value,
        nudge_title=data.nudge_title,
        nudge_message=data.nudge_message,
    )
    session.add(offer)
    await session.commit()
    await session.refresh(offer)
    return offer


@router.put("/offers/{offer_id}", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_offer(
    offer_id: str,
    data: LoyaltyOfferUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Update a stay offer. IDOR-guarded: must belong to the caller's hotel."""
    offer = await session.get(LoyaltyOffer, offer_id)
    if not offer or offer.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Offer not found")

    updates = data.model_dump(exclude_none=True)
    if "reward_type" in updates and updates["reward_type"] not in _VALID_REWARD_TYPES:
        raise HTTPException(status_code=400, detail="Invalid reward_type")
    if "min_nights" in updates and updates["min_nights"] < 1:
        raise HTTPException(status_code=400, detail="min_nights must be at least 1")
    if "room_type_id" in updates:
        await _assert_room_belongs_to_hotel(session, updates["room_type_id"], current_user.hotel_id)

    for field, value in updates.items():
        setattr(offer, field, value)
    offer.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(offer)
    return offer


@router.delete("/offers/{offer_id}", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_offer(
    offer_id: str,
    current_user: CurrentUser,
    session: DbSession,
):
    """Delete a stay offer. IDOR-guarded."""
    offer = await session.get(LoyaltyOffer, offer_id)
    if not offer or offer.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Offer not found")
    await session.delete(offer)
    await session.commit()
    return {"status": "deleted", "id": offer_id}

