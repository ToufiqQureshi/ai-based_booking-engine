"""
Platform-level Settings Models
ApiKey, CustomDomain, EmailTemplate, SuperAdminRole.
"""
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, List
from datetime import datetime
import uuid


class ApiKey(SQLModel, table=True):
    """API key for hotelier programmatic access."""
    __tablename__ = "api_keys"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)

    label: str  # human name for this key
    key_prefix: str = Field(index=True)  # first 8 chars shown in UI
    key_hash: str  # sha256 hash of the full key, never store raw

    scopes: List[str] = Field(default_factory=lambda: ["read"], sa_column=Column(JSON))
    # read, write, bookings:read, bookings:write, rooms:write, etc.

    is_active: bool = Field(default=True)
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    last_used_ip: Optional[str] = None
    usage_count: int = Field(default=0)

    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None


class CustomDomain(SQLModel, table=True):
    """White-label domain mapping for a hotel."""
    __tablename__ = "custom_domains"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)

    domain: str = Field(unique=True, index=True)  # book.example.com
    is_primary: bool = Field(default=True)

    # DNS verification
    verification_token: Optional[str] = None
    is_verified: bool = Field(default=False)
    verified_at: Optional[datetime] = None
    dns_records: List[dict] = Field(default_factory=list, sa_column=Column(JSON))

    # SSL state
    ssl_status: str = Field(default="pending")  # pending, active, failed, expired
    ssl_issued_at: Optional[datetime] = None
    ssl_expires_at: Optional[datetime] = None

    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class EmailTemplate(SQLModel, table=True):
    """Custom email/notification templates per hotel or platform-wide."""
    __tablename__ = "email_templates"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    # If hotel_id is null, it's a platform-default template
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)

    template_key: str = Field(index=True)
    # booking_confirmation, booking_cancellation, payment_receipt, welcome,
    # password_reset, subscription_expiry, payout_paid, invoice_issued
    name: str
    channel: str = Field(default="email")  # email, sms, whatsapp

    subject: Optional[str] = None  # for email
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    variables: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SuperAdminRole(SQLModel, table=True):
    """Sub-roles inside Super Admin team — granular access control."""
    __tablename__ = "super_admin_roles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True, index=True)
    user_email: str = Field(index=True)

    role_tier: str = Field(default="support", index=True)
    # owner (full access), finance, support, ops, viewer

    permissions: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    # superadmin.hotels.write, superadmin.payouts.execute,
    # superadmin.kyc.approve, superadmin.tickets.assign, ...

    is_active: bool = Field(default=True)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


DEFAULT_PERMISSIONS_BY_TIER = {
    "owner": ["*"],
    "finance": [
        "superadmin.revenue.read",
        "superadmin.commissions.read", "superadmin.commissions.write",
        "superadmin.payouts.read", "superadmin.payouts.execute",
        "superadmin.invoices.read", "superadmin.invoices.write",
        "superadmin.hotels.read",
    ],
    "support": [
        "superadmin.tickets.read", "superadmin.tickets.write", "superadmin.tickets.assign",
        "superadmin.hotels.read", "superadmin.users.read",
        "superadmin.broadcasts.read",
    ],
    "ops": [
        "superadmin.hotels.read", "superadmin.hotels.write",
        "superadmin.kyc.read", "superadmin.kyc.approve",
        "superadmin.integrations.read", "superadmin.integrations.write",
        "superadmin.cache.flush",
    ],
    "viewer": [
        "superadmin.hotels.read",
        "superadmin.revenue.read",
        "superadmin.users.read",
        "superadmin.audit.read",
    ],
}
