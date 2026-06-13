"""
Payment Models
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIAL_REFUND = "partial_refund"

class PaymentBase(SQLModel):
    booking_id: str = Field(foreign_key="bookings.id", index=True)
    amount: float
    currency: str = "INR"
    status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    payment_method: Optional[str] = None
    gateway_reference: Optional[str] = None
    transaction_id: Optional[str] = None
    reference_number: Optional[str] = None

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
