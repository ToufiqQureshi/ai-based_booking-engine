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
import json
import os

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])

PLAN_FEATURES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
    "core", 
    "plan_features.json"
)

def load_plan_features():
    try:
        with open(PLAN_FEATURES_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to load plan features from {PLAN_FEATURES_PATH}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Plan features configuration error: File not found or corrupted"
        )

def save_plan_features(data):
    try:
        with open(PLAN_FEATURES_PATH, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception:
        return False

# Dependency to check if user is Super Admin
async def get_super_admin(current_user: CurrentUser):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can access this resource"
        )
    return current_user

DEFAULT_ROLE_PERMISSIONS = {
    "OWNER": [
        "/dashboard", "/analytics", "/agent", "/rooms", "/rates", "/rate-shopper", 
        "/availability", "/bookings", "/guests", "/payments", "/addons", "/amenities",
        "/channel-settings", "/integration", "/settings"
    ],
    "MANAGER": [
        "/dashboard", "/analytics", "/rooms", "/rates", "/amenities",
        "/availability", "/bookings", "/guests", "/payments", "/settings"
    ],
    "STAFF": [
        "/availability", "/bookings", "/guests"
    ]
}

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
        
        # Get role permissions
        settings_dict = hotel.settings or {}
        role_permissions = settings_dict.get("role_permissions", DEFAULT_ROLE_PERMISSIONS)
        
        final_result.append({
            "id": hotel.id,
            "name": hotel.name,
            "slug": hotel.slug,
            "is_active": hotel.is_active,
            "settings": settings_dict,
            "owner_email": owner.email if owner else "N/A",
            "owner_name": owner.name if owner else "N/A",
            "feature_ai_agent": hotel.feature_ai_agent,
            "feature_guest_bot": hotel.feature_guest_bot,
            "feature_rate_shopper": hotel.feature_rate_shopper,
            "feature_new_booking": getattr(hotel, "feature_new_booking", True),
            "feature_color_palette": getattr(hotel, "feature_color_palette", True),
            "feature_custom_logo": getattr(hotel, "feature_custom_logo", True),
            "feature_custom_widget": getattr(hotel, "feature_custom_widget", True),
            "role_permissions": role_permissions,
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

@router.patch("/hotels/{hotel_id}/permissions")
async def update_role_permissions(
    hotel_id: str,
    permissions: dict,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Update custom role permissions for a hotel"""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    settings_dict = dict(hotel.settings or {})
    settings_dict["role_permissions"] = permissions
    hotel.settings = settings_dict
    
    hotel.updated_at = datetime.utcnow()
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)
    return {"message": "Permissions updated successfully", "role_permissions": permissions}


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

    if "slug" in db_data and db_data["slug"]:
        new_slug = db_data["slug"].lower().strip()
        if new_slug != hotel.slug:
            existing = await session.execute(select(Hotel).where(Hotel.slug == new_slug))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="This URL Slug is already taken by another hotel property")
            db_data["slug"] = new_slug

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
    
    # Sync hotel feature flags based on subscription plan
    plan_name = sub.plan_name
    mapped_plan = "Free" if plan_name.lower() in ["free", "free / trial", "none"] else plan_name
    mapped_plan = mapped_plan.capitalize()
    
    plan_matrix = load_plan_features()
    if mapped_plan in plan_matrix:
        features = plan_matrix[mapped_plan]
        for feat_key, feat_val in features.items():
            setattr(hotel, feat_key, feat_val)
        session.add(hotel)
        
    await session.commit()
    return {"message": "Subscription updated successfully"}

@router.get("/users", response_model=List[dict])
async def list_users(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
    query: Optional[str] = None
):
    """List all users for admin management"""
    from sqlalchemy.orm import selectinload
    stmt = select(User).options(selectinload(User.hotel))
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
            "hotel_name": u.hotel.name if u.hotel else "Platform / Super Admin",
            "is_active": u.is_active,
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

@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    data: dict,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Deactivate or activate a user account"""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "is_active" not in data:
        raise HTTPException(status_code=400, detail="Missing 'is_active' in request body")
        
    user.is_active = bool(data["is_active"])
    user.updated_at = datetime.utcnow()
    session.add(user)
    
    # Audit log
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_USER_STATUS",
        description=f"Updated status for user '{user.email}': active={user.is_active}",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    await session.commit()
    return {"message": "User status updated successfully", "is_active": user.is_active}

from app.core.supabase import get_supabase

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Delete a user and their associated Supabase Auth account"""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete from auth.users (Supabase Auth level) first
    if user.supabase_id:
        try:
            from sqlalchemy import text
            await session.execute(
                text("DELETE FROM auth.users WHERE id = :sub_id"),
                {"sub_id": user.supabase_id}
            )
        except Exception as e:
            import logging
            logging.error(f"Failed to delete user {user.email} from auth.users: {e}")
            # Do not block deletion of public record if auth user deletion fails
            pass
            
    # Audit log
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="DELETE_USER",
        description=f"Deleted user '{user.email}' (Supabase ID: {user.supabase_id})",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    
    await session.delete(user)
    await session.commit()
    return {"message": "User account deleted successfully"}

from pydantic import BaseModel

class SuperAdminUserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str

@router.post("/hotels/{hotel_id}/users")
async def create_hotel_user(
    hotel_id: str,
    data: SuperAdminUserCreate,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Create a new employee user account for a specific hotel"""
    # 1. Verify hotel exists
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
        
    # 2. Check if email already exists locally
    existing_stmt = select(User).where(User.email == data.email.lower().strip())
    res_existing = await session.execute(existing_stmt)
    if res_existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email address already exists")
        
    # 3. Create user in Supabase Auth safely in background thread (avoid blocking event loop)
    import asyncio
    from app.core.supabase import get_supabase
    supabase_client = get_supabase()

    def _create_sb_user():
        return supabase_client.auth.admin.create_user({
            "email": data.email.lower().strip(),
            "password": data.password,
            "email_confirm": True,
            "user_metadata": {
                "name": data.name,
                "hotel_name": hotel.name
            }
        })

    try:
        sb_user = await asyncio.to_thread(_create_sb_user)
        supabase_id = sb_user.user.id
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase Auth registration failed: {str(e)}"
        )
        
    # 4. Create user in local PostgreSQL
    from app.models.user import UserRole
    if data.role not in [r.value for r in UserRole]:
        # Clean up Supabase auth user
        try:
            supabase_client.auth.admin.delete_user(supabase_id)
        except:
            pass
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")
        
    from app.core import security
    new_user = User(
        email=data.email.lower().strip(),
        name=data.name,
        role=UserRole(data.role),
        supabase_id=supabase_id,
        hashed_password=security.get_password_hash(data.password),
        hotel_id=hotel_id,
        is_active=True
    )
    
    session.add(new_user)
    
    # Audit log
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="CREATE_USER",
        description=f"Created employee user '{new_user.email}' for hotel '{hotel.name}' with role '{data.role}'",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    
    try:
        await session.commit()
        await session.refresh(new_user)
    except Exception as e:
        await session.rollback()
        # Clean up Supabase auth user
        try:
            supabase_client.auth.admin.delete_user(supabase_id)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to save user: {str(e)}")
        
    return {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "hotel_id": new_user.hotel_id,
        "is_active": new_user.is_active,
        "created_at": new_user.created_at.isoformat() if new_user.created_at else None
    }


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
    
    from sqlalchemy import text
    import logging
    
    # 1. Fetch all users belonging to this hotel
    users_res = await session.execute(select(User).where(User.hotel_id == hotel_id))
    users_to_delete = users_res.scalars().all()
    
    # 2. Deeply nested relations
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

    # 3. Direct relations (ORDER MATTERS: Delete children first)
    tables = [
        "channel_logs", "channel_room_mappings", "room_rates", "room_blocks", "room_rate_links",
        "bookings", "guests", "rate_plans", "room_types", "competitors", "analytics_sessions",
        "addons", "amenities", "api_keys", "channel_manager_settings", 
        "integration_settings", "leads", "promo_codes", 
        "user_hotel_links", "subscriptions"
    ]
    
    for table in tables:
        try:
            async with session.begin_nested():
                # Note: Using text for table names safely here since list is hardcoded
                await session.execute(text(f"DELETE FROM {table} WHERE hotel_id = :id"), {"id": hotel_id})
        except Exception as e:
            logging.warning(f"Failed to delete from {table}: {e}")
            pass 

    # Clean audit logs containing hotel_id to keep DB completely clean
    try:
        async with session.begin_nested():
            await session.execute(text("DELETE FROM audit_logs WHERE hotel_id = :id"), {"id": hotel_id})
    except Exception as e:
        logging.warning(f"Failed to delete audit logs for hotel: {e}")
        pass
        
    # 4. Delete Auth users securely via Supabase Admin API
    supabase_admin = get_supabase()
    for u in users_to_delete:
        if u.supabase_id:
            try:
                supabase_admin.auth.admin.delete_user(u.supabase_id)
            except Exception as e:
                logging.warning(f"Could not delete auth user {u.supabase_id} via Supabase API: {e}")
                pass
        
        # Explicitly delete user from public.users as well
        try:
            async with session.begin_nested():
                await session.delete(u)
        except Exception as e:
            logging.error(f"Failed to delete user {u.email} from public.users: {e}")
            pass

    try:
        await session.delete(hotel)
        
        # Log this delete action to audit log (without foreign key to hotel since it is deleted)
        audit = AuditLog(
            user_id=super_admin.id,
            user_email=super_admin.email,
            action="DELETE_HOTEL",
            description=f"Permanently deleted hotel '{hotel.name}' (Slug: {hotel.slug}) and all its associated users/data",
            ip_address="127.0.0.1"
        )
        session.add(audit)
        
        await session.commit()
        return {"message": "Hotel and all its associated data/users deleted successfully"}
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
    """Generate impersonation token to login as hotel owner using Supabase Admin API"""
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
    
    # Revert back to securely generating an administrative JWT for the local frontend
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
    from jose import jwt
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

@router.get("/plan-features")
async def get_plan_features(super_admin: User = Depends(get_super_admin)):
    """Get the global plan-to-features mapping configuration"""
    return load_plan_features()

@router.post("/plan-features")
async def update_plan_features(
    data: dict,
    session: DbSession,
    super_admin: User = Depends(get_super_admin)
):
    """Update the global plan-to-features mapping and sync all hotels on these plans"""
    current_mapping = load_plan_features()
    
    # Update mapping with input data
    for plan, features in data.items():
        if plan in current_mapping:
            for feat_key, feat_val in features.items():
                current_mapping[plan][feat_key] = bool(feat_val)
                
    success = save_plan_features(current_mapping)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save plan features configuration")
        
    # Automatically update all hotels that belong to these plans to match the new features matrix
    for plan, features in current_mapping.items():
        # Fetch all subscriptions for this plan
        sub_res = await session.execute(
            select(Subscription).where(Subscription.plan_name == plan)
        )
        subs = sub_res.scalars().all()
        hotel_ids = [s.hotel_id for s in subs]
        
        if hotel_ids:
            for hotel_id in hotel_ids:
                hotel = await session.get(Hotel, hotel_id)
                if hotel:
                    for feat_key, feat_val in features.items():
                        setattr(hotel, feat_key, feat_val)
                    session.add(hotel)
                    
    # Audit log
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_PLAN_FEATURES",
        description="Updated global subscription plan features matrix and synced active properties",
        ip_address="127.0.0.1"
    )
    session.add(audit)
    await session.commit()
    
    return {"message": "Plan features updated and hotels synced successfully", "plan_features": current_mapping}
