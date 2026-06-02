"""
Rates Router
Manage Rate Plans
"""
from typing import List
from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.models.rates import RatePlan, RatePlanCreate, RatePlanRead
from app.api.v1.availability import clear_availability_cache

router = APIRouter(prefix="/rates", tags=["Rates"])

@router.get("/plans", response_model=List[RatePlanRead])
async def get_rate_plans(current_user: CurrentUser, session: DbSession):
    """Get all rate plans"""
    result = await session.execute(
        select(RatePlan).where(RatePlan.hotel_id == current_user.hotel_id)
    )
    return result.scalars().all()

@router.patch("/plans/{plan_id}", response_model=RatePlanRead)
async def update_rate_plan(
    plan_id: str,
    plan_update: RatePlanCreate, # Using Create model for now as partial update
    current_user: CurrentUser,
    session: DbSession
):
    """Update a rate plan"""
    result = await session.execute(
        select(RatePlan).where(
            RatePlan.id == plan_id,
            RatePlan.hotel_id == current_user.hotel_id
        )
    )
    rate_plan = result.scalar_one_or_none()
    
    if not rate_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate plan not found"
        )
        
    plan_data = plan_update.model_dump(exclude_unset=True)
    for key, value in plan_data.items():
        setattr(rate_plan, key, value)
        
    session.add(rate_plan)
    await session.commit()
    await session.refresh(rate_plan)
    clear_availability_cache(current_user.hotel_id)
    return rate_plan

@router.post("/plans", response_model=RatePlanRead)
async def create_rate_plan(
    plan_data: RatePlanCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """Create a new rate plan"""
    rate_plan = RatePlan(
        **plan_data.model_dump(),
        hotel_id=current_user.hotel_id
    )
    session.add(rate_plan)
    await session.commit()
    await session.refresh(rate_plan)
    clear_availability_cache(current_user.hotel_id)
    return rate_plan

@router.delete("/plans/{plan_id}")
async def delete_rate_plan(plan_id: str, current_user: CurrentUser, session: DbSession):
    """Delete a rate plan"""
    result = await session.execute(
        select(RatePlan).where(
            RatePlan.id == plan_id,
            RatePlan.hotel_id == current_user.hotel_id
        )
    )
    rate_plan = result.scalar_one_or_none()
    
    if not rate_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rate plan not found"
        )
        
    await session.delete(rate_plan)
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    return {"message": "Rate plan deleted"}
