"""
Integration Models
API Keys, Webhooks, and Integration Settings for external hotel websites
"""
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel, ConfigDict
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
    widget_primary_color: str = Field(default="#7C3AED")
    widget_background_color: str = Field(default="#FFFFFF")
    widget_position: str = Field(default="bottom-right")  # bottom-right, bottom-left, etc.
    widget_layout: str = Field(default="modern") # modern, classic, minimal
    widget_logo_url: Optional[str] = None # Specific logo for widget if different from hotel logo
    
    # Security
    allowed_domains: str = Field(default="")  # Comma-separated list of allowed domains
    cors_enabled: bool = Field(default=True)
    
    # Webhooks
    webhook_url: Optional[str] = None
    webhook_events: str = Field(default="booking.created,booking.cancelled")  # Comma-separated
    webhook_secret: Optional[str] = None
    webhook_secret_vault_id: Optional[str] = Field(default=None)  # Vault UUID replaces webhook_secret
    
    # Advanced
    rate_limit_per_hour: int = Field(default=1000)
    require_https: bool = Field(default=True)
    
    # AI dynamic configurations
    ai_provider: Optional[str] = Field(default="groq")
    ai_api_key: Optional[str] = Field(default=None)
    ai_api_key_vault_id: Optional[str] = Field(default=None)  # Vault UUID replaces ai_api_key
    ai_model: Optional[str] = Field(default="llama-3.1-70b-versatile")
    ai_base_url: Optional[str] = Field(default=None)
    ai_max_tokens: Optional[int] = Field(default=None)
    
    # Sync Integrations
    google_sheet_url: Optional[str] = None

    # Google Business Profile Integrations
    google_business_access_token: Optional[str] = Field(default=None)
    google_business_refresh_token: Optional[str] = Field(default=None)
    google_business_location_id: Optional[str] = Field(default=None)
    google_business_account_id: Optional[str] = Field(default=None)

    # Google Hotel Ads Integration
    google_hotel_ads_enabled: bool = Field(default=False)
    google_hotel_center_id: Optional[str] = Field(default=None)
    google_ads_account_id: Optional[str] = Field(default=None)
    google_ads_last_ari_sync: Optional[datetime] = Field(default=None)
    google_ads_status: str = Field(default="inactive") # inactive, pending, active, error

    # Custom styling and code overrides
    widget_custom_css: Optional[str] = Field(default="")
    widget_custom_js: Optional[str] = Field(default="")

    # Booking constraints — enforced in widget
    widget_min_nights: int = Field(default=1, ge=1, le=365)
    widget_advance_purchase_days: int = Field(default=0, ge=0, le=365)
    widget_room_type_filter: Optional[str] = Field(default=None)

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# Pydantic Models for API

class APIKeyCreate(BaseModel):
    name: str
    scopes: Optional[str] = "read:rooms,read:availability,create:booking"
    expires_in_days: Optional[int] = None


class APIKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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
    model_config = ConfigDict(from_attributes=True)
    hotel_id: str
    widget_enabled: bool
    widget_theme: str
    widget_primary_color: str
    widget_background_color: str
    widget_position: str
    widget_layout: Optional[str] = "modern"
    widget_logo_url: Optional[str] = None
    allowed_domains: str
    cors_enabled: bool
    webhook_url: Optional[str]
    webhook_events: str
    rate_limit_per_hour: int
    require_https: bool
    ai_provider: Optional[str] = "groq"
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = "llama-3.1-70b-versatile"
    ai_base_url: Optional[str] = None
    ai_max_tokens: Optional[int] = None
    google_sheet_url: Optional[str] = None
    google_business_access_token: Optional[str] = None
    google_business_refresh_token: Optional[str] = None
    google_business_location_id: Optional[str] = None
    google_business_account_id: Optional[str] = None
    google_hotel_ads_enabled: bool = False
    google_hotel_center_id: Optional[str] = None
    google_ads_account_id: Optional[str] = None
    google_ads_last_ari_sync: Optional[datetime] = None
    google_ads_status: str = "inactive"
    widget_custom_css: Optional[str] = ""
    widget_custom_js: Optional[str] = ""
    widget_min_nights: int = 1
    widget_advance_purchase_days: int = 0
    widget_room_type_filter: Optional[str] = None


class IntegrationSettingsUpdate(BaseModel):
    widget_enabled: Optional[bool] = None
    widget_theme: Optional[str] = None
    widget_primary_color: Optional[str] = None
    widget_background_color: Optional[str] = None
    widget_position: Optional[str] = None
    widget_layout: Optional[str] = None
    widget_logo_url: Optional[str] = None
    allowed_domains: Optional[str] = None
    cors_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None
    webhook_events: Optional[str] = None
    rate_limit_per_hour: Optional[int] = None
    require_https: Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_max_tokens: Optional[int] = None
    google_sheet_url: Optional[str] = None
    google_business_access_token: Optional[str] = None
    google_business_refresh_token: Optional[str] = None
    google_business_location_id: Optional[str] = None
    google_business_account_id: Optional[str] = None
    google_hotel_ads_enabled: Optional[bool] = None
    google_hotel_center_id: Optional[str] = None
    google_ads_account_id: Optional[str] = None
    google_ads_last_ari_sync: Optional[datetime] = None
    google_ads_status: Optional[str] = None
    widget_custom_css: Optional[str] = None
    widget_custom_js: Optional[str] = None
    widget_min_nights: Optional[int] = None
    widget_advance_purchase_days: Optional[int] = None
    widget_room_type_filter: Optional[str] = None


class WidgetCodeResponse(BaseModel):
    """Response containing widget embed code"""
    html_code: str
    javascript_code: str
    css_code: str
    instructions: str
