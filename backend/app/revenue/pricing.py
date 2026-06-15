"""
Hotelier-facing CRUD for dynamic pricing rules.

The hotelier owns the strategy: they create / edit / delete rules and the
engine applies them. All writes are OWNER/MANAGER only; reads allow STAFF.
Every rule is tenant-scoped by hotel_id, and a room-scoped rule is validated
to belong to the caller's hotel (IDOR guard).
"""
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from app.core.deps import DbSession, CurrentUser, require_hotel_role
from app.rooms.room import RoomType
from app.revenue.pricing_model import PricingRule, RULE_TYPES, ADJUSTMENT_TYPES

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class PricingRuleCreate(BaseModel):
    name: str = "Untitled rule"
    rule_type: str = "occupancy"
    room_type_id: Optional[str] = None
    is_active: bool = True
    adjustment_type: str = "percentage"
    adjustment_value: float = 0.0
    priority: int = 0
    occupancy_min: Optional[float] = None
    occupancy_max: Optional[float] = None
    days_of_week: List[int] = []
    lead_time_min: Optional[int] = None
    lead_time_max: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None


class PricingRuleUpdate(BaseModel):
    name: Optional[str] = None
    rule_type: Optional[str] = None
    room_type_id: Optional[str] = None
    is_active: Optional[bool] = None
    adjustment_type: Optional[str] = None
    adjustment_value: Optional[float] = None
    priority: Optional[int] = None
    occupancy_min: Optional[float] = None
    occupancy_max: Optional[float] = None
    days_of_week: Optional[List[int]] = None
    lead_time_min: Optional[int] = None
    lead_time_max: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _assert_room_belongs_to_hotel(session, room_type_id: str, hotel_id: str) -> None:
    """IDOR guard: a room-scoped rule may only reference this hotel's rooms."""
    room = await session.get(RoomType, room_type_id)
    if not room or room.hotel_id != hotel_id:
        raise HTTPException(status_code=400, detail="Invalid room_type_id for this hotel")


def _validate_rule_fields(rule_type: str, adjustment_type: str) -> None:
    if rule_type not in RULE_TYPES:
        raise HTTPException(status_code=400, detail=f"rule_type must be one of {sorted(RULE_TYPES)}")
    if adjustment_type not in ADJUSTMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"adjustment_type must be one of {sorted(ADJUSTMENT_TYPES)}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER", "STAFF"))])
async def list_pricing_rules(current_user: CurrentUser, session: DbSession):
    """List all dynamic pricing rules for the caller's hotel."""
    rules = (await session.execute(
        select(PricingRule)
        .where(PricingRule.hotel_id == current_user.hotel_id)
        .order_by(PricingRule.priority, PricingRule.created_at)
    )).scalars().all()
    return rules


@router.post("", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_pricing_rule(
    data: PricingRuleCreate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Create a dynamic pricing rule scoped to the caller's hotel."""
    _validate_rule_fields(data.rule_type, data.adjustment_type)
    if data.room_type_id:
        await _assert_room_belongs_to_hotel(session, data.room_type_id, current_user.hotel_id)

    rule = PricingRule(
        hotel_id=current_user.hotel_id,
        chain_id=getattr(current_user, "chain_id", None),
        **data.model_dump(),
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


@router.put("/{rule_id}", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_pricing_rule(
    rule_id: str,
    data: PricingRuleUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    """Update a rule. IDOR-guarded: the rule must belong to the caller's hotel."""
    rule = await session.get(PricingRule, rule_id)
    if not rule or rule.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Pricing rule not found")

    payload = data.model_dump(exclude_unset=True)
    if "rule_type" in payload or "adjustment_type" in payload:
        _validate_rule_fields(
            payload.get("rule_type", rule.rule_type),
            payload.get("adjustment_type", rule.adjustment_type),
        )
    if payload.get("room_type_id"):
        await _assert_room_belongs_to_hotel(session, payload["room_type_id"], current_user.hotel_id)

    for field, value in payload.items():
        setattr(rule, field, value)
    rule.updated_at = datetime.utcnow()
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


@router.delete("/{rule_id}", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_pricing_rule(
    rule_id: str,
    current_user: CurrentUser,
    session: DbSession,
):
    """Delete a rule. IDOR-guarded by hotel_id."""
    rule = await session.get(PricingRule, rule_id)
    if not rule or rule.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    await session.delete(rule)
    await session.commit()
    return {"status": "deleted", "id": rule_id}
