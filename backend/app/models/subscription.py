from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime
import uuid

if TYPE_CHECKING:
    from app.models.hotel import Hotel

class Subscription(SQLModel, table=True):
    __tablename__ = "subscriptions"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    plan_name: str = Field(default="Basic") # Basic, Pro, Enterprise
    status: str = Field(default="active") # active, expired, cancelled
    payment_status: str = Field(default="paid") # paid, pending, failed
    
    start_date: datetime = Field(default_factory=datetime.utcnow)
    end_date: datetime
    
    amount: float = Field(default=0.0)
    currency: str = Field(default="INR")
    
    # Quotas & Credits governance
    whatsapp_credits: int = Field(default=1000)
    sms_credits: int = Field(default=1000)
    ai_usage_limit: int = Field(default=50000) # Tokens / requests limit
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    hotel: "Hotel" = Relationship(back_populates="subscription")
