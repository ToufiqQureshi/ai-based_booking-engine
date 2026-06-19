"""
Guest Leads Model
Stores guest information captured during AI chat.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from pydantic import field_validator, EmailStr
import uuid
import re

def strip_html_tags(value: str) -> str:
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]*>', '', value).strip()

class Lead(SQLModel, table=True):
    """
    Guest lead information captured by AI.
    """
    __tablename__ = "leads"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    # Guest Details
    guest_name: str = Field(max_length=150)
    guest_email: Optional[EmailStr] = None
    guest_phone: str = Field(max_length=20)
    
    # Context
    room_type_preference: Optional[str] = Field(default=None, max_length=100)
    check_in: Optional[str] = Field(default=None, max_length=20)
    check_out: Optional[str] = Field(default=None, max_length=20)
    num_adults: int = Field(default=2, ge=1, le=50)
    num_children: int = Field(default=0, ge=0, le=50)
    
    # Status
    status: str = Field(default="new", index=True, max_length=20)  # new, contacted, converted, lost
    ai_conversation_summary: Optional[str] = Field(default=None, max_length=1000)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator(
        "guest_name", "guest_phone", "room_type_preference",
        "check_in", "check_out", "status", "ai_conversation_summary",
        mode="before"
    )
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)
