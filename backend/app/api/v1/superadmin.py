from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from typing import List, Optional
import logging
from app.api.deps import CurrentUser, DbSession
from app.models.user import User, UserRole
from app.models.hotel import Hotel, HotelUpdate
from app.models.subscription import Subscription
from app.models.audit import AuditLog, SystemBroadcast
from app.core.config import get_settings
from datetime import datetime

logger = logging.getLogger(__name__)
# PyJWT replaces python-jose (P4.7) — same .encode API.
import jwt
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
        except Exception as cleanup_err:
            logger.warning(
                "Supabase auth user %s could not be deleted during rollback (invalid role): %s",
                supabase_id, cleanup_err,
            )
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
        except Exception as cleanup_err:
            logger.warning(
                "Supabase auth user %s could not be deleted during rollback: %s",
                supabase_id, cleanup_err,
            )
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
    # jwt already imported at module top (PyJWT in P4.7).
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


# --------------------------------------------------------------------------
# Integrations management — super-admin only
# --------------------------------------------------------------------------
# Hoteliers MUST NOT see or modify AI / WhatsApp / SMTP / Brevo credentials.
# All these are platform-level concerns. This endpoint lets super-admin
# read & write per-hotel integration secrets with audit logging.
from pydantic import BaseModel
from typing import Optional, List


class HotelIntegrationsRead(BaseModel):
    """Full integrations view for super-admin. Secrets are returned
    with a small preview (last 4 chars) so the admin can verify the
    right key is configured, without exposing the full value in the
    admin's own browser if they share their screen."""
    hotel_id: str
    hotel_name: str
    # AI
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key_preview: Optional[str] = None
    has_ai_api_key: bool = False
    # WhatsApp
    has_whatsapp_api_key: bool = False
    whatsapp_api_key_preview: Optional[str] = None
    has_whatsapp_phone_id: bool = False
    has_whatsapp_business_id: bool = False
    # Email
    has_brevo_key: bool = False
    brevo_key_preview: Optional[str] = None
    has_smtp_password: bool = False
    has_smtp_config: bool = False
    smtp_host: Optional[str] = None
    smtp_from_email: Optional[str] = None
    # Quotas
    ai_whatsapp_credits: int = 0
    total_messages_sent: int = 0
    # Pause
    is_paused: bool = False
    pause_reason: Optional[str] = None
    paused_at: Optional[datetime] = None


class HotelIntegrationsUpdate(BaseModel):
    """Super-admin write schema. ALL fields optional — partial updates."""
    # AI
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    # WhatsApp
    whatsapp_api_key: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None
    # Email
    brevo_api_key: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    # Quotas
    ai_whatsapp_credits: Optional[int] = None
    # Pause
    is_paused: Optional[bool] = None
    pause_reason: Optional[str] = None


def _preview_secret(value: Optional[str]) -> Optional[str]:
    """Return a non-reversible 4-char preview like '…a3F2' so admins
    can verify a key is set without exposing it."""
    if not value or not isinstance(value, str):
        return None
    if len(value) <= 4:
        return "•" * len(value)
    return f"…{value[-4:]}"


