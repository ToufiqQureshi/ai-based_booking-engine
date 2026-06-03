"""
Super Admin — Subscriptions, quotas, plan features, broadcasts, audit logs.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select

from app.api.deps import DbSession
from app.models.audit import AuditLog, SystemBroadcast
from app.models.hotel import Hotel
from app.models.subscription import Subscription
from app.models.user import User
from .hotels import get_super_admin, load_plan_features, save_plan_features, _get_client_ip

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/hotels/{hotel_id}/subscription")
async def update_subscription(
    hotel_id: str, sub_data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Create or update a hotel's subscription and sync feature flags."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    sub = (await session.execute(select(Subscription).where(Subscription.hotel_id == hotel_id))).scalar_one_or_none()
    if not sub:
        sub = Subscription(
            hotel_id=hotel_id,
            plan_name=sub_data.get("plan_name", "Basic"),
            status=sub_data.get("status", "active"),
            end_date=datetime.fromisoformat(sub_data["end_date"]) if sub_data.get("end_date") else None,
        )
    else:
        if "plan_name" in sub_data: sub.plan_name = sub_data["plan_name"]
        if "status" in sub_data: sub.status = sub_data["status"]
        if sub_data.get("end_date"): sub.end_date = datetime.fromisoformat(sub_data["end_date"])
        sub.updated_at = datetime.utcnow()
    session.add(sub)

    plan_matrix = load_plan_features()
    mapped_plan = sub.plan_name if sub.plan_name.lower() not in ["free", "free / trial", "none"] else "Free"
    mapped_plan = mapped_plan.capitalize()
    if mapped_plan in plan_matrix:
        for feat_key, feat_val in plan_matrix[mapped_plan].items():
            setattr(hotel, feat_key, feat_val)
        session.add(hotel)

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="UPDATE_SUBSCRIPTION",
        description=f"Updated subscription for hotel '{hotel.name}': Plan={sub.plan_name}, Status={sub.status}, EndDate={sub.end_date}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "Subscription updated successfully"}


@router.patch("/hotels/{hotel_id}/quotas")
async def update_quotas(
    hotel_id: str, request: Request, data: dict, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    sub = (await session.execute(select(Subscription).where(Subscription.hotel_id == hotel_id))).scalar_one_or_none()
    if not sub:
        sub = Subscription(hotel_id=hotel_id)
    if "whatsapp_credits" in data: sub.whatsapp_credits = data["whatsapp_credits"]
    if "sms_credits" in data: sub.sms_credits = data["sms_credits"]
    if "ai_usage_limit" in data: sub.ai_usage_limit = data["ai_usage_limit"]
    sub.updated_at = datetime.utcnow()
    session.add(sub)

    hotel = await session.get(Hotel, hotel_id)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="UPDATE_QUOTAS",
        description=f"Updated quotas for hotel '{hotel.name if hotel else hotel_id}': WA={sub.whatsapp_credits}, SMS={sub.sms_credits}, AI={sub.ai_usage_limit}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "Quotas updated successfully", "quotas": sub}


@router.get("/plan-features")
async def get_plan_features(super_admin: User = Depends(get_super_admin)):
    return load_plan_features()


@router.post("/plan-features")
async def update_plan_features(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Update plan-to-features mapping and sync all matching hotels."""
    current = load_plan_features()
    for plan, features in data.items():
        if plan in current:
            for feat_key, feat_val in features.items():
                current[plan][feat_key] = bool(feat_val)

    if not save_plan_features(current):
        raise HTTPException(status_code=500, detail="Failed to save plan features configuration")

    for plan, features in current.items():
        subs = (await session.execute(select(Subscription).where(Subscription.plan_name == plan))).scalars().all()
        for hotel_id in [s.hotel_id for s in subs]:
            hotel = await session.get(Hotel, hotel_id)
            if hotel:
                for feat_key, feat_val in features.items():
                    setattr(hotel, feat_key, feat_val)
                session.add(hotel)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="UPDATE_PLAN_FEATURES",
        description="Updated global subscription plan features matrix and synced active properties",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "Plan features updated and hotels synced successfully", "plan_features": current}


@router.get("/audit-logs")
async def get_audit_logs(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
    limit: int = 50,
):
    result = await session.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))
    return result.scalars().all()


@router.get("/broadcasts")
async def get_broadcasts(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    result = await session.execute(
        select(SystemBroadcast).where(SystemBroadcast.is_active == True).order_by(SystemBroadcast.created_at.desc())
    )
    return result.scalars().all()


@router.post("/broadcasts")
async def create_broadcast(
    data: dict, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    broadcast = SystemBroadcast(
        title=data["title"], message=data["message"],
        type=data.get("type", "info"), is_active=data.get("is_active", True),
    )
    session.add(broadcast)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="CREATE_BROADCAST",
        description=f"Created system broadcast: '{broadcast.title}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(broadcast)
    return broadcast


@router.delete("/broadcasts/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    broadcast = await session.get(SystemBroadcast, broadcast_id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="DELETE_BROADCAST",
        description=f"Deleted system broadcast: '{broadcast.title}'",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(broadcast)
    await session.commit()
    return {"message": "Broadcast removed"}
