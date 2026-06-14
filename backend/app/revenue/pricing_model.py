"""
Dynamic pricing rules — the hotelier decides WHEN and HOW MUCH the price moves.

We never hard-code a pricing strategy. The hotelier creates rules (occupancy,
day-of-week, lead-time / last-minute, seasonal date windows) and the engine in
`pricing_engine.py` stacks them deterministically on top of the resolved base
nightly rate.

Multi-tenant: every rule is scoped to a `hotel_id`. `room_type_id == None`
means the rule applies to every room type in the hotel; a set value scopes it
to one room type (e.g. "Deluxe weekends +15%").
"""
import uuid
from datetime import datetime, date
from typing import Optional, List

from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


# Allowed rule types — kept as plain strings (validated in the router) so the
# table stays migration-friendly and create_all-compatible.
RULE_TYPES = {"occupancy", "day_of_week", "lead_time", "seasonal"}
ADJUSTMENT_TYPES = {"percentage", "fixed_amount"}


class PricingRule(SQLModel, table=True):
    __tablename__ = "pricing_rules"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)
    # None → applies to all room types in the hotel; set → single room type.
    room_type_id: Optional[str] = Field(default=None, foreign_key="room_types.id", index=True)

    is_active: bool = Field(default=True)
    name: str = Field(default="Untitled rule")
    rule_type: str = Field(default="occupancy")  # occupancy | day_of_week | lead_time | seasonal

    # How the price moves when the rule fires.
    adjustment_type: str = Field(default="percentage")  # percentage | fixed_amount
    adjustment_value: float = Field(default=0.0)         # +20 (=+20%) or -500 (=-₹500)

    # Lower runs first; later rules stack on the already-adjusted price.
    priority: int = Field(default=0)

    # ── Condition parameters (only the ones relevant to rule_type are used) ──
    # occupancy: fire when occupancy% for that room/date is within [min, max].
    occupancy_min: Optional[float] = Field(default=None)
    occupancy_max: Optional[float] = Field(default=None)
    # day_of_week: list of weekday ints, Monday=0 … Sunday=6.
    days_of_week: List[int] = Field(default_factory=list, sa_column=Column(JSON))
    # lead_time: days between "today" and check-in within [min, max].
    # Early-bird → set lead_time_min (e.g. 60+). Last-minute → set lead_time_max (e.g. 0-3).
    lead_time_min: Optional[int] = Field(default=None)
    lead_time_max: Optional[int] = Field(default=None)
    # seasonal: fire when the stay date falls within [date_from, date_to].
    date_from: Optional[date] = Field(default=None)
    date_to: Optional[date] = Field(default=None)

    # Per-rule guard rails — the adjusted price is clamped into this band.
    min_price: Optional[float] = Field(default=None)
    max_price: Optional[float] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
