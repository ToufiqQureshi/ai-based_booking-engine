from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field
from pydantic import BaseModel
import secrets

class ChannelManagerSettings(SQLModel, table=True):
    """
    Settings specifically for Channel Manager connectivity (e.g. Channex).
    Separate from IntegrationSettings to avoid migration issues.
    """
    __tablename__ = "channel_manager_settings"
    
    id: str = Field(default_factory=lambda: secrets.token_urlsafe(8), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", unique=True, index=True)
    
    # Connection Details
    provider: str = Field(default="channex") # channex, siteminder, etc.
    provider_hotel_id: Optional[str] = None # The ID in the external system
    api_key: Optional[str] = None # If needed
    
    # Status
    is_connected: bool = Field(default=False)
    sync_enabled: bool = Field(default=False)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


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
    channel_name: str # booking.com, airbnb, expedia
    ota_room_id: str # ID from the OTA
    ota_rate_plan_id: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChannelLog(SQLModel, table=True):
    """
    Logs for sync activities (success/failure).
    """
    __tablename__ = "channel_logs"
    
    id: int = Field(default=None, primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    type: str # success, error, info
    action: str # inventory_update, rate_update, booking_import
    message: str
    details: Optional[str] = None # JSON string for debug
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)


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
