"""
Super Admin — KYC document verification for hoteliers.
"""
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select, func

from app.core.auth.deps import DbSession
from app.system.audit import AuditLog
from app.brand_console.hotel import Hotel
from app.superadmin.kyc.kyc_model import KycDocument, KycProfile
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_or_create_profile(session, hotel_id: str) -> KycProfile:
    row = (await session.execute(
        select(KycProfile).where(KycProfile.hotel_id == hotel_id)
    )).scalar_one_or_none()
    if not row:
        row = KycProfile(hotel_id=hotel_id)
        session.add(row)
        await session.flush()
    return row


async def _refresh_profile_counts(session, hotel_id: str) -> KycProfile:
    """Recompute aggregate counts and overall status from documents."""
    profile = await _get_or_create_profile(session, hotel_id)
    docs = (await session.execute(
        select(KycDocument).where(KycDocument.hotel_id == hotel_id)
    )).scalars().all()

    profile.docs_submitted = len(docs)
    profile.docs_approved = sum(1 for d in docs if d.status == "approved")
    profile.docs_rejected = sum(1 for d in docs if d.status == "rejected")

    required = {"PAN", "GST", "BANK_PROOF"}
    submitted_types = {d.doc_type for d in docs}
    approved_types = {d.doc_type for d in docs if d.status == "approved"}

    if required.issubset(approved_types):
        profile.overall_status = "verified"
        profile.is_verified = True
        if not profile.verified_at:
            profile.verified_at = datetime.utcnow()
    elif any(d.status == "rejected" for d in docs):
        profile.overall_status = "rejected"
        profile.is_verified = False
    elif required.issubset(submitted_types):
        profile.overall_status = "in_review"
        profile.is_verified = False
    elif docs:
        profile.overall_status = "submitted"
        profile.is_verified = False
    else:
        profile.overall_status = "incomplete"
        profile.is_verified = False

    profile.updated_at = datetime.utcnow()
    session.add(profile)
    return profile


@router.get("/kyc/overview")
async def kyc_overview(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.read")),
):
    """Aggregate KYC numbers for the platform dashboard."""
    profiles = (await session.execute(select(KycProfile))).scalars().all()
    total_hotels = (await session.execute(select(func.count(Hotel.id)))).scalar() or 0
    by_status = {"verified": 0, "in_review": 0, "submitted": 0, "incomplete": 0, "rejected": 0}
    for p in profiles:
        by_status[p.overall_status] = by_status.get(p.overall_status, 0) + 1
    missing_profile = total_hotels - len(profiles)
    by_status["incomplete"] += max(missing_profile, 0)
    pending_docs = (await session.execute(
        select(func.count(KycDocument.id)).where(KycDocument.status == "pending")
    )).scalar() or 0
    return {
        "total_hotels": total_hotels,
        "by_status": by_status,
        "pending_docs": pending_docs,
    }


@router.get("/kyc/profiles")
async def list_kyc_profiles(
    session: DbSession,
    status_filter: Optional[str] = None,
    super_admin: User = Depends(require_permission("superadmin.kyc.read")),
):
    q = select(KycProfile, Hotel).join(Hotel, Hotel.id == KycProfile.hotel_id)
    if status_filter:
        q = q.where(KycProfile.overall_status == status_filter)
    q = q.order_by(KycProfile.updated_at.desc())
    rows = (await session.execute(q)).all()
    return [
        {
            **p.model_dump(),
            "hotel_name": h.name,
            "hotel_slug": h.slug,
        }
        for p, h in rows
    ]


@router.get("/kyc/hotels/{hotel_id}")
async def get_kyc_for_hotel(
    hotel_id: str, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.read")),
):
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(404, "Hotel not found")
    profile = await _get_or_create_profile(session, hotel_id)
    await session.commit()
    docs = (await session.execute(
        select(KycDocument).where(KycDocument.hotel_id == hotel_id).order_by(KycDocument.created_at.desc())
    )).scalars().all()
    return {"profile": profile.model_dump(), "documents": [d.model_dump() for d in docs]}


@router.patch("/kyc/hotels/{hotel_id}/profile")
async def update_kyc_profile(
    hotel_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.write")),
):
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(404, "Hotel not found")
    profile = await _get_or_create_profile(session, hotel_id)
    editable = {
        "legal_business_name", "gst_number", "pan_number", "registration_number",
        "owner_full_name", "owner_phone", "owner_email", "business_address",
    }
    for k, v in data.items():
        if k in editable:
            setattr(profile, k, v)
    profile.updated_at = datetime.utcnow()
    session.add(profile)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="KYC_PROFILE_UPDATE",
        description=f"Updated KYC profile for {hotel.name}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return profile


@router.post("/kyc/hotels/{hotel_id}/documents")
async def add_kyc_document(
    hotel_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.write")),
):
    """Super admin can attach a document on behalf of hotelier."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(404, "Hotel not found")
    if not data.get("doc_url") or not data.get("doc_type"):
        raise HTTPException(400, "doc_type and doc_url are required")
    doc = KycDocument(
        hotel_id=hotel_id,
        doc_type=data["doc_type"],
        doc_number=data.get("doc_number"),
        doc_url=data["doc_url"],
        file_name=data.get("file_name"),
        submitted_by=super_admin.id,
        submitted_by_email=super_admin.email,
    )
    session.add(doc)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="KYC_DOC_ADD",
        description=f"Added {doc.doc_type} document for {hotel.name}",
        ip_address=_get_client_ip(request),
    ))
    await session.flush()
    await _refresh_profile_counts(session, hotel_id)
    await session.commit()
    await session.refresh(doc)
    return doc


@router.post("/kyc/documents/{doc_id}/approve")
async def approve_document(
    doc_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.write")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.status = "approved"
    doc.reviewed_by = super_admin.id
    doc.reviewed_by_email = super_admin.email
    doc.reviewed_at = datetime.utcnow()
    doc.rejection_reason = None
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=doc.hotel_id,
        action="KYC_DOC_APPROVE",
        description=f"Approved {doc.doc_type} for hotel {doc.hotel_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.flush()
    await _refresh_profile_counts(session, doc.hotel_id)
    await session.commit()
    return {"status": "approved", "document": doc.model_dump()}


@router.post("/kyc/documents/{doc_id}/reject")
async def reject_document(
    doc_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.write")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    doc.status = "rejected"
    doc.reviewed_by = super_admin.id
    doc.reviewed_by_email = super_admin.email
    doc.reviewed_at = datetime.utcnow()
    doc.rejection_reason = data.get("reason", "Document did not meet verification criteria")
    doc.updated_at = datetime.utcnow()
    session.add(doc)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=doc.hotel_id,
        action="KYC_DOC_REJECT",
        description=f"Rejected {doc.doc_type} — {doc.rejection_reason}",
        ip_address=_get_client_ip(request),
    ))
    await session.flush()
    await _refresh_profile_counts(session, doc.hotel_id)
    await session.commit()
    return {"status": "rejected", "document": doc.model_dump()}


@router.delete("/kyc/documents/{doc_id}")
async def delete_document(
    doc_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.kyc.write")),
):
    doc = await session.get(KycDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    hotel_id = doc.hotel_id
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="KYC_DOC_DELETE",
        description=f"Deleted {doc.doc_type} for hotel {hotel_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(doc)
    await session.flush()
    await _refresh_profile_counts(session, hotel_id)
    await session.commit()
    return {"message": "Document deleted"}



