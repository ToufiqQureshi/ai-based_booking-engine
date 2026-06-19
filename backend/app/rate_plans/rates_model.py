"""
Rates Models
Rate Plans and Room Rates (daily pricing)
"""
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date
from pydantic import field_validator
import uuid
import re

def strip_html_tags(value: str) -> str:
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]*>', '', value).strip()

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.room import RoomType

class RatePlanBase(SQLModel):
    name: str = Field(max_length=150)
    description: Optional[str] = Field(default=None, max_length=1000)
    meal_plan: str = Field(default="EP", max_length=20)  # EP, CP, MAP, AP
    price_adjustment: float = Field(default=0.0, ge=-1000000, le=1000000) # Added amount on top of base price
    is_refundable: bool = True
    cancellation_hours: int = Field(default=24, ge=0, le=8760)
    is_active: bool = True
    # New Fields
    min_los: int = Field(default=1, ge=1, le=365, description="Minimum Length of Stay")
    advance_purchase_days: int = Field(default=0, ge=0, le=365, description="Book X days in advance for this rate")
    inclusions: list = Field(default_factory=list, sa_column=Column(JSON))  # e.g. ["Free WiFi", "Airport Pickup"]
    is_package: bool = Field(default=False)
    package_items: list = Field(default_factory=list, sa_column=Column(JSON)) # Specific bundle items for packages
    market_price: Optional[float] = Field(default=None, ge=0, le=10000000, description="Original price for strike-through display")
    image_url: Optional[str] = Field(default=None, max_length=1000)
    # Optional validity window — lets a package run only for a season/date range.
    # NULL on both sides means always available.
    valid_from: Optional[date] = Field(default=None, description="Package bookable from this date")
    valid_to: Optional[date] = Field(default=None, description="Package bookable until this date")

    @field_validator("name", "description", "meal_plan", "image_url", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)

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
