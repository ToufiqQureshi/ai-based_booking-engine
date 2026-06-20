"""
Super Admin — Commission rules & per-booking ledger.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select, func

from app.core.auth.deps import DbSession
from app.system.audit import AuditLog
from app.superadmin.commissions.commission import CommissionRule, CommissionLedger
from app.brand_console.hotel import Hotel
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/commissions/rules")
async def list_commission_rules(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.commissions.read")),
):
    rules = (await session.execute(
        select(CommissionRule).order_by(CommissionRule.updated_at.desc())
    )).scalars().all()
    return rules


@router.post("/commissions/rules")
async def upsert_commission_rule(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.commissions.write")),
):
    """Create or update commission rule. If id provided, update; else create."""
    rule_id = data.get("id")
    rule = await session.get(CommissionRule, rule_id) if rule_id else None
    if rule is None:
        rule = CommissionRule()

    for k in ("hotel_id", "plan_name", "commission_percent", "fixed_fee",
              "gst_on_commission", "is_active", "notes"):
        if k in data:
            setattr(rule, k, data[k])
    rule.updated_at = datetime.utcnow()
    session.add(rule)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=rule.hotel_id,
        action="COMMISSION_RULE_UPSERT",
        description=(
            f"{'Updated' if rule_id else 'Created'} commission rule — "
            f"{rule.plan_name or 'override'} @ {rule.commission_percent}%"
        ),
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(rule)
    return rule


@router.delete("/commissions/rules/{rule_id}")
async def delete_commission_rule(
    rule_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.commissions.write")),
):
    rule = await session.get(CommissionRule, rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=rule.hotel_id,
        action="COMMISSION_RULE_DELETE",
        description=f"Deleted commission rule {rule_id}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(rule)
    await session.commit()
    return {"message": "Deleted"}


@router.get("/commissions/ledger")
async def list_ledger(
    session: DbSession,
    hotel_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    super_admin: User = Depends(require_permission("superadmin.commissions.read")),
):
    q = select(CommissionLedger)
    if hotel_id:
        q = q.where(CommissionLedger.hotel_id == hotel_id)
    if status_filter:
        q = q.where(CommissionLedger.status == status_filter)
    q = q.order_by(CommissionLedger.created_at.desc()).limit(limit)
    return (await session.execute(q)).scalars().all()


@router.get("/commissions/summary")
async def commissions_summary(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.commissions.read")),
):
    """Aggregated commission stats for the dashboard."""
    total_take = (await session.execute(select(func.sum(CommissionLedger.platform_take)))).scalar() or 0
    pending = (await session.execute(
        select(func.sum(CommissionLedger.platform_take)).where(CommissionLedger.status == "accrued")
    )).scalar() or 0
    paid = (await session.execute(
        select(func.sum(CommissionLedger.platform_take)).where(CommissionLedger.status == "paid")
    )).scalar() or 0
    by_hotel_rows = (await session.execute(
        select(
            CommissionLedger.hotel_id,
            func.sum(CommissionLedger.platform_take).label("take"),
            func.count(CommissionLedger.id).label("count"),
        ).group_by(CommissionLedger.hotel_id)
        .order_by(func.sum(CommissionLedger.platform_take).desc())
        .limit(10)
    )).all()
    top_hotels = []
    for hotel_id, take, count in by_hotel_rows:
        h = await session.get(Hotel, hotel_id)
        top_hotels.append({
            "hotel_id": hotel_id,
            "hotel_name": h.name if h else "Unknown",
            "platform_take": float(take or 0),
            "bookings": int(count or 0),
        })
    return {
        "total_take": float(total_take),
        "pending": float(pending),
        "paid": float(paid),
        "top_hotels": top_hotels,
    }


@router.post("/commissions/ledger")
async def add_ledger_entry(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.commissions.write")),
):
    """Manually add a ledger entry (e.g. adjustment, manual booking)."""
    if not data.get("hotel_id") or "booking_amount" not in data:
        raise HTTPException(400, "hotel_id and booking_amount required")

    booking_amount = float(data["booking_amount"])
    commission_percent = float(data.get("commission_percent", 10))
    fixed_fee = float(data.get("fixed_fee", 0))
    gst_rate = float(data.get("gst_on_commission", 18))

    commission_amount = booking_amount * commission_percent / 100
    gst_amount = commission_amount * gst_rate / 100
    platform_take = commission_amount + fixed_fee + gst_amount
    hotelier_payout = booking_amount - platform_take

    entry = CommissionLedger(
        hotel_id=data["hotel_id"],
        booking_id=data.get("booking_id"),
        payment_id=data.get("payment_id"),
        booking_amount=booking_amount,
        commission_percent=commission_percent,
        commission_amount=commission_amount,
        fixed_fee=fixed_fee,
        gst_amount=gst_amount,
        platform_take=platform_take,
        hotelier_payout=hotelier_payout,
        status=data.get("status", "accrued"),
        currency=data.get("currency", "INR"),
    )
    session.add(entry)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=entry.hotel_id,
        action="COMMISSION_LEDGER_ADD",
        description=f"Manual ledger entry ₹{platform_take:.2f}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(entry)
    return entry


