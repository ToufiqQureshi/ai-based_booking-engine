"""
Payment Models
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
from enum import Enum
from pydantic import field_validator
import uuid
import re

def strip_html_tags(value: str) -> str:
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]*>', '', value).strip()

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIAL_REFUND = "partial_refund"

class PaymentBase(SQLModel):
    booking_id: str = Field(foreign_key="bookings.id", index=True)
    amount: float = Field(ge=0, le=100000000)
    currency: str = Field(default="INR", max_length=10)
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    payment_method: Optional[str] = Field(default=None, max_length=50)
    gateway_reference: Optional[str] = Field(default=None, max_length=255)
    # PAY-2: unique so a gateway transaction can never be recorded twice (webhook
    # replay / verify+webhook race). NULLs are allowed (multiple NULLs are fine in
    # Postgres) for non-gateway/manual payments that have no transaction id.
    transaction_id: Optional[str] = Field(default=None, unique=True, index=True, max_length=255)
    reference_number: Optional[str] = Field(default=None, max_length=255)

    @field_validator("currency", "payment_method", "gateway_reference", "transaction_id", "reference_number", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)

class Payment(PaymentBase, table=True):
    __tablename__ = "payments"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    booking: "Booking" = Relationship(back_populates="payments")


class PaymentCreate(PaymentBase):
    pass

class PaymentRead(PaymentBase):
    id: str
    hotel_id: str
    created_at: datetime
    # We might want to include booking number in response
    booking_number: Optional[str] = None
    guest_name: Optional[str] = None
