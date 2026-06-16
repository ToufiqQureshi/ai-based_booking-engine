"""
Super Admin — Bulk hotel operations.
"""
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import select

from app.core.auth.deps import DbSession
from app.system.audit import AuditLog
from app.brand_console.hotel import Hotel
from app.superadmin.subscriptions.subscription import Subscription
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, load_plan_features

logger = logging.getLogger(__name__)
router = APIRouter()


class BulkActionPayload(BaseModel):
    hotel_ids: List[str]
    action: str             # enable | disable | pause | unpause | set_plan | update_quotas
    plan_name: str | None = None
    whatsapp_credits: int | None = None
    sms_credits: int | None = None
    ai_hotelier_daily_limit: int | None = None
    ai_guest_chat_daily_limit: int | None = None
    ai_whatsapp_daily_limit: int | None = None


@router.post("/hotels/bulk")
async def bulk_hotel_action(
    payload: BulkActionPayload,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Apply an action to multiple hotels at once."""
    if not payload.hotel_ids:
        raise HTTPException(status_code=400, detail="hotel_ids cannot be empty")
    if len(payload.hotel_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 hotels per bulk operation")

    VALID_ACTIONS = {"enable", "disable", "pause", "unpause", "set_plan", "update_quotas"}
    if payload.action not in VALID_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {VALID_ACTIONS}")

    # Fetch all target hotels in one query
    hotels_res = await session.execute(select(Hotel).where(Hotel.id.in_(payload.hotel_ids)))
    hotels = hotels_res.scalars().all()
    found_ids = {h.id for h in hotels}
    not_found = [hid for hid in payload.hotel_ids if hid not in found_ids]

    results = {"success": [], "failed": []}

    plan_matrix = None
    if payload.action == "set_plan":
        if not payload.plan_name:
            raise HTTPException(status_code=400, detail="plan_name required for set_plan action")
        plan_matrix = load_plan_features()

    for hotel in hotels:
        try:
            if payload.action == "enable":
                hotel.is_active = True
                hotel.is_paused = False
            elif payload.action == "disable":
                hotel.is_active = False
            elif payload.action == "pause":
                hotel.is_paused = True
                hotel.paused_at = datetime.utcnow()
            elif payload.action == "unpause":
                hotel.is_paused = False
                hotel.pause_reason = None
                hotel.paused_at = None

            elif payload.action == "set_plan":
                sub = (await session.execute(
                    select(Subscription).where(Subscription.hotel_id == hotel.id)
                )).scalar_one_or_none()
                if not sub:
                    sub = Subscription(hotel_id=hotel.id)
                sub.plan_name = payload.plan_name
                sub.status = "active"
                sub.updated_at = datetime.utcnow()
                session.add(sub)
                # Sync feature flags
                mapped = payload.plan_name.capitalize()
                if plan_matrix and mapped in plan_matrix:
                    for feat_key, feat_val in plan_matrix[mapped].items():
                        setattr(hotel, feat_key, feat_val)

            elif payload.action == "update_quotas":
                sub = (await session.execute(
                    select(Subscription).where(Subscription.hotel_id == hotel.id)
                )).scalar_one_or_none()
                if not sub:
                    sub = Subscription(hotel_id=hotel.id)
                if payload.whatsapp_credits is not None:
                    sub.whatsapp_credits = payload.whatsapp_credits
                if payload.sms_credits is not None:
                    sub.sms_credits = payload.sms_credits
                if payload.ai_hotelier_daily_limit is not None:
                    sub.ai_hotelier_daily_limit = payload.ai_hotelier_daily_limit
                if payload.ai_guest_chat_daily_limit is not None:
                    sub.ai_guest_chat_daily_limit = payload.ai_guest_chat_daily_limit
                if payload.ai_whatsapp_daily_limit is not None:
                    sub.ai_whatsapp_daily_limit = payload.ai_whatsapp_daily_limit
                sub.updated_at = datetime.utcnow()
                session.add(sub)

            hotel.updated_at = datetime.utcnow()
            session.add(hotel)
            results["success"].append(hotel.id)

        except Exception as e:
            logger.error("Bulk action failed for hotel %s: %s", hotel.id, e)
            results["failed"].append({"id": hotel.id, "error": str(e)})

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email,
        action=f"BULK_{payload.action.upper()}",
        description=f"Bulk '{payload.action}' on {len(results['success'])} hotels",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()

    return {
        "action": payload.action,
        "processed": len(results["success"]),
        "failed": len(results["failed"]),
        "not_found": not_found,
        "details": results,
    }


