"""
Promo Code Model
"""
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, date
import uuid

class PromoCode(SQLModel, table=True):
    __tablename__ = "promo_codes"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)
    code: str = Field(index=True)
    
    description: Optional[str] = None
    discount_type: str = Field(default="percentage") # percentage, fixed_amount
    discount_value: float

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    max_usage: Optional[int] = None
    current_usage: int = Field(default=0)

    is_active: bool = Field(default=True)

    # Seasonal promotion controls. The hotelier picks the behaviour:
    #   auto_apply=False → classic coupon: guest must type the code (default).
    #   auto_apply=True  → automatic date-based deal: applied server-side within
    #                      the start/end window with no code, and surfaced to
    #                      guests as a banner using `name`.
    auto_apply: bool = Field(default=False, index=True)
    name: Optional[str] = None  # display label / banner text for seasonal deals

    created_at: datetime = Field(default_factory=datetime.utcnow)

