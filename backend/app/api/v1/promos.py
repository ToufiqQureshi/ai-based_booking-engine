from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, or_
from typing import List, Optional
from datetime import datetime, date

from app.api.deps import DbSession, CurrentUser
from app.models.promo import PromoCode
from app.models.hotel import Hotel

router = APIRouter()

@router.get("/", response_model=List[PromoCode])
async def list_promos(
    current_user: CurrentUser,
    session: DbSession
):
    """List all promo codes for a hotel"""
    query = select(PromoCode).where(PromoCode.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/", response_model=PromoCode)
async def create_promo(
    promo: PromoCode,
    current_user: CurrentUser,
    session: DbSession
):
    """Create a new promo code"""
    promo.hotel_id = current_user.hotel_id # Ensure tenant isolation

    # Check if code exists
    existing_query = select(PromoCode).where(
        PromoCode.code == promo.code,
        PromoCode.hotel_id == current_user.hotel_id
    )
    result = await session.execute(existing_query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Promo code already exists")
        
    session.add(promo)
    await session.commit()
    await session.refresh(promo)
    return promo

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
    return {"ok": True}

from pydantic import BaseModel

class ValidatePromoRequest(BaseModel):
    code: str
    hotel_id: str
    booking_amount: float

from app.core.limiter import limiter
from fastapi import Request

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

    query = select(PromoCode).where(
        PromoCode.code == code,
        or_(PromoCode.hotel_id == hotel_id, PromoCode.chain_id == chain_id),
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
    discount = 0.0
    if promo.discount_type == "percentage":
        discount = (booking_amount * promo.discount_value) / 100
    else:
        discount = promo.discount_value
        
    # Ensure discount doesn't exceed total amount
    if discount > booking_amount:
        discount = booking_amount
        
    return {
        "valid": True,
        "code": promo.code,
        "discount": round(discount, 2),
        "final_amount": round(booking_amount - discount, 2),
        "message": "Coupon applied successfully!"
    }
