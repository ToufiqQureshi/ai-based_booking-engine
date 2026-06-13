"""
Analytics Models
Tracks widget visits, page views, time spent, and booking conversions for each hotel.
"""
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel
import secrets

class AnalyticsSession(SQLModel, table=True):
    """
    Represents a single user session on a hotel's widget or booking page.
    A session groups multiple events together.
    """
    __tablename__ = "analytics_sessions"
    
    id: str = Field(default_factory=lambda: f"sess_{secrets.token_urlsafe(16)}", primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    # Device & Network Info
    user_agent: Optional[str] = None
    device_type: Optional[str] = None # desktop, mobile, tablet
    browser: Optional[str] = None
    os: Optional[str] = None
    country: Optional[str] = None
    referrer: Optional[str] = None
    
    # Session Timings
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    time_spent_seconds: int = Field(default=0)
    
    # Conversion Tracking
    has_booked: bool = Field(default=False)
    booking_id: Optional[str] = None # Link to booking if converted
    
    # Relationships
    events: List["AnalyticsEvent"] = Relationship(back_populates="session", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class AnalyticsEvent(SQLModel, table=True):
    """
    Represents a specific action taken during an AnalyticsSession.
    Examples: page_view, room_view, add_to_cart, checkout_started, etc.
    """
    __tablename__ = "analytics_events"
    
    id: str = Field(default_factory=lambda: f"evt_{secrets.token_urlsafe(16)}", primary_key=True)
    session_id: str = Field(foreign_key="analytics_sessions.id", index=True)
    
    event_type: str = Field(index=True) # e.g., "page_view", "select_room", "conversion"
    page_url: Optional[str] = None
    
    # For specific item tracking
    room_type_id: Optional[str] = None
    
    # For tracking time spent on a specific page
    time_spent_seconds: int = Field(default=0)
    
    # Metadata
    metadata_json: Optional[str] = None # Any extra data stored as JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    session: "AnalyticsSession" = Relationship(back_populates="events")

# --- Pydantic Models for API Requests ---

class SessionStartRequest(BaseModel):
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    page_url: Optional[str] = None

class SessionPingRequest(BaseModel):
    session_id: str
    time_spent_seconds: int # Incremental time spent since last ping

class EventTrackRequest(BaseModel):
    session_id: str
    event_type: str
    page_url: Optional[str] = None
    room_type_id: Optional[str] = None
    time_spent_seconds: Optional[int] = 0
    metadata_json: Optional[str] = None
