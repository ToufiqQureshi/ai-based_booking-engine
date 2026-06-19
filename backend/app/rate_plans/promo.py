"""
Promo Code Model
"""
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, date
from pydantic import field_validator
import uuid
import re

def strip_html_tags(value: str) -> str:
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]*>', '', value).strip()

class PromoCode(SQLModel, table=True):
    __tablename__ = "promo_codes"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)
    code: str = Field(index=True, max_length=50)
    
    description: Optional[str] = Field(default=None, max_length=500)
    discount_type: str = Field(default="percentage", max_length=20) # percentage, fixed_amount
    discount_value: float = Field(ge=0, le=10000000)

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    max_usage: Optional[int] = Field(default=None, ge=1, le=1000000)
    current_usage: int = Field(default=0, ge=0)

    is_active: bool = Field(default=True)

    # Seasonal promotion controls. The hotelier picks the behaviour:
    #   auto_apply=False → classic coupon: guest must type the code (default).
    #   auto_apply=True  → automatic date-based deal: applied server-side within
    #                      the start/end window with no code, and surfaced to
    #                      guests as a banner using `name`.
    auto_apply: bool = Field(default=False, index=True)
    name: Optional[str] = Field(default=None, max_length=150)  # display label / banner text for seasonal deals

    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("code", "description", "discount_type", "name", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)

