from typing import List, Optional
from datetime import date
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from sqlmodel import select, or_, and_

from app.api.deps import CurrentUser, DbSession
from app.models.promo import PromoCode
from app.models.hotel import Hotel
from pydantic import BaseModel
from app.core.limiter import limiter

router = APIRouter(prefix="/promos", tags=["Promos"])

class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str # percentage / fixed_amount
    discount_value: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_usage: Optional[int] = None
    is_active: bool = True

class ValidatePromoRequest(BaseModel):
    code: str
    hotel_id: str
    booking_amount: float

@router.get("", response_model=List[PromoCode])
async def get_promos(current_user: CurrentUser, session: DbSession):
    """Hotel ke saare promo codes get karo"""
    result = await session.execute(
        select(PromoCode).where(PromoCode.hotel_id == current_user.hotel_id)
    )
    return result.scalars().all()

@router.post("", response_model=PromoCode)
async def create_promo(
    promo_data: PromoCodeCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """New promo code create karo"""
    # Check if code already exists for this hotel
    existing = await session.execute(
        select(PromoCode).where(
            PromoCode.code == promo_data.code,
            PromoCode.hotel_id == current_user.hotel_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Promo code already exists")
        
    promo = PromoCode(
        **promo_data.model_dump(),
        hotel_id=current_user.hotel_id
    )
    session.add(promo)
    await session.commit()
    await session.refresh(promo)
    return promo

@router.post("/validate")
@limiter.limit("10/minute")
async def validate_promo(
    request: Request,
    payload: ValidatePromoRequest,
    session: DbSession
):
    """
    Validate a promo code and calculate discount.
    Returns: { "valid": bool, "discount": float, "final_amount": float, "message": str }
    """
    code = payload.code
    hotel_id = payload.hotel_id
    booking_amount = payload.booking_amount

    # Get hotel's chain_id
    hotel_res = await session.execute(select(Hotel.chain_id).where(Hotel.id == hotel_id))
    chain_id = hotel_res.scalar_one_or_none()

    # FIX: IDOR bug — if both hotel_id and chain_id are null/missing in the query,
    # it matches ANY promo where hotel_id is null or chain_id is null.
    # We must ensure we only match promos specifically for THIS hotel or its chain.
    clauses = [PromoCode.hotel_id == hotel_id]
    if chain_id:
        clauses.append(PromoCode.chain_id == chain_id)

    query = select(PromoCode).where(
        PromoCode.code == code,
        or_(*clauses),
        PromoCode.is_active == True
    )
    result = await session.execute(query)
    promo = result.scalar_one_or_none()
    
    if not promo:
        return {"valid": False, "message": "Invalid coupon code", "discount": 0}
        
    # Check Dates
    today = date.today()
    if promo.start_date and today < promo.start_date:
        return {"valid": False, "message": "Coupon not yet active", "discount": 0}
    if promo.end_date and today > promo.end_date:
        return {"valid": False, "message": "Coupon expired", "discount": 0}
        
    # Check Usage
    if promo.max_usage is not None and promo.current_usage >= promo.max_usage:
        return {"valid": False, "message": "Coupon usage limit exceeded", "discount": 0}
        
    # Calculate Discount
    discount = 0
    if promo.discount_type == "percentage":
        discount = (booking_amount * promo.discount_value) / 100
    else:
        discount = promo.discount_value
        
    # Ensure discount doesn't exceed booking amount
    discount = min(discount, booking_amount)
    final_amount = booking_amount - discount

    return {
        "valid": True,
        "discount": discount,
        "final_amount": final_amount,
        "message": f"Promo code applied: {promo.code}"
    }

@router.delete("/{promo_id}")
async def delete_promo(
    promo_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """Delete a promo code"""
    promo = await session.get(PromoCode, promo_id)
    if not promo or promo.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Promo not found")

    await session.delete(promo)
    await session.commit()
    return {"message": "Promo deleted successfully"}
