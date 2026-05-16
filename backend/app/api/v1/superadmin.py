from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from typing import List, Optional
from app.api.deps import CurrentUser, DbSession
from app.models.user import User, UserRole
from app.models.hotel import Hotel, HotelUpdate
from app.models.subscription import Subscription
from app.models.audit import AuditLog, SystemBroadcast
from app.core.config import get_settings
from datetime import datetime
from jose import jwt

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
                "end_date": sub.end_date.isoformat() if sub and sub.end_date else None,
                "whatsapp_credits": sub.whatsapp_credits if sub else 1000,
                "sms_credits": sub.sms_credits if sub else 1000,
                "ai_usage_limit": sub.ai_usage_limit if sub else 50000,
            } if sub else {
                "plan": "None", "status": "inactive", "end_date": None,
                "whatsapp_credits": 1000, "sms_credits": 1000, "ai_usage_limit": 50000
            }
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
    
    # Delete child relations using raw SQL to bypass SQLAlchemy mapped cascades 
    # since many models lack the back-populates relationship with cascade
    from sqlalchemy import text
    import logging
    
    # 1. Deeply nested relations
    deep_queries = [
        "DELETE FROM competitor_rates WHERE competitor_id IN (SELECT id FROM competitors WHERE hotel_id = :id)",
        "DELETE FROM analytics_events WHERE session_id IN (SELECT id FROM analytics_sessions WHERE hotel_id = :id)",
        "DELETE FROM room_amenity_links WHERE room_id IN (SELECT id FROM room_types WHERE hotel_id = :id)",
        "DELETE FROM booking_timeline WHERE booking_id IN (SELECT id FROM bookings WHERE hotel_id = :id)",
        "DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE hotel_id = :id)",
        "DELETE FROM payments WHERE hotel_id = :id"
    ]
    
    for query in deep_queries:
        try:
            async with session.begin_nested():
                await session.execute(text(query), {"id": hotel_id})
        except Exception as e:
            logging.warning(f"Failed executing deep relation cleanup: {e}")
            pass

    # Suspend all users belonging to this hotel using ORM
    users_res = await session.execute(select(User).where(User.hotel_id == hotel_id))
    for u in users_res.scalars().all():
        u.is_active = False
        u.hotel_id = None
        session.add(u)

    # 2. Direct relations (ORDER MATTERS: Delete children first)
    tables = [
        # Level 1: Most dependent
        "channel_logs", "channel_room_mappings", "room_rates", "room_blocks", "room_rate_links",
        # Level 2: Bookings depend on guests, room_types, etc.
        "bookings", 
        # Level 3: Guests and other intermediate parents
        "guests", "rate_plans", "room_types", "competitors", "analytics_sessions",
        # Level 4: Independent relations
        "addons", "amenities", "api_keys", "channel_manager_settings", 
        "integration_settings", "leads", "promo_codes", 
        "user_hotel_links", "subscriptions"
    ]
    
    for table in tables:
        try:
            async with session.begin_nested():
                await session.execute(text(f"DELETE FROM {table} WHERE hotel_id = :id"), {"id": hotel_id})
        except Exception as e:
            logging.warning(f"Failed to delete from {table}: {e}")
            pass 
                
    try:
        await session.delete(hotel)
        await session.commit()
        return {"message": "Hotel and associated data deleted successfully"}
    except Exception as e:
        await session.rollback()
        logging.error(f"Error during final hotel delete: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete hotel: {str(e)}")

@router.post("/impersonate/{hotel_id}")
async def impersonate_hotel(
    hotel_id: str,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Generate impersonation token to login as hotel owner"""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    # Find primary owner or any active user
    result = await session.execute(
        select(User).where(User.hotel_id == hotel_id, User.is_active == True)
    )
    users = result.scalars().all()
    if not users:
        raise HTTPException(status_code=400, detail="No active users found for this hotel")
        
    target_user = next((u for u in users if u.role == UserRole.OWNER), users[0])
    
    settings = get_settings()
    secret = settings.SUPABASE_JWT_SECRET or settings.SECRET_KEY
    payload = {
        "sub": target_user.supabase_id or target_user.id,
        "email": target_user.email,
        "role": target_user.role.value if hasattr(target_user.role, 'value') else str(target_user.role),
        "type": "access",
        "user_metadata": {
            "name": target_user.name,
            "hotel_name": hotel.name,
            "impersonated_by": super_admin.email
        }
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    
    # Audit log
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="IMPERSONATE",
        description=f"Super admin impersonated hotel '{hotel.name}' via user '{target_user.email}'",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    await session.commit()
    
    return {
        "access_token": token,
        "token_type": "Bearer",
        "target_email": target_user.email,
        "target_name": target_user.name,
        "hotel_name": hotel.name
    }

@router.get("/audit-logs")
async def get_audit_logs(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
    limit: int = 50
):
    """Get system audit activity logs"""
    result = await session.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    return result.scalars().all()

@router.get("/broadcasts")
async def get_broadcasts(session: DbSession):
    """Get active broadcasts for display in hotelier dashboard"""
    result = await session.execute(
        select(SystemBroadcast).where(SystemBroadcast.is_active == True).order_by(SystemBroadcast.created_at.desc())
    )
    return result.scalars().all()

@router.post("/broadcasts")
async def create_broadcast(
    data: dict,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Create a new system-wide announcement banner"""
    broadcast = SystemBroadcast(
        title=data["title"],
        message=data["message"],
        type=data.get("type", "info"),
        is_active=data.get("is_active", True)
    )
    session.add(broadcast)
    
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="CREATE_BROADCAST",
        description=f"Created system broadcast: '{broadcast.title}'",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    await session.commit()
    await session.refresh(broadcast)
    return broadcast

@router.delete("/broadcasts/{broadcast_id}")
async def delete_broadcast(
    broadcast_id: str,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    broadcast = await session.get(SystemBroadcast, broadcast_id)
    if not broadcast:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    await session.delete(broadcast)
    await session.commit()
    return {"message": "Broadcast removed"}

@router.patch("/hotels/{hotel_id}/quotas")
async def update_quotas(
    hotel_id: str,
    data: dict,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    sub_res = await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel_id)
    )
    sub = sub_res.scalar_one_or_none()
    if not sub:
        sub = Subscription(hotel_id=hotel_id)
        
    if "whatsapp_credits" in data: sub.whatsapp_credits = data["whatsapp_credits"]
    if "sms_credits" in data: sub.sms_credits = data["sms_credits"]
    if "ai_usage_limit" in data: sub.ai_usage_limit = data["ai_usage_limit"]
    sub.updated_at = datetime.utcnow()
    
    session.add(sub)
    
    hotel = await session.get(Hotel, hotel_id)
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="UPDATE_QUOTAS",
        description=f"Updated quotas for hotel '{hotel.name if hotel else hotel_id}': WA={sub.whatsapp_credits}, SMS={sub.sms_credits}, AI={sub.ai_usage_limit}",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    await session.commit()
    return {"message": "Quotas updated successfully", "quotas": sub}
