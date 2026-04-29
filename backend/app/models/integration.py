"""
Integration Models
API Keys, Webhooks, and Integration Settings for external hotel websites
"""
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel
import secrets

class APIKey(SQLModel, table=True):
    """
    API Keys for external integration.
    Hoteliers can generate API keys to integrate booking engine on their website.
    """
    __tablename__ = "api_keys"
    
    id: str = Field(default_factory=lambda: f"key_{secrets.token_urlsafe(16)}", primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    # Key details
    name: str  # e.g., "Main Website", "Mobile App"
    key_prefix: str  # First 8 chars shown to user (e.g., "sk_live_")
    key_hash: str  # Hashed full key for security
    
    # Permissions
    scopes: str = Field(default="read:rooms,read:availability,create:booking")  # Comma-separated
    
    # Status
    is_active: bool = Field(default=True)
    last_used_at: Optional[datetime] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    
    # Usage tracking
    request_count: int = Field(default=0)
    last_ip: Optional[str] = None


class IntegrationSettings(SQLModel, table=True):
    """
    Integration configuration for each hotel.
    Stores widget settings, allowed domains, webhook URLs, etc.
    """
    __tablename__ = "integration_settings"
    
    id: str = Field(default_factory=lambda: secrets.token_urlsafe(8), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", unique=True, index=True)
    
    # Widget Configuration
    widget_enabled: bool = Field(default=True)
    widget_theme: str = Field(default="light")  # light, dark, auto
    widget_primary_color: str = Field(default="#3B82F6")
    widget_background_color: str = Field(default="#FFFFFF")
    widget_position: str = Field(default="bottom-right")  # bottom-right, bottom-left, etc.
    
    # Security
    allowed_domains: str = Field(default="")  # Comma-separated list of allowed domains
    cors_enabled: bool = Field(default=True)
    
    # Webhooks
    webhook_url: Optional[str] = None
    webhook_events: str = Field(default="booking.created,booking.cancelled")  # Comma-separated
    webhook_secret: Optional[str] = None
    
    # Advanced
    rate_limit_per_hour: int = Field(default=1000)
    require_https: bool = Field(default=True)
    
    # AI dynamic configurations
    ai_provider: Optional[str] = Field(default="groq")
    ai_api_key: Optional[str] = Field(default=None)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Pydantic Models for API

class APIKeyCreate(BaseModel):
    name: str
    scopes: Optional[str] = "read:rooms,read:availability,create:booking"
    expires_in_days: Optional[int] = None


class APIKeyRead(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: str
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    request_count: int


class APIKeyWithSecret(APIKeyRead):
    """Only returned once when key is created"""
    secret_key: str


class IntegrationSettingsRead(BaseModel):
    hotel_id: str
    widget_enabled: bool
    widget_theme: str
    widget_primary_color: str
    widget_position: str
    allowed_domains: str
    cors_enabled: bool
    webhook_url: Optional[str]
    webhook_events: str
    rate_limit_per_hour: int
    require_https: bool
    ai_provider: Optional[str] = "groq"
    ai_api_key: Optional[str] = None


class IntegrationSettingsUpdate(BaseModel):
    widget_enabled: Optional[bool] = None
    widget_theme: Optional[str] = None
    widget_primary_color: Optional[str] = None
    widget_position: Optional[str] = None
    allowed_domains: Optional[str] = None
    cors_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None
    webhook_events: Optional[str] = None
    rate_limit_per_hour: Optional[int] = None
    require_https: Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_api_key: Optional[str] = None


class WidgetCodeResponse(BaseModel):
    """Response containing widget embed code"""
    html_code: str
    javascript_code: str
    css_code: str
    instructions: str
