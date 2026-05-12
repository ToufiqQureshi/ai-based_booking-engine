from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from app.db.database import get_session
from app.models.user import User, UserRole
from app.models.hotel import Hotel, HotelUpdate
from app.models.subscription import Subscription
from app.api.deps import get_current_user
from datetime import datetime

router = APIRouter()

# Dependency to check if user is Super Admin
def get_super_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FOR_RE_FORBIDDEN,
            detail="Only super admins can access this resource"
        )
    return current_user

@router.get("/hotels", response_model=List[dict])
def list_hotels(
    session: Session = Depends(get_session),
    super_admin: User = Depends(get_super_admin)
):
    """List all hotels with subscription details"""
    statement = select(Hotel)
    hotels = session.exec(statement).all()
    
    result = []
    for hotel in hotels:
        # Get primary owner
        owner = session.exec(select(User).where(User.hotel_id == hotel.id, User.role == UserRole.OWNER)).first()
        
        # Get subscription
        sub = session.exec(select(Subscription).where(Subscription.hotel_id == hotel.id)).first()
        
        result.append({
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
                "end_date": sub.end_date if sub else None
            } if sub else None
        })
    
    return result

@router.patch("/hotels/{hotel_id}")
def update_hotel_status(
    hotel_id: str,
    update_data: HotelUpdate,
    session: Session = Depends(get_session),
    super_admin: User = Depends(get_super_admin)
):
    """Update hotel feature flags and active status"""
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    db_data = update_data.model_dump(exclude_unset=True)
    for key, value in db_data.items():
        setattr(hotel, key, value)
    
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)
    session.commit()
    session.refresh(hotel)
    return hotel

@router.post("/hotels/{hotel_id}/subscription")
def update_subscription(
    hotel_id: str,
    sub_data: dict, # plan_name, status, end_date (ISO string)
    session: Session = Depends(get_session),
    super_admin: User = Depends(get_super_admin)
):
    """Create or update subscription for a hotel"""
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    sub = session.exec(select(Subscription).where(Subscription.hotel_id == hotel_id)).first()
    
    if not sub:
        sub = Subscription(
            hotel_id=hotel_id,
            plan_name=sub_data.get("plan_name", "Basic"),
            status=sub_data.get("status", "active"),
            end_date=datetime.fromisoformat(sub_data["end_date"])
        )
    else:
        if "plan_name" in sub_data: sub.plan_name = sub_data["plan_name"]
        if "status" in sub_data: sub.status = sub_data["status"]
        if "end_date" in sub_data: sub.end_date = datetime.fromisoformat(sub_data["end_date"])
        sub.updated_at = datetime.utcnow()
    
    session.add(sub)
    session.commit()
    return {"message": "Subscription updated successfully"}