@router.get("/hotels/{hotel_id}/integrations", response_model=HotelIntegrationsRead)
async def get_hotel_integrations(
    hotel_id: str,
    super_admin: User = Depends(get_super_admin),
    session: DbSession = None,
):
    """Super-admin reads all integration credentials for a hotel.
    Secrets are masked with a 4-char preview."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hotel not found",
        )

    # IntegrationSettings is a separate table (per-hotel AI override)
    from app.models.integration import IntegrationSettings
    int_stmt = select(IntegrationSettings).where(
        IntegrationSettings.hotel_id == hotel_id
    )
    int_res = await session.execute(int_stmt)
    int_settings = int_res.scalar_one_or_none()

    s = hotel.settings if isinstance(hotel.settings, dict) else {}
    return HotelIntegrationsRead(
        hotel_id=hotel.id,
        hotel_name=hotel.name,
        # AI — top-level columns on Hotel OR IntegrationSettings (override)
        ai_provider=int_settings.ai_provider if int_settings else hotel.ai_provider,
        ai_model=int_settings.ai_model if int_settings else hotel.ai_model,
        ai_base_url=int_settings.ai_base_url if int_settings else hotel.ai_base_url,
        ai_api_key_preview=_preview_secret(
            int_settings.ai_api_key if int_settings else hotel.ai_api_key
        ),
        has_ai_api_key=bool(
            (int_settings.ai_api_key if int_settings else hotel.ai_api_key)
        ),
        # WhatsApp
        has_whatsapp_api_key=bool(s.get("whatsapp_api_key")),
        whatsapp_api_key_preview=_preview_secret(s.get("whatsapp_api_key")),
        has_whatsapp_phone_id=bool(s.get("whatsapp_phone_number_id")),
        has_whatsapp_business_id=bool(s.get("whatsapp_business_account_id")),
        # Email
        has_brevo_key=bool(s.get("brevo_api_key")),
        brevo_key_preview=_preview_secret(s.get("brevo_api_key")),
        has_smtp_password=bool(s.get("smtp_password")),
        has_smtp_config=bool(s.get("smtp_host") and s.get("smtp_username")),
        smtp_host=s.get("smtp_host"),
        smtp_from_email=s.get("smtp_from_email"),
        # Quotas
        ai_whatsapp_credits=int(s.get("ai_whatsapp_credits", 0) or 0),
        total_messages_sent=int(s.get("total_messages_sent", 0) or 0),
        # Pause
        is_paused=hotel.is_paused,
        pause_reason=hotel.pause_reason,
        paused_at=hotel.paused_at,
    )


@router.put("/hotels/{hotel_id}/integrations")
async def update_hotel_integrations(
    hotel_id: str,
    payload: HotelIntegrationsUpdate,
    super_admin: User = Depends(get_super_admin),
    session: DbSession = None,
):
    """Super-admin updates a hotel's integration credentials.

    Empty strings are treated as "clear this field" so the admin can
    revoke a key. None means "don't touch this field".
    """
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hotel not found",
        )

    updates_applied: List[str] = []

    # 1. Top-level Hotel columns
    if payload.ai_provider is not None:
        hotel.ai_provider = payload.ai_provider
        updates_applied.append("ai_provider")
    if payload.ai_model is not None:
        hotel.ai_model = payload.ai_model
        updates_applied.append("ai_model")
    if payload.ai_base_url is not None:
        hotel.ai_base_url = payload.ai_base_url or None
        updates_applied.append("ai_base_url")
    if payload.ai_api_key is not None:
        # Empty string = clear
        hotel.ai_api_key = payload.ai_api_key or None
        updates_applied.append("ai_api_key")
    if payload.is_paused is not None:
        from app.core.feature_flags import set_pause
        set_pause(hotel, payload.is_paused, payload.pause_reason)
        updates_applied.append("is_paused")
    elif payload.pause_reason is not None:
        hotel.pause_reason = payload.pause_reason or None
        updates_applied.append("pause_reason")

    # 2. HotelSettings JSON column
    settings = dict(hotel.settings) if isinstance(hotel.settings, dict) else {}
    changed = False
    for json_field in (
        "whatsapp_api_key",
        "whatsapp_phone_number_id",
        "whatsapp_business_account_id",
        "brevo_api_key",
        "smtp_host",
        "smtp_username",
        "smtp_password",
        "smtp_from_email",
        "ai_whatsapp_credits",
    ):
        val = getattr(payload, json_field, None)
        if val is None:
            continue
        settings[json_field] = val or None
        changed = True
        updates_applied.append(json_field)
    if payload.smtp_port is not None:
        settings["smtp_port"] = payload.smtp_port
        changed = True
        updates_applied.append("smtp_port")
    if changed:
        hotel.settings = settings

    from app.core.time import utcnow
    hotel.updated_at = utcnow()
    session.add(hotel)
    await session.commit()
    await session.refresh(hotel)

    # Bust any cached widget config / public hotel data
    try:
        from app.core.redis_client import redis_client
        redis_client.delete_key(f"public:hotel-details:{hotel.id}")
        redis_client.delete_key(f"public:widget-config:{hotel.id}")
        redis_client.delete_key(f"public:slug-to-id:{hotel.slug}")
        redis_client.delete_key(f"public:social-proof:{hotel.slug}")
    except Exception:
        pass

    # Audit log
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_HOTEL_INTEGRATIONS",
        description=f"Updated {len(updates_applied)} integration field(s) for hotel {hotel.name}: {', '.join(updates_applied)}",
        ip_address="127.0.0.1",
    )
    session.add(audit)
    await session.commit()

    return {
        "status": "success",
        "message": f"Updated {len(updates_applied)} field(s) for {hotel.name}",
        "fields_updated": updates_applied,
    }


@router.post("/social-proof/refresh")
async def refresh_social_proof_stats(
    hotel_id: Optional[str] = None,
    super_admin: User = Depends(get_super_admin),
    session: DbSession = None,
):
    """Recompute the social proof cache.

    - With `hotel_id` query param: refreshes just that hotel.
    - Without: refreshes every active hotel. Use after a config change
      that should propagate immediately to the public booking page.
    """
    from app.core.social_proof_refresh import (
        refresh_all_social_proof_stats,
        refresh_one_hotel_now,
    )

    if hotel_id:
        ok = await refresh_one_hotel_now(session, hotel_id)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hotel not found",
            )
        # Audit
        audit = AuditLog(
            user_id=super_admin.id,
            user_email=super_admin.email,
            action="REFRESH_SOCIAL_PROOF",
            description=f"Refreshed social proof cache for hotel {hotel_id}",
            ip_address="127.0.0.1",
        )
        session.add(audit)
        await session.commit()
        return {"status": "success", "hotel_id": hotel_id}

    summary = await refresh_all_social_proof_stats(session)
    audit = AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="REFRESH_SOCIAL_PROOF_ALL",
        description=f"Refreshed social proof cache for {summary['hotels_total']} hotels",
        ip_address="127.0.0.1",
    )
    session.add(audit)
    await session.commit()
    return {"status": "success", **summary}
