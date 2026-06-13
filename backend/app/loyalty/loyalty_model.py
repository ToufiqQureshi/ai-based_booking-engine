"""
Loyalty Program Models
"""
from sqlmodel import SQLModel, Field
from typing import Optional
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

    # Milestone: after N completed bookings, reward triggers
    milestone_bookings: int = Field(default=5)

    # Reward type: percentage | fixed_amount | free_night
    reward_type: str = Field(default="percentage")
    reward_value: float = Field(default=10.0)  # % or ₹ amount
    reward_description: Optional[str] = None   # e.g. "Get 1 Free Night"

    # Popup message hotelier writes
    popup_title: str = Field(default="You're Almost There!")
    popup_message: str = Field(default="Book {remaining} more room(s) and unlock your reward!")

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

