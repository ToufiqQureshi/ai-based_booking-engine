"""
Hotel Model
Multi-tenant core - har hotel ek tenant hai.
Frontend ke Hotel interface se match karta hai.
"""
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.room import RoomType
    from app.models.booking import Booking
    from app.models.booking import Booking
    from app.models.rates import RatePlan
    from app.models.subscription import Subscription


class Address(SQLModel):
    """Embedded address object - Frontend Address interface se match"""
    street: Optional[str] = None
    city: str
    state: Optional[str] = None
    country: str
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ContactInfo(SQLModel):
    """Embedded contact info - Frontend ContactInfo interface se match"""
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class HotelSettings(SQLModel):
    """Embedded settings - Frontend HotelSettings interface se match"""
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    check_in_time: str = "14:00"
    check_out_time: str = "11:00"
    cancellation_policy: Optional[str] = None
    payment_policy: Optional[str] = None
    child_policy: Optional[str] = None
    privacy_policy: Optional[str] = None
    important_info: Optional[str] = None
    notify_new_booking: bool = True
    notify_cancellation: bool = True



class HotelBase(SQLModel):
    """Base hotel fields"""
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    description: Optional[str] = None
    star_rating: Optional[int] = Field(default=None, ge=1, le=5)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(default="#3B82F6")
    
    # Feature Flags (Controlled by Super Admin)
    feature_rate_shopper: bool = Field(default=True)
    feature_ai_agent: bool = Field(default=True)
    feature_guest_bot: bool = Field(default=True)


class Hotel(HotelBase, table=True):
    """
    Database table for hotels.
    JSON columns for nested objects (address, contact, settings).
    """
    __tablename__ = "hotels"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    
    # JSON columns - SQLModel mein nested objects ko JSON mein store karte hain
    address: dict = Field(default_factory=lambda: {"city": "Unknown", "country": "India"}, sa_column=Column(JSON))
    contact: dict = Field(default_factory=dict, sa_column=Column(JSON))
    settings: dict = Field(default_factory=lambda: HotelSettings().model_dump(), sa_column=Column(JSON))
    
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # AI dynamic configurations
    ai_provider: Optional[str] = Field(default="groq")
    ai_api_key: Optional[str] = Field(default=None)

    # Relationships
    users: List["User"] = Relationship(back_populates="hotel")
    room_types: List["RoomType"] = Relationship(back_populates="hotel")
    bookings: List["Booking"] = Relationship(back_populates="hotel")
    rate_plans: List["RatePlan"] = Relationship(back_populates="hotel")
    subscription: Optional["Subscription"] = Relationship(back_populates="hotel")


class HotelCreate(SQLModel):
    """Hotel creation (usually during signup)"""
    name: str
    slug: Optional[str] = None  # Auto-generate if not provided


class HotelRead(HotelBase):
    """Response schema - Frontend Hotel interface se match"""
    id: str
    address: dict
    contact: dict
    settings: dict
    created_at: datetime
    updated_at: datetime


class HotelUpdate(SQLModel):
    """Partial update schema"""
    name: Optional[str] = None
    description: Optional[str] = None
    star_rating: Optional[int] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    address: Optional[dict] = None
    contact: Optional[dict] = None
    settings: Optional[dict] = None
    # Feature Flags
    feature_rate_shopper: Optional[bool] = None
    feature_ai_agent: Optional[bool] = None
    feature_guest_bot: Optional[bool] = None
    is_active: Optional[bool] = None
