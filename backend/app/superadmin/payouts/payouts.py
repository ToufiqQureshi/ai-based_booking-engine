"""
Super Admin — Payouts to hoteliers + bank account verification.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select, func

from app.core.auth.deps import DbSession
from app.system.audit import AuditLog
from app.superadmin.commissions.commission import BankAccount, Payout, CommissionLedger
from app.brand_console.hotel import Hotel
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────── Bank Accounts ─────────────────

@router.get("/payouts/bank-accounts")
async def list_bank_accounts(
    session: DbSession,
    hotel_id: Optional[str] = None,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    q = select(BankAccount)
    if hotel_id:
        q = q.where(BankAccount.hotel_id == hotel_id)
    q = q.order_by(BankAccount.created_at.desc())
    return (await session.execute(q)).scalars().all()


@router.post("/payouts/bank-accounts")
async def upsert_bank_account(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    bank_id = data.get("id")
    bank = await session.get(BankAccount, bank_id) if bank_id else None
    if bank is None:
        if not data.get("hotel_id"):
            raise HTTPException(400, "hotel_id required")
        bank = BankAccount(
            hotel_id=data["hotel_id"],
            account_holder_name=data["account_holder_name"],
            account_number=data["account_number"],
            ifsc_code=data["ifsc_code"],
        )

    for k in ("account_holder_name", "account_number", "ifsc_code", "bank_name",
              "branch", "upi_id", "is_primary"):
        if k in data:
            setattr(bank, k, data[k])
    bank.updated_at = datetime.utcnow()
    session.add(bank)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=bank.hotel_id,
        action="BANK_ACCOUNT_UPSERT",
        description=f"{'Updated' if bank_id else 'Created'} bank account for hotel {bank.hotel_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(bank)
    return bank


@router.post("/payouts/bank-accounts/{bank_id}/verify")
async def verify_bank_account(
    bank_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    bank = await session.get(BankAccount, bank_id)
    if not bank:
        raise HTTPException(404, "Bank account not found")
    bank.is_verified = bool(data.get("is_verified", True))
    bank.verification_notes = data.get("notes")
    bank.verified_at = datetime.utcnow() if bank.is_verified else None
    bank.verified_by = super_admin.id if bank.is_verified else None
    bank.updated_at = datetime.utcnow()
    session.add(bank)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=bank.hotel_id,
        action="BANK_ACCOUNT_VERIFY",
        description=f"{'Verified' if bank.is_verified else 'Unverified'} bank account {bank_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return bank


@router.delete("/payouts/bank-accounts/{bank_id}")
async def delete_bank_account(
    bank_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    bank = await session.get(BankAccount, bank_id)
    if not bank:
        raise HTTPException(404, "Bank account not found")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=bank.hotel_id,
        action="BANK_ACCOUNT_DELETE",
        description=f"Deleted bank account {bank_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(bank)
    await session.commit()
    return {"message": "Deleted"}


# ──────────────── Payouts ─────────────────

@router.get("/payouts")
async def list_payouts(
    session: DbSession,
    hotel_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    q = select(Payout)
    if hotel_id:
        q = q.where(Payout.hotel_id == hotel_id)
    if status_filter:
        q = q.where(Payout.status == status_filter)
    q = q.order_by(Payout.created_at.desc()).limit(limit)
    rows = (await session.execute(q)).scalars().all()
    return rows


@router.get("/payouts/summary")
async def payouts_summary(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    paid = (await session.execute(
        select(func.coalesce(func.sum(Payout.net_amount), 0)).where(Payout.status == "paid")
    )).scalar() or 0
    pending = (await session.execute(
        select(func.coalesce(func.sum(Payout.net_amount), 0))
        .where(Payout.status.in_(["scheduled", "processing"]))
    )).scalar() or 0
    failed = (await session.execute(
        select(func.coalesce(func.sum(Payout.net_amount), 0)).where(Payout.status == "failed")
    )).scalar() or 0
    counts = {}
    for row in (await session.execute(
        select(Payout.status, func.count(Payout.id)).group_by(Payout.status)
    )).all():
        counts[row[0]] = row[1]
    return {
        "paid_total": float(paid),
        "pending_total": float(pending),
        "failed_total": float(failed),
        "counts_by_status": counts,
    }


@router.post("/payouts/generate")
async def generate_payout(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    """Build a payout by pulling unpaid accrued ledger entries for a hotel + date window."""
    hotel_id = data.get("hotel_id")
    if not hotel_id:
        raise HTTPException(400, "hotel_id required")
    start = datetime.fromisoformat(data["period_start"])
    end = datetime.fromisoformat(data["period_end"])

    entries = (await session.execute(
        select(CommissionLedger).where(
            CommissionLedger.hotel_id == hotel_id,
            CommissionLedger.status == "accrued",
            CommissionLedger.created_at >= start,
            CommissionLedger.created_at <= end,
        )
    )).scalars().all()
    if not entries:
        raise HTTPException(400, "No unpaid ledger entries for this period")

    gross = sum(e.booking_amount for e in entries)
    commission_total = sum(e.commission_amount for e in entries)
    gst_total = sum(e.gst_amount for e in entries)
    adjustments = float(data.get("adjustments", 0))
    net = gross - commission_total - gst_total - adjustments

    bank_account_id = data.get("bank_account_id")
    if not bank_account_id:
        bank = (await session.execute(
            select(BankAccount).where(
                BankAccount.hotel_id == hotel_id, BankAccount.is_primary == True
            )
        )).scalar_one_or_none()
        bank_account_id = bank.id if bank else None

    payout = Payout(
        hotel_id=hotel_id,
        bank_account_id=bank_account_id,
        period_start=start, period_end=end,
        gross_amount=gross, commission_total=commission_total,
        gst_total=gst_total, adjustments=adjustments, net_amount=net,
        status="scheduled",
        initiated_by=super_admin.id,
        notes=data.get("notes"),
    )
    session.add(payout)
    await session.flush()

    for e in entries:
        e.status = "included_in_payout"
        e.payout_id = payout.id
        session.add(e)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="PAYOUT_GENERATE",
        description=f"Generated payout ₹{net:.2f} for hotel {hotel_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(payout)
    return payout


@router.post("/payouts/{payout_id}/mark-paid")
async def mark_payout_paid(
    payout_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(404, "Payout not found")
    if payout.status == "paid":
        raise HTTPException(400, "Payout already paid")
    payout.status = "paid"
    payout.paid_at = datetime.utcnow()
    payout.reference_number = data.get("reference_number")
    payout.updated_at = datetime.utcnow()
    session.add(payout)

    entries = (await session.execute(
        select(CommissionLedger).where(CommissionLedger.payout_id == payout_id)
    )).scalars().all()
    for e in entries:
        e.status = "paid"
        session.add(e)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=payout.hotel_id,
        action="PAYOUT_PAID",
        description=f"Marked payout {payout_id} paid (UTR: {payout.reference_number})",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return payout


@router.post("/payouts/{payout_id}/cancel")
async def cancel_payout(
    payout_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(404, "Payout not found")
    if payout.status == "paid":
        raise HTTPException(400, "Cannot cancel a paid payout")
    payout.status = "cancelled"
    payout.failure_reason = data.get("reason", "Cancelled by admin")
    payout.updated_at = datetime.utcnow()
    session.add(payout)

    entries = (await session.execute(
        select(CommissionLedger).where(CommissionLedger.payout_id == payout_id)
    )).scalars().all()
    for e in entries:
        e.status = "accrued"
        e.payout_id = None
        session.add(e)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=payout.hotel_id,
        action="PAYOUT_CANCEL",
        description=f"Cancelled payout {payout_id} — {payout.failure_reason}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return payout


@router.post("/payouts/{payout_id}/mark-failed")
async def mark_payout_failed(
    payout_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.payouts.read")),
):
    payout = await session.get(Payout, payout_id)
    if not payout:
        raise HTTPException(404, "Payout not found")
    payout.status = "failed"
    payout.failure_reason = data.get("reason", "Bank rejected transfer")
    payout.updated_at = datetime.utcnow()
    session.add(payout)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=payout.hotel_id,
        action="PAYOUT_FAILED",
        description=f"Payout {payout_id} marked failed — {payout.failure_reason}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return payout


