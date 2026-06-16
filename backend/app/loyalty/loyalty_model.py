"""
Loyalty Program Models
"""
from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, List
from datetime import datetime
import uuid


class LoyaltyProgram(SQLModel, table=True):
    __tablename__ = "loyalty_programs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True, unique=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)

    is_active: bool = Field(default=False)
    program_name: str = Field(default="Loyalty Program")
    description: Optional[str] = None

    # Legacy single milestone fields (kept for backward compatibility during migration)
    milestone_bookings: int = Field(default=5)
    reward_type: str = Field(default="percentage")
    reward_value: float = Field(default=10.0)  # % or ₹ amount
    reward_description: Optional[str] = None   # e.g. "Get 1 Free Night"

    # New multiple milestones configuration
    # Array of dicts: {"milestone_bookings": int, "reward_type": str, "reward_value": float, "reward_description": str}
    milestones: List[dict] = Field(default=[], sa_column=Column(JSON))

    # Popup message hotelier writes (used generically or per milestone if needed)
    popup_title: str = Field(default="You're Almost There!")
    popup_message: str = Field(default="Book {remaining} more room(s) and unlock your reward!")

    # Points wallet config (hotel-wide). Hotelier decides earn & redeem rates.
    #   points_enabled      — turn the points wallet on/off
    #   points_per_currency — points earned per 1 unit of currency spent (₹1 → N points)
    #   point_value         — redemption value of 1 point in currency (1 point → ₹X)
    points_enabled: bool = Field(default=False)
    points_per_currency: float = Field(default=0.0)
    point_value: float = Field(default=0.0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LoyaltyOffer(SQLModel, table=True):
    """
    Stay-based upsell offers, optionally scoped to a single room type.
    Unlike LoyaltyProgram (one per hotel, repeat-guest retention), a hotel can
    have MANY offers — e.g. "Stay 5 nights in Deluxe, get 20% off".
    A NULL room_type_id means the offer applies to every room in the hotel.
    """
    __tablename__ = "loyalty_offers"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)
    room_type_id: Optional[str] = Field(default=None, foreign_key="room_types.id", index=True)

    # When a chain admin broadcasts one offer to every property, each hotel gets
    # its own LoyaltyOffer row sharing the same broadcast_id. This lets us list
    # and delete a broadcast as a single unit while the per-hotel booking flow
    # keeps reading offers by hotel_id unchanged.
    broadcast_id: Optional[str] = Field(default=None, index=True)

    is_active: bool = Field(default=True)
    title: str = Field(default="Stay Longer, Save More")

    # Trigger: minimum nights in a single booking to unlock the reward
    min_nights: int = Field(default=5)

    # Reward type: percentage | fixed_amount | free_night
    reward_type: str = Field(default="percentage")
    reward_value: float = Field(default=10.0)

    # Hotelier controls when the nudge popup starts appearing.
    # e.g. nudge_from_nights=3 on a min_nights=5 offer means guests who pick
    # only 1-2 nights see nothing; guests at 3-4 nights see the popup.
    # Default 1 = show to everyone regardless of selected nights.
    nudge_from_nights: int = Field(default=1)

    # Nudge popup shown when the guest is below the night threshold.
    # Use {remaining} for nights left and {reward} for the reward label.
    nudge_title: str = Field(default="Stay a little longer!")
    nudge_message: str = Field(default="Stay {remaining} more night(s) and unlock {reward}!")

    # ── Hotelier-controlled presentation of the unlocked offer ────────────────
    # apply_mode: how the discount applies once the guest meets min_nights.
    #   "auto"         → price auto-discounts on the eligible room (strikethrough
    #                    original + new offer price), no guest action needed.
    #   "manual_claim" → guest taps a "Claim" button on the room to apply it.
    apply_mode: str = Field(default="auto")

    # display_style: how the room-card notification renders for this offer.
    #   "banner" → full-width gradient banner inside the room card.
    #   "badge"  → compact corner badge that reveals the text on hover/tap.
    display_style: str = Field(default="banner")

    # unlocked_message: hotelier's custom text on the room card driving the
    # room-specific upsell, e.g. "Book this room for 5 nights to get 20% off".
    # Supports {nights} and {reward} placeholders.
    unlocked_message: str = Field(default="Book this room for {nights} nights to unlock {reward}!")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GuestLoyalty(SQLModel, table=True):
    """Tracks per-guest loyalty progress per hotel or chain."""
    __tablename__ = "guest_loyalty"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)
    guest_email: str = Field(index=True)

    total_completed_bookings: int = Field(default=0)
    total_rooms_booked: int = Field(default=0)
    total_spend: float = Field(default=0.0)
    rewards_earned: int = Field(default=0)
    points_balance: float = Field(default=0.0)
    last_booking_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

