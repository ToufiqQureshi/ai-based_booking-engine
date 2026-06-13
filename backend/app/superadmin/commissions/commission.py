"""
Commission, Bank Account, Payout, and Invoice Models
For Super Admin financial control over hoteliers.
"""
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, List
from datetime import datetime
import uuid


class CommissionRule(SQLModel, table=True):
    """Commission % rules - platform default + per-hotel override."""
    __tablename__ = "commission_rules"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    # If hotel_id is null, it's the platform default for that plan_name
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)
    plan_name: Optional[str] = Field(default=None, index=True)  # Free, Basic, Premium, Enterprise

    commission_percent: float = Field(default=10.0)  # platform's cut
    fixed_fee: float = Field(default=0.0)  # per-booking fixed fee in INR
    gst_on_commission: float = Field(default=18.0)  # GST rate on commission

    is_active: bool = Field(default=True)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CommissionLedger(SQLModel, table=True):
    """Per-booking commission entry. Snapshot at the time of booking."""
    __tablename__ = "commission_ledger"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    booking_id: Optional[str] = Field(default=None, index=True)
    payment_id: Optional[str] = Field(default=None, index=True)

    booking_amount: float = Field(default=0.0)
    commission_percent: float = Field(default=0.0)
    commission_amount: float = Field(default=0.0)
    fixed_fee: float = Field(default=0.0)
    gst_amount: float = Field(default=0.0)
    platform_take: float = Field(default=0.0)  # commission + fee + gst
    hotelier_payout: float = Field(default=0.0)  # booking - platform_take

    status: str = Field(default="accrued", index=True)
    # accrued, included_in_payout, paid, disputed, reversed
    payout_id: Optional[str] = Field(default=None, foreign_key="payouts.id", index=True)

    currency: str = Field(default="INR")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class BankAccount(SQLModel, table=True):
    """Hotelier bank account for receiving payouts."""
    __tablename__ = "bank_accounts"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)

    account_holder_name: str
    account_number: str  # store masked / encrypted in production
    ifsc_code: str
    bank_name: Optional[str] = None
    branch: Optional[str] = None
    upi_id: Optional[str] = None

    is_primary: bool = Field(default=True)
    is_verified: bool = Field(default=False)
    verified_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verification_notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Payout(SQLModel, table=True):
    """A payout disbursement to a hotelier."""
    __tablename__ = "payouts"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    bank_account_id: Optional[str] = Field(default=None, foreign_key="bank_accounts.id")

    period_start: datetime
    period_end: datetime

    gross_amount: float = Field(default=0.0)  # sum of bookings
    commission_total: float = Field(default=0.0)
    gst_total: float = Field(default=0.0)
    adjustments: float = Field(default=0.0)  # refunds, chargebacks
    net_amount: float = Field(default=0.0)  # what hotelier receives

    status: str = Field(default="scheduled", index=True)
    # scheduled, processing, paid, failed, cancelled, on_hold
    reference_number: Optional[str] = None  # bank UTR / NEFT ref
    failure_reason: Optional[str] = None

    scheduled_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    initiated_by: Optional[str] = None  # super admin user id

    currency: str = Field(default="INR")
    notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PlatformInvoice(SQLModel, table=True):
    """Invoice raised by platform to a hotelier (subscription, commission, etc.)."""
    __tablename__ = "platform_invoices"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)

    invoice_number: str = Field(unique=True, index=True)
    invoice_type: str = Field(default="subscription")
    # subscription, commission, addon, manual

    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: Optional[datetime] = None

    subtotal: float = Field(default=0.0)
    gst_amount: float = Field(default=0.0)
    total_amount: float = Field(default=0.0)
    currency: str = Field(default="INR")

    status: str = Field(default="draft", index=True)
    # draft, issued, paid, overdue, void

    line_items: List[dict] = Field(default_factory=list, sa_column=Column(JSON))
    pdf_url: Optional[str] = None
    paid_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
