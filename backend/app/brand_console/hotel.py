"""
Hotel Model
Multi-tenant core - har hotel ek tenant hai.
Frontend ke Hotel interface se match karta hai.
"""
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from pydantic import field_validator
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid
import re

if TYPE_CHECKING:
    from app.guests.user import User
    from app.rooms.room import RoomType
    from app.bookings.booking import Booking
    from app.rate_plans.rates import RatePlan
    from app.superadmin.subscriptions.subscription import Subscription
    from app.superadmin.chains.chain import Chain


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
    cancellation_mode: str = "instant"
    payment_policy: Optional[str] = None
    child_policy: Optional[str] = None
    privacy_policy: Optional[str] = None
    terms_conditions: Optional[str] = None
    important_info: Optional[str] = None
    gst_number: Optional[str] = None
    notify_new_booking: bool = True
    notify_cancellation: bool = True
    
    # Social Proof / Marketing Control
    show_viewers_count: bool = True
    show_last_booked: bool = True
    show_popular_badge: bool = True
    popular_badge_text: str = "Popular choice! {count} bookings this month"
    
    # STAAH & Multi-Room Booking Controls
    multi_room_cart: bool = True
    featured_room_type_id: Optional[str] = None

    # SMTP Configuration
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None

    # Custom Email Notification Configuration
    email_sender_name: Optional[str] = None
    email_sender_address: Optional[str] = None
    email_cc_list: Optional[str] = None
    email_signature: Optional[str] = None

    # WhatsApp Configuration
    whatsapp_api_key: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None

    # Custom Templates
    email_template_booking_confirmed: Optional[str] = None
    email_template_booking_cancelled: Optional[str] = None
    whatsapp_template_booking_confirmed: Optional[str] = None
    whatsapp_template_booking_cancelled: Optional[str] = None

    # Credits & Stats
    ai_whatsapp_credits: int = 100
    total_messages_sent: int = 0

    # Tax Configurations
    tax_name: str = "GST"
    room_tax_rate: float = Field(default=0.0, ge=0.0, le=100.0)
    room_tax_type: str = "exclusive"  # "inclusive" or "exclusive"
    room_tax_calculation_method: str = "flat"  # "flat" or "slab"
    room_tax_slabs: List[dict] = [
        {"from": 0.0, "to": 999.0, "rate": 0.0},
        {"from": 1000.0, "to": 7499.0, "rate": 12.0},
        {"from": 7500.0, "to": 999999.0, "rate": 18.0}
    ]
    addon_tax_rate: float = Field(default=0.0, ge=0.0, le=100.0)
    addon_tax_type: str = "exclusive"  # "inclusive" or "exclusive"

    @field_validator("tax_name", mode="before")
    @classmethod
    def strip_html_tax(cls, v: str) -> str:
        if v:
            return re.sub(r'<[^>]*>', '', v)
        return v



class HotelBase(SQLModel):
    """Base hotel fields"""
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    description: Optional[str] = None
    star_rating: Optional[int] = Field(default=None, ge=1, le=5)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(default="#d11026")
    amenities: List[str] = Field(default_factory=list, sa_column=Column(JSON)) # Property-level amenities like "Free Parking", "Pool"
    
    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_html_hotel(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return re.sub(r'<[^>]*>', '', v)
        return v

    # Feature Flags (Controlled by Super Admin)
    feature_ai_agent: bool = Field(default=False)
    feature_guest_bot: bool = Field(default=False)
    feature_ai_assistant: bool = Field(default=False)
    feature_new_booking: bool = Field(default=True)
    feature_color_palette: bool = Field(default=False)
    feature_custom_logo: bool = Field(default=False)
    feature_custom_widget: bool = Field(default=False)
    feature_google_ads: bool = Field(default=False)
    # Operational state
    is_paused: bool = Field(default=False)
    pause_reason: Optional[str] = Field(default=None)
    paused_at: Optional[datetime] = Field(default=None)
    
    # Chain Association
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)


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
    photos: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    videos: List[dict] = Field(default_factory=list, sa_column=Column(JSON))

    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # AI dynamic configurations
    ai_provider: Optional[str] = Field(default="groq")
    ai_api_key: Optional[str] = Field(default=None)
    ai_api_key_vault_id: Optional[str] = Field(default=None)  # Vault UUID replaces ai_api_key
    ai_model: Optional[str] = Field(default="llama-3.1-70b-versatile")
    ai_base_url: Optional[str] = Field(default=None)
    ai_max_tokens: Optional[int] = Field(default=None)
    
    # Relationships
    users: List["User"] = Relationship(
        back_populates="hotel", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    room_types: List["RoomType"] = Relationship(
        back_populates="hotel",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    bookings: List["Booking"] = Relationship(
        back_populates="hotel",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    rate_plans: List["RatePlan"] = Relationship(
        back_populates="hotel",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    subscription: Optional["Subscription"] = Relationship(
        back_populates="hotel",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    chain: Optional["Chain"] = Relationship(back_populates="hotels")


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
    photos: List[dict] = []
    videos: List[dict] = []
    amenities: List[str] = []
    created_at: datetime
    updated_at: datetime


class HotelUpdate(SQLModel):
    """Partial update schema"""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    star_rating: Optional[int] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    address: Optional[dict] = None
    contact: Optional[dict] = None
    settings: Optional[dict] = None
    photos: Optional[List[dict]] = None
    videos: Optional[List[dict]] = None
    # Feature Flags
    feature_ai_agent: Optional[bool] = None
    feature_guest_bot: Optional[bool] = None
    feature_ai_assistant: Optional[bool] = None
    feature_new_booking: Optional[bool] = None
    feature_color_palette: Optional[bool] = None
    feature_custom_logo: Optional[bool] = None
    feature_custom_widget: Optional[bool] = None
    feature_google_ads: Optional[bool] = None
    is_paused: Optional[bool] = None
    pause_reason: Optional[str] = None
    paused_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    chain_id: Optional[str] = None

    @field_validator("name", "description", mode="before")
    @classmethod
    def strip_html_hotel(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return re.sub(r'<[^>]*>', '', v)
        return v

    @field_validator("videos")
    @classmethod
    def _cap_property_videos(cls, v):
        # Max 5 property showcase videos.
        if v and len(v) > 5:
            raise ValueError("A property can have at most 5 videos")
        return v
