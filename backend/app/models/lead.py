"""
Guest Leads Model
Stores guest information captured during AI chat.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
import uuid

class Lead(SQLModel, table=True):
    """
    Guest lead information captured by AI.
    """
    __tablename__ = "leads"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    # Guest Details
    guest_name: str
    guest_email: Optional[str] = None
    guest_phone: str
    
    # Context
    room_type_preference: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    num_adults: int = Field(default=2)
    num_children: int = Field(default=0)
    
    # Status
    status: str = Field(default="new")  # new, contacted, converted, lost
    ai_conversation_summary: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
