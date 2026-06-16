"""
Super Admin — Subscriptions, quotas, plan features, broadcasts, audit logs.
"""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import select

from app.core.auth.deps import DbSession
from app.system.audit import AuditLog, SystemBroadcast
from app.brand_console.hotel import Hotel
from app.superadmin.subscriptions.subscription import Subscription
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, load_plan_features, save_plan_features, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/hotels/{hotel_id}/subscription")
async def update_subscription(
    hotel_id: str, sub_data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.subscriptions.write")),
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
    super_admin: User = Depends(require_permission("superadmin.subscriptions.write")),
):
    sub = (await session.execute(select(Subscription).where(Subscription.hotel_id == hotel_id))).scalar_one_or_none()
    if not sub:
        sub = Subscription(hotel_id=hotel_id)
    if "whatsapp_credits" in data: sub.whatsapp_credits = data["whatsapp_credits"]
    if "sms_credits" in data: sub.sms_credits = data["sms_credits"]
    if "ai_hotelier_daily_limit" in data: sub.ai_hotelier_daily_limit = data["ai_hotelier_daily_limit"]
    if "ai_guest_chat_daily_limit" in data: sub.ai_guest_chat_daily_limit = data["ai_guest_chat_daily_limit"]
    if "ai_whatsapp_daily_limit" in data: sub.ai_whatsapp_daily_limit = data["ai_whatsapp_daily_limit"]
    sub.updated_at = datetime.utcnow()
    session.add(sub)

    hotel = await session.get(Hotel, hotel_id)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=hotel_id,
        action="UPDATE_QUOTAS",
        description=f"Updated quotas for hotel '{hotel.name if hotel else hotel_id}': WA={sub.whatsapp_credits}, SMS={sub.sms_credits}, AI_hotelier={sub.ai_hotelier_daily_limit}, AI_guest={sub.ai_guest_chat_daily_limit}, AI_whatsapp={sub.ai_whatsapp_daily_limit}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return {"message": "Quotas updated successfully", "quotas": sub}


@router.get("/hotels/{hotel_id}/ai-usage")
async def get_hotel_ai_usage(
    hotel_id: str,
    session: DbSession,
    days: int = Query(default=7, ge=1, le=35, description="Number of past days to return (max 35)"),
    super_admin: User = Depends(require_permission("superadmin.subscriptions.read")),
):
    """Return per-agent, per-day token usage and subscription limits for a hotel.

    Reads daily counters from Redis (key: ai_tokens:{agent_type}:{hotel_id}:{YYYYMMDD}).
    Returns zeroes for days with no recorded usage.
    """
    from app.core.cache.redis_client import redis_client
    from app.core.utils.time import utcnow

    r = redis_client.get_instance()
    today = utcnow().date()
    today_iso = today.isoformat()

    agent_types = ["hotelier", "guest", "whatsapp"]

    # Build per-agent daily breakdown
    per_agent: dict[str, dict] = {}
    for agent in agent_types:
        daily: dict[str, int] = {}
        total = 0
        for i in range(days):
            day = today - timedelta(days=i)
            day_str = day.strftime("%Y%m%d")
            tokens = 0
            if r:
                raw = r.get(f"ai_tokens:{agent}:{hotel_id}:{day_str}")
                tokens = int(raw) if raw else 0
            daily[day.isoformat()] = tokens
            total += tokens
        per_agent[agent] = {
            "today_tokens": daily.get(today_iso, 0),
            "period_total": total,
            "daily_usage": daily,
        }

    sub = (await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel_id)
    )).scalar_one_or_none()

    return {
        "hotel_id": hotel_id,
        "period_days": days,
        "redis_available": r is not None,
        "limits": {
            "hotelier": sub.ai_hotelier_daily_limit if sub else 0,
            "guest":    sub.ai_guest_chat_daily_limit if sub else 0,
            "whatsapp": sub.ai_whatsapp_daily_limit if sub else 0,
        },
        "usage": per_agent,
    }


@router.get("/plan-features")
async def get_plan_features(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.subscriptions.read")),
):
    return load_plan_features()


@router.post("/plan-features")
async def update_plan_features(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.subscriptions.write")),
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
    include_scheduled: bool = True,
    super_admin: User = Depends(get_super_admin),
):
    q = select(SystemBroadcast).where(SystemBroadcast.is_active == True)
    if not include_scheduled:
        q = q.where(SystemBroadcast.is_published == True)
    q = q.order_by(SystemBroadcast.created_at.desc())
    result = await session.execute(q)
    return result.scalars().all()


@router.post("/broadcasts")
async def create_broadcast(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    scheduled_at = None
    if data.get("scheduled_at"):
        scheduled_at = datetime.fromisoformat(data["scheduled_at"])
    expires_at = None
    if data.get("expires_at"):
        expires_at = datetime.fromisoformat(data["expires_at"])
    is_published = True
    if scheduled_at and scheduled_at > datetime.utcnow():
        is_published = False

    broadcast = SystemBroadcast(
        title=data["title"], message=data["message"],
        type=data.get("type", "info"),
        is_active=data.get("is_active", True),
        scheduled_at=scheduled_at,
        expires_at=expires_at,
        is_published=is_published,
        target_plans=data.get("target_plans", []),
        target_hotel_ids=data.get("target_hotel_ids", []),
        created_by=super_admin.id,
    )
    session.add(broadcast)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="CREATE_BROADCAST",
        description=(
            f"Created broadcast '{broadcast.title}'"
            + (f" (scheduled for {scheduled_at.isoformat()})" if scheduled_at and not is_published else "")
        ),
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(broadcast)
    return broadcast


@router.patch("/broadcasts/{broadcast_id}")
async def update_broadcast(
    broadcast_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    bc = await session.get(SystemBroadcast, broadcast_id)
    if not bc:
        raise HTTPException(404, "Broadcast not found")
    for k in ("title", "message", "type", "is_active", "is_published",
              "target_plans", "target_hotel_ids"):
        if k in data:
            setattr(bc, k, data[k])
    if "scheduled_at" in data:
        bc.scheduled_at = datetime.fromisoformat(data["scheduled_at"]) if data["scheduled_at"] else None
    if "expires_at" in data:
        bc.expires_at = datetime.fromisoformat(data["expires_at"]) if data["expires_at"] else None
    session.add(bc)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action="UPDATE_BROADCAST",
        description=f"Updated broadcast '{bc.title}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return bc


@router.post("/broadcasts/publish-due")
async def publish_due_broadcasts(
    request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Publishes any scheduled broadcasts whose scheduled_at has passed."""
    now = datetime.utcnow()
    due = (await session.execute(
        select(SystemBroadcast).where(
            SystemBroadcast.is_published == False,
            SystemBroadcast.is_active == True,
            SystemBroadcast.scheduled_at.is_not(None),
            SystemBroadcast.scheduled_at <= now,
        )
    )).scalars().all()
    for bc in due:
        bc.is_published = True
        session.add(bc)
    if due:
        session.add(AuditLog(
            user_id=super_admin.id, user_email=super_admin.email,
            action="BROADCAST_AUTO_PUBLISH",
            description=f"Auto-published {len(due)} scheduled broadcasts",
            ip_address=_get_client_ip(request),
        ))
        await session.commit()
    return {"published": len(due), "ids": [b.id for b in due]}


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


