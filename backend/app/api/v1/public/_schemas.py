"""
Pydantic schemas for the public booking widget.
Kept separate so route handlers stay focused on business logic.
"""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from app.models.room import RoomTypeRead


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
    first_name: str
    last_name: str
    email: str
    phone: str
    nationality: str = "IN"
    id_type: str = "passport"
    id_number: str = "PENDING"


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
    special_requests: Optional[str] = None
    promo_code: Optional[str] = None
    payment_method: Optional[str] = None
    # "ai_agent" when the guest arrived via an AI-concierge booking link
    source: Optional[str] = None
    redeem_points: Optional[float] = None


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
