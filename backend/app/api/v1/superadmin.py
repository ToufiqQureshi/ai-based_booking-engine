from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from typing import List, Optional
from app.api.deps import CurrentUser, DbSession
from app.models.user import User, UserRole
from app.models.hotel import Hotel, HotelUpdate
from app.models.subscription import Subscription
from datetime import datetime

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])

# Dependency to check if user is Super Admin
async def get_super_admin(current_user: CurrentUser):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can access this resource"
        )
    return current_user

@router.get("/hotels", response_model=List[dict])
async def list_hotels(
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """List all hotels with subscription details"""
    result = await session.execute(select(Hotel))
    hotels = result.scalars().all()
    
    final_result = []
    for hotel in hotels:
        # Get primary owner
        owner_res = await session.execute(
            select(User).where(User.hotel_id == hotel.id, User.role == UserRole.OWNER)
        )
        owner = owner_res.scalar_one_or_none()
        
        # Get subscription
        sub_res = await session.execute(
            select(Subscription).where(Subscription.hotel_id == hotel.id)
        )
        sub = sub_res.scalar_one_or_none()
        
        final_result.append({
            "id": hotel.id,
            "name": hotel.name,
            "slug": hotel.slug,
            "is_active": hotel.is_active,
            "owner_email": owner.email if owner else "N/A",
            "owner_name": owner.name if owner else "N/A",
            "feature_ai_agent": hotel.feature_ai_agent,
            "feature_guest_bot": hotel.feature_guest_bot,
            "feature_rate_shopper": hotel.feature_rate_shopper,
            "subscription": {
                "plan": sub.plan_name if sub else "None",
                "status": sub.status if sub else "inactive",
                "end_date": sub.end_date.isoformat() if sub and sub.end_date else None
            } if sub else None
        })
    
    return final_result

@router.patch("/hotels/{hotel_id}")
async def update_hotel_status(
    hotel_id: str,
    update_data: HotelUpdate,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Update hotel feature flags and active status"""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    db_data = update_data.model_dump(exclude_unset=True)
    for key, value in db_data.items():
        setattr(hotel, key, value)
    
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)
    return hotel

@router.post("/hotels/{hotel_id}/subscription")
async def update_subscription(
    hotel_id: str,
    sub_data: dict, # plan_name, status, end_date (ISO string)
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Create or update subscription for a hotel"""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    sub_res = await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel_id)
    )
    sub = sub_res.scalar_one_or_none()
    
    if not sub:
        sub = Subscription(
            hotel_id=hotel_id,
            plan_name=sub_data.get("plan_name", "Basic"),
            status=sub_data.get("status", "active"),
            end_date=datetime.fromisoformat(sub_data["end_date"]) if sub_data.get("end_date") else None
        )
    else:
        if "plan_name" in sub_data: sub.plan_name = sub_data["plan_name"]
        if "status" in sub_data: sub.status = sub_data["status"]
        if "end_date" in sub_data and sub_data["end_date"]: 
            sub.end_date = datetime.fromisoformat(sub_data["end_date"])
        sub.updated_at = datetime.utcnow()
    
    session.add(sub)
    await session.commit()
    return {"message": "Subscription updated successfully"}

@router.get("/users", response_model=List[dict])
async def list_users(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
    query: Optional[str] = None
):
    """List all users for admin management"""
    stmt = select(User)
    if query:
        stmt = stmt.where(User.email.contains(query) | User.name.contains(query))
    
    result = await session.execute(stmt)
    users = result.scalars().all()
    
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "hotel_id": u.hotel_id,
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in users
    ]

@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: str,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Update a user's role (e.g., promote to SUPER_ADMIN)"""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")
    
    user.role = UserRole(role)
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    return {"message": f"User role updated to {role}"}

@router.delete("/hotels/{hotel_id}")
async def delete_hotel(
    hotel_id: str,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Delete a hotel and all its associated data (Careful!)"""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    await session.delete(hotel)
    await session.commit()
    return {"message": "Hotel and associated data deleted successfully"}
