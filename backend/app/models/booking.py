"""
Booking & Guest Models
Complete booking flow ke liye.
Frontend Booking, Guest, BookingRoom interfaces se match.
"""
from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date
from enum import Enum
import uuid

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.payment import Payment


class BookingStatus(str, Enum):
    """Booking statuses - Frontend BookingStatus se match"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCEL_REQUESTED = "cancel_requested"


class BookingSource(str, Enum):
    """Booking sources"""
    DIRECT = "direct"
    BOOKING_ENGINE = "booking_engine"
    MANUAL = "manual"


class GuestBase(SQLModel):
    """Guest base fields"""
    first_name: str
    last_name: str
    email: str = Field(index=True)
    phone: Optional[str] = None
    nationality: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    address: Optional[str] = None


class Guest(GuestBase, table=True):
    """Guest table - Frontend Guest interface se match"""
    __tablename__ = "guests"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    bookings: List["Booking"] = Relationship(back_populates="guest")


class GuestCreate(GuestBase):
    """Guest create schema"""
    pass


class GuestRead(GuestBase):
    """Guest response"""
    id: str
    hotel_id: str
    created_at: datetime


class BookingRoom(SQLModel):
    """Embedded booking room - Frontend BookingRoom se match"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_type_id: str
    room_type_name: str
    rate_plan_id: str
    rate_plan_name: str
    guests: int = 1
    children: int = 0
    price_per_night: float
    total_price: float
    cancellation_policy: Optional[str] = None


class BookingBase(SQLModel):
    """Booking base fields"""
    check_in: date = Field(index=True)
    check_out: date = Field(index=True)
    status: BookingStatus = Field(default=BookingStatus.PENDING, index=True)
    total_amount: float = Field(ge=0)
    paid_amount: float = Field(default=0, ge=0)
    special_requests: Optional[str] = None
    promo_code: Optional[str] = None
    source: BookingSource = Field(default=BookingSource.DIRECT)
    cancellation_fee: float = Field(default=0.0, ge=0)
    refund_amount: float = Field(default=0.0, ge=0)
    refund_status: Optional[str] = Field(default="none")
    subtotal_amount: float = Field(default=0.0)
    tax_amount: float = Field(default=0.0)
    discount_amount: float = Field(default=0.0)


class Booking(BookingBase, table=True):
    """
    Booking table - Frontend Booking interface se match.
    Rooms JSON array mein store hote hain.
    """
    __tablename__ = "bookings"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    guest_id: str = Field(foreign_key="guests.id", index=True)
    booking_number: str = Field(unique=True, index=True)
    
    # Rooms JSON array mein
    rooms: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    # Addons JSON array mein
    addons: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    tax_details: dict = Field(default_factory=dict, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    hotel: Optional["Hotel"] = Relationship(back_populates="bookings")
    payments: List["Payment"] = Relationship(back_populates="booking")
    guest: Optional["Guest"] = Relationship(back_populates="bookings")


class BookingCreate(SQLModel):
    """Booking creation"""
    check_in: date
    check_out: date
    guest: GuestCreate
    rooms: List[dict]
    addons: List[dict] = []
    special_requests: Optional[str] = None
    promo_code: Optional[str] = None


class BookingRead(BookingBase):
    """Booking response - Frontend Booking match"""
    id: str
    hotel_id: str
    booking_number: str
    guest: GuestRead
    rooms: List[dict]
    addons: List[dict] = []
    created_at: datetime
    updated_at: datetime


class BookingUpdate(SQLModel):
    """Booking status update"""
    status: Optional[BookingStatus] = None
    paid_amount: Optional[float] = None
    special_requests: Optional[str] = None

