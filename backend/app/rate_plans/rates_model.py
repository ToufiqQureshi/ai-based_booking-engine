"""
Rates Models
Rate Plans and Room Rates (daily pricing)
"""
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date
import uuid

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.room import RoomType

class RatePlanBase(SQLModel):
    name: str
    description: Optional[str] = None
    meal_plan: str = Field(default="EP")  # EP, CP, MAP, AP (European, Continental, Modified American, American)
    price_adjustment: float = Field(default=0.0) # Added amount on top of base price
    is_refundable: bool = True
    cancellation_hours: int = 24
    is_active: bool = True
    # New Fields
    min_los: int = Field(default=1, description="Minimum Length of Stay")
    advance_purchase_days: int = Field(default=0, description="Book X days in advance for this rate")
    inclusions: list = Field(default_factory=list, sa_column=Column(JSON))  # e.g. ["Free WiFi", "Airport Pickup"]
    is_package: bool = Field(default=False)
    package_items: list = Field(default_factory=list, sa_column=Column(JSON)) # Specific bundle items for packages
    market_price: Optional[float] = Field(default=None, description="Original price for strike-through display")
    image_url: Optional[str] = None
    # Optional validity window — lets a package run only for a season/date range.
    # NULL on both sides means always available.
    valid_from: Optional[date] = Field(default=None, description="Package bookable from this date")
    valid_to: Optional[date] = Field(default=None, description="Package bookable until this date")

class RatePlan(RatePlanBase, table=True):
    __tablename__ = "rate_plans"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    hotel: "Hotel" = Relationship(back_populates="rate_plans")
    rates: List["RoomRate"] = Relationship(back_populates="rate_plan")

class RatePlanCreate(RatePlanBase):
    pass

class RatePlanRead(RatePlanBase):
    id: str
    hotel_id: str
    created_at: datetime


class RoomRate(SQLModel, table=True):
    __tablename__ = "room_rates"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    room_type_id: str = Field(foreign_key="room_types.id", index=True)
    rate_plan_id: Optional[str] = Field(default=None, foreign_key="rate_plans.id", index=True, nullable=True)
    
    date_from: date = Field(index=True)
    date_to: date = Field(index=True)
    price: float
    
    # Relationships
    rate_plan: Optional[RatePlan] = Relationship(back_populates="rates")
    room_type: "RoomType" = Relationship(back_populates="rates")

class RoomRateCreate(SQLModel):
    room_type_id: str
    rate_plan_id: Optional[str] = None
    date_from: date
    date_to: date
    price: float

class RoomRateRead(SQLModel):
    id: str
    room_type_id: str
    rate_plan_id: Optional[str]
    date_from: date
    date_to: date
    price: float
