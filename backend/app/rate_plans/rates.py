"""
Rates Router — Rate Plan CRUD.
"""
from typing import List

from fastapi import Depends, APIRouter, HTTPException, status

from app.core.auth.deps import CurrentUser, DbSession, require_hotel_role
from app.calendar import clear_availability_cache
from app.core.cache.redis_client import redis_client
from app.ai_engine.guest_agent import invalidate_guest_agent_cache
from app.revenue.rate_signals import bump_rate_version
from app.rate_plans.rates_model import RatePlan, RatePlanCreate, RatePlanRead
from sqlmodel import select

router = APIRouter(prefix="/rates", tags=["Rates"])


def _clear_rate_caches(hotel_id: str):
    """Clear availability + public room search + guest agent cache when rates change."""
    clear_availability_cache(hotel_id)
    redis_client.delete_pattern(f"public:rooms:{hotel_id}:*")
    redis_client.delete_pattern(f"rooms:{hotel_id}:*")
    invalidate_guest_agent_cache(hotel_id)
    # Rate plan changes can affect any room using that plan — signal all rooms
    bump_rate_version(hotel_id)


@router.get("/plans", response_model=List[RatePlanRead])
async def get_rate_plans(current_user: CurrentUser, session: DbSession):
    result = await session.execute(
        select(RatePlan).where(RatePlan.hotel_id == current_user.hotel_id)
    )
    return result.scalars().all()


@router.patch("/plans/{plan_id}", response_model=RatePlanRead, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_rate_plan(
    plan_id: str,
    plan_update: RatePlanCreate,
    current_user: CurrentUser,
    session: DbSession,
):
    result = await session.execute(
        select(RatePlan).where(RatePlan.id == plan_id, RatePlan.hotel_id == current_user.hotel_id)
    )
    rate_plan = result.scalar_one_or_none()
    if not rate_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rate plan not found")

    for key, value in plan_update.model_dump(exclude_unset=True).items():
        setattr(rate_plan, key, value)
    session.add(rate_plan)
    await session.commit()
    await session.refresh(rate_plan)
    _clear_rate_caches(current_user.hotel_id)
    return rate_plan


@router.post("/plans", response_model=RatePlanRead, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_rate_plan(plan_data: RatePlanCreate, current_user: CurrentUser, session: DbSession):
    rate_plan = RatePlan(**plan_data.model_dump(), hotel_id=current_user.hotel_id)
    session.add(rate_plan)
    await session.commit()
    await session.refresh(rate_plan)
    _clear_rate_caches(current_user.hotel_id)
    return rate_plan


@router.delete("/plans/{plan_id}", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_rate_plan(plan_id: str, current_user: CurrentUser, session: DbSession):
    result = await session.execute(
        select(RatePlan).where(RatePlan.id == plan_id, RatePlan.hotel_id == current_user.hotel_id)
    )
    rate_plan = result.scalar_one_or_none()
    if not rate_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rate plan not found")

    await session.delete(rate_plan)
    await session.commit()
    _clear_rate_caches(current_user.hotel_id)
    return {"message": "Rate plan deleted"}


