from sqlmodel import SQLModel, Field, Relationship, Column
from sqlalchemy import JSON
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class BookingTimeline(SQLModel, table=True):
    """
    Tracks every status change or important event in a booking's life.
    Useful for auditing and showing a 'history' to the hotelier.
    """
    __tablename__ = "booking_timeline"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    booking_id: str = Field(foreign_key="bookings.id", index=True)
    
    event_type: str = Field(description="e.g., 'status_change', 'payment_received', 'note_added'")
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    
    message: str = Field(description="Human readable description of the event")
    metadata_json: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    
    changed_by: Optional[str] = Field(default="system", description="User ID or 'system' or 'ai'")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    # booking: Optional["Booking"] = Relationship(back_populates="timeline")
