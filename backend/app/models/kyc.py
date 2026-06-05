"""
KYC (Know Your Customer) Models
Hotelier identity/document verification by Super Admin.
"""
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, List
from datetime import datetime
import uuid


class KycDocument(SQLModel, table=True):
    """KYC document submitted by a hotelier for verification."""
    __tablename__ = "kyc_documents"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)

    # Document classification
    doc_type: str = Field(index=True)  # PAN, GST, AADHAAR, BANK_PROOF, OWNERSHIP_PROOF, OTHER
    doc_number: Optional[str] = None
    doc_url: str  # URL of uploaded file (Supabase storage)
    file_name: Optional[str] = None

    # Verification workflow
    status: str = Field(default="pending", index=True)  # pending, approved, rejected, resubmit
    rejection_reason: Optional[str] = None
    reviewed_by: Optional[str] = None  # super admin user id
    reviewed_by_email: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    notes: Optional[str] = None

    submitted_by: Optional[str] = None  # hotelier user id
    submitted_by_email: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class KycProfile(SQLModel, table=True):
    """Aggregate KYC status for a hotel - one row per hotel."""
    __tablename__ = "kyc_profiles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", unique=True, index=True)

    # Overall verification state
    overall_status: str = Field(default="incomplete", index=True)
    # incomplete, submitted, in_review, verified, rejected
    is_verified: bool = Field(default=False)
    verified_at: Optional[datetime] = None

    # Business details captured during KYC
    legal_business_name: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    registration_number: Optional[str] = None
    owner_full_name: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_email: Optional[str] = None
    business_address: Optional[str] = None

    # Counts for quick reads
    docs_submitted: int = Field(default=0)
    docs_approved: int = Field(default=0)
    docs_rejected: int = Field(default=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
