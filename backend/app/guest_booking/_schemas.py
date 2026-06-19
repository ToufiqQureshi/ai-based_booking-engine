"""
Pydantic schemas for the public booking widget.
Kept separate so route handlers stay focused on business logic.
"""
from datetime import date
from typing import List, Optional

import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.rooms.room import RoomTypeRead


def strip_html_tags(value):
    """Strip angle-bracket tags from guest-supplied text to block stored XSS.
    Non-str values pass through unchanged so type validation still runs."""
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]*>', '', value).strip()


class RateOption(BaseModel):
    id: str                          # rate_plan_id
    name: str                        # rate_plan_name e.g. "Room Only", "Breakfast Included"
    meal_plan_code: str
    price_per_night: float
    total_price: float
    inclusions: List[str]
    is_refundable: bool = True
    cancellation_policy: Optional[str] = None
    savings_text: Optional[str] = None    # e.g. "Save INR 2,000"
    is_package: bool = False
    image_url: Optional[str] = None


class PublicRoomSearchResult(RoomTypeRead):
    """Room type extended with calculated price and live availability for public search."""
    available_rooms: int
    price_starting_at: float
    rate_options: List[RateOption]


class PublicGuestCreate(BaseModel):
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    email: EmailStr = Field(max_length=255)
    phone: str = Field(max_length=20)
    nationality: str = Field(default="IN", max_length=2)
    id_type: str = Field(default="passport", max_length=50)
    id_number: str = Field(default="PENDING", max_length=100)

    @field_validator("first_name", "last_name", "phone", "id_number", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)


class PublicRoomBooking(BaseModel):
    room_type_id: str
    room_type_name: str
    price_per_night: float
    total_price: float
    guests: int = 1
    rate_plan_id: Optional[str] = None
    rate_plan_name: Optional[str] = None


class PublicAddOn(BaseModel):
    id: str
    name: str
    price: float


class PublicBookingCreate(BaseModel):
    check_in: date
    check_out: date
    guest: PublicGuestCreate
    rooms: List[PublicRoomBooking]
    addons: List[PublicAddOn] = []
    special_requests: Optional[str] = Field(default=None, max_length=2000)
    promo_code: Optional[str] = None
    payment_method: Optional[str] = None
    # "ai_agent" when the guest arrived via an AI-concierge booking link
    source: Optional[str] = None
    redeem_points: Optional[float] = None
    claimed_offer_ids: List[str] = []

    @field_validator("special_requests", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)


class PublicBookingResponse(BaseModel):
    id: str
    booking_number: str
    status: str
    check_in: date
    check_out: date
    total_amount: float
    subtotal_amount: float = 0.0
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    tax_details: dict = {}
    guest: dict
    rooms: List[dict]
    addons: List[dict] = []


class LoyaltyCheckRequest(BaseModel):
    email: str
    hotel_id: str


class LoyaltyOfferCheckRequest(BaseModel):
    hotel_id: str
    room_type_id: Optional[str] = None
    nights: Optional[int] = None        # None / 0 → guest hasn't picked dates yet


class LoyaltyOfferCheckResponse(BaseModel):
    has_offer: bool = False
    needs_dates: bool = False           # true when an offer exists but nights unknown
    offer_id: Optional[str] = None
    title: Optional[str] = None
    min_nights: int = 0
    current_nights: int = 0
    nights_remaining: int = 0           # 0 when unlocked
    unlocked: bool = False
    reward_type: Optional[str] = None
    reward_value: float = 0.0
    reward_label: Optional[str] = None
    nudge_title: Optional[str] = None
    nudge_message: Optional[str] = None
    # Hotelier-controlled presentation of the unlocked offer on the room card.
    room_type_id: Optional[str] = None  # which room this offer is scoped to (None = all)
    apply_mode: str = "auto"            # auto | manual_claim
    display_style: str = "banner"      # banner | badge
    unlocked_message: Optional[str] = None  # custom room-card upsell text


class LoyaltyCheckResponse(BaseModel):
    is_repeat_guest: bool
    message: str
    coupon_code: Optional[str] = None
    discount_text: Optional[str] = None
    show_milestone_popup: bool = False
    milestone_popup_title: Optional[str] = None
    milestone_popup_message: Optional[str] = None
    bookings_completed: int = 0
    bookings_to_reward: int = 0
    reward_description: Optional[str] = None
    points_balance: float = 0.0


class GuestCancelRequest(BaseModel):
    booking_number: str
    email: str


class GuestCancelInfoResponse(BaseModel):
    booking_number: str
    guest_name: str
    check_in: date
    check_out: date
    rooms: List[dict]
    total_amount: float
    paid_amount: float
    cancellation_policy: str
    is_refundable: bool
    cancellation_hours: int
    potential_fee: float
    potential_refund: float
    refund_status: str
    status: str
    cancellation_mode: str
