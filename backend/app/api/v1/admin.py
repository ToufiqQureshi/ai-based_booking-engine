from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, func
from typing import List
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.models.user import User, UserRole
from app.models.hotel import Hotel
from app.models.subscription import Subscription

router = APIRouter(prefix="/admin", tags=["Super Admin"])

def check_admin_access(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user

class SubscriptionCreate(BaseModel):
    hotel_id: str
    plan_name: str
    end_date: datetime
    amount: float = 0.0

@router.get("/stats")
async def get_admin_stats(
    session: DbSession,
    current_user: User = Depends(check_admin_access)
):
    """
    Get Global System Stats for Admin Dashboard.
    """
    # 1. User Stats
    total_users = (await session.execute(select(func.count(User.id)))).one()[0]
    total_hotels = (await session.execute(select(func.count(Hotel.id)))).one()[0]
    
    # 2. Subscription Stats
    active_subscriptions = (await session.execute(
        select(func.count(Subscription.id)).where(Subscription.status == "active")
    )).one()[0]

    return {
        "users": {
            "total": total_users,
            "active_now": 1, 
        },
        "hotels": {
            "total": total_hotels,
            "subscribed": active_subscriptions
        },
        "system_status": "Operational"
    }

@router.get("/subscriptions")
async def list_all_subscriptions(
    session: DbSession,
    current_user: User = Depends(check_admin_access)
):
    """List all subscriptions with hotel details."""
    result = await session.execute(select(Subscription).order_by(Subscription.end_date.desc()))
    return result.scalars().all()

@router.post("/subscriptions")
async def create_or_renew_subscription(
    sub_data: SubscriptionCreate,
    session: DbSession,
    current_user: User = Depends(check_admin_access)
):
    """Create or Renew subscription for a hotel."""
    hotel = await session.get(Hotel, sub_data.hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    # Deactivate any existing active subscriptions for this hotel
    old_subs = (await session.execute(
        select(Subscription).where(Subscription.hotel_id == sub_data.hotel_id, Subscription.status == "active")
    )).scalars().all()
    for s in old_subs:
        s.status = "expired"
        session.add(s)
        
    subscription = Subscription(
        hotel_id=sub_data.hotel_id,
        plan_name=sub_data.plan_name,
        end_date=sub_data.end_date,
        amount=sub_data.amount,
        status="active",
        payment_status="paid"
    )
    
    # Also ensure hotel is active if they paid
    hotel.is_active = True
    
    session.add(subscription)
    session.add(hotel)
    await session.commit()
    await session.refresh(subscription)
    return subscription

@router.get("/users")
async def list_all_users(
    session: DbSession,
    current_user: User = Depends(check_admin_access)
):
    # Admin Only: List all users
    users = (await session.execute(select(User).limit(50))).scalars().all()
    return users

@router.get("/hotels")
async def list_all_hotels(
    session: DbSession,
    current_user: User = Depends(check_admin_access)
):
    """
    List all hotels with their status and feature flags.
    """
    hotels = (await session.execute(select(Hotel).limit(50))).scalars().all()
    return hotels

class HotelAdminUpdate(BaseModel):
    is_active: bool = None
    feature_ai_agent: bool = None
    feature_guest_bot: bool = None

@router.patch("/hotels/{hotel_id}")
async def update_hotel_status(
    hotel_id: str,
    update_data: HotelAdminUpdate,
    session: DbSession,
    current_user: User = Depends(check_admin_access)
):
    """
    Enable/Disable Hotel or Toggle Features.
    """
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    if update_data.is_active is not None:
        hotel.is_active = update_data.is_active
    if update_data.feature_ai_agent is not None:
        hotel.feature_ai_agent = update_data.feature_ai_agent
    if update_data.feature_guest_bot is not None:
        hotel.feature_guest_bot = update_data.feature_guest_bot
        
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)
    return hotel
