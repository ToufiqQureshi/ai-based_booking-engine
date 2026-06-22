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
    # City-level geo lets hoteliers target marketing at the towns guests come
    # from. Indexed because the dashboard groups visitors by city.
    city: Optional[str] = Field(default=None, index=True)
    region: Optional[str] = None
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

class ReportShareLink(SQLModel, table=True):
    """
    A public, no-login share link for a hotel's analytics report (PowerBI-style
    "publish to web"). The hotelier mints a token and can send it to anyone; the
    public report endpoint resolves the token to exactly one hotel and returns
    aggregate stats only (never guest PII).
    """
    __tablename__ = "report_share_links"

    id: str = Field(default_factory=lambda: f"share_{secrets.token_urlsafe(8)}", primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    # Unguessable token carried in the public URL (/r/<token>).
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(24), index=True, unique=True)

    label: Optional[str] = None          # hotelier-facing note, e.g. "Investor deck"
    days: int = Field(default=30)        # report window the link exposes (1..365)
    created_by: Optional[str] = None     # user id that minted the link

    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None  # None = never expires
    is_revoked: bool = Field(default=False)

    view_count: int = Field(default=0)
    last_viewed_at: Optional[datetime] = None


# --- Pydantic Models for API Requests ---


class ShareLinkCreate(BaseModel):
    label: Optional[str] = None
    days: int = 30                       # report window, clamped 1..365 server-side
    expires_in_days: Optional[int] = 30  # link validity; None = never expires



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
