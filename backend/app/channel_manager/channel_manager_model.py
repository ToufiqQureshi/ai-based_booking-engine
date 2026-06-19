from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field
from pydantic import BaseModel, field_validator
import secrets
import re

def strip_html_tags(value: str) -> str:
    if not isinstance(value, str):
        return value
    return re.sub(r'<[^>]*>', '', value).strip()

class ChannelManagerSettings(SQLModel, table=True):
    """
    Settings specifically for Channel Manager connectivity (e.g. Channex).
    Separate from IntegrationSettings to avoid migration issues.
    """
    __tablename__ = "channel_manager_settings"
    
    id: str = Field(default_factory=lambda: secrets.token_urlsafe(8), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", unique=True, index=True)
    
    # Connection Details
    provider: str = Field(default="channex", max_length=50) # channex, siteminder, etc.
    provider_hotel_id: Optional[str] = Field(default=None, max_length=255) # The ID in the external system
    api_key: Optional[str] = Field(default=None, max_length=255) # If needed
    
    # Status
    is_connected: bool = Field(default=False)
    sync_enabled: bool = Field(default=False)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("provider", "provider_hotel_id", "api_key", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)


class ChannelRoomMapping(SQLModel, table=True):
    """
    Maps a local RoomType to an OTA Room ID.
    Multi-channel support: One local room can map to multiple OTAs (via channel_name).
    """
    __tablename__ = "channel_room_mappings"
    
    id: str = Field(default_factory=lambda: secrets.token_urlsafe(16), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    local_room_id: str = Field(foreign_key="room_types.id") 
    
    # OTA Details
    channel_name: str = Field(max_length=100) # booking.com, airbnb, expedia
    ota_room_id: str = Field(max_length=255) # ID from the OTA
    ota_rate_plan_id: Optional[str] = Field(default=None, max_length=255)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("channel_name", "ota_room_id", "ota_rate_plan_id", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)


class ChannelLog(SQLModel, table=True):
    """
    Logs for sync activities (success/failure).
    """
    __tablename__ = "channel_logs"
    
    id: int = Field(default=None, primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    type: str = Field(max_length=20) # success, error, info
    action: str = Field(max_length=100) # inventory_update, rate_update, booking_import
    message: str = Field(max_length=1000)
    details: Optional[str] = Field(default=None, max_length=5000) # JSON string for debug
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("type", "action", "message", "details", mode="before")
    @classmethod
    def sanitize_strings(cls, v):
        return strip_html_tags(v)


# Pydantic Models for API

class ChannelSettingsRead(BaseModel):
    provider: str
    provider_hotel_id: Optional[str]
    is_connected: bool
    sync_enabled: bool

class ChannelSettingsUpdate(BaseModel):
    provider: Optional[str] = None
    provider_hotel_id: Optional[str] = None
    api_key: Optional[str] = None
    is_connected: Optional[bool] = None
    sync_enabled: Optional[bool] = None

class MappingCreate(BaseModel):
    local_room_id: str
    channel_name: str
    ota_room_id: str

class MappingRead(BaseModel):
    id: str
    local_room_id: str
    channel_name: str
    ota_room_id: str
    created_at: datetime

class ChannelLogRead(BaseModel):
    id: int
    type: str
    action: str
    message: str
    timestamp: datetime
