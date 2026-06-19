import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.db.database import engine
from app.brand_console.hotel import Hotel
from app.guests.user import User, UserRole
from app.system.audit import AuditLog, SystemBroadcast
from app.superadmin.subscriptions.subscription import Subscription

@pytest.mark.anyio
async def test_superadmin_update_permissions_audit(super_admin_client: AsyncClient, seeded_hotel: Hotel):
    # 1. Update permissions
    perms = {
        "OWNER": ["/dashboard", "/analytics"],
        "MANAGER": ["/dashboard"],
        "STAFF": ["/availability"]
    }
    res = await super_admin_client.patch(
        f"/api/v1/superadmin/hotels/{seeded_hotel.id}/permissions",
        json=perms
    )
    assert res.status_code == 200

    # 2. Check DB settings updated and AuditLog created
    async with AsyncSession(engine) as db:
        # Check hotel settings
        db_hotel = await db.get(Hotel, seeded_hotel.id)
        assert db_hotel.settings["role_permissions"] == perms

        # Check audit logs
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "UPDATE_ROLE_PERMISSIONS")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert logs[0].hotel_id == seeded_hotel.id
        assert "Updated role permission configuration" in logs[0].description

@pytest.mark.anyio
async def test_superadmin_update_hotel_status_audit(super_admin_client: AsyncClient, seeded_hotel: Hotel):
    # Fetch current DB values to ensure a toggle always occurs
    async with AsyncSession(engine) as db:
        db_hotel = await db.get(Hotel, seeded_hotel.id)
        current_active = db_hotel.is_active
        current_ai = bool(db_hotel.feature_ai_agent)

    new_active = not current_active
    new_ai = not current_ai

    # 1. Update hotel status
    update_data = {
        "is_active": new_active,
        "feature_ai_agent": new_ai
    }
    res = await super_admin_client.patch(
        f"/api/v1/superadmin/hotels/{seeded_hotel.id}",
        json=update_data
    )
    assert res.status_code == 200

    # 2. Check AuditLog is created with details of changes
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "UPDATE_HOTEL")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert logs[0].hotel_id == seeded_hotel.id
        assert "is_active" in logs[0].description
        assert "feature_ai_agent" in logs[0].description

@pytest.mark.anyio
async def test_superadmin_update_subscription_audit(super_admin_client: AsyncClient, seeded_hotel: Hotel):
    # 1. Update subscription
    sub_data = {
        "plan_name": "Premium",
        "status": "active",
        "end_date": "2026-12-31"
    }
    res = await super_admin_client.post(
        f"/api/v1/superadmin/hotels/{seeded_hotel.id}/subscription",
        json=sub_data
    )
    assert res.status_code == 200

    # 2. Check AuditLog
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "UPDATE_SUBSCRIPTION")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert logs[0].hotel_id == seeded_hotel.id
        assert "Premium" in logs[0].description

@pytest.mark.anyio
async def test_superadmin_delete_broadcast_audit(super_admin_client: AsyncClient):
    broadcast_id = str(uuid.uuid4())
    # 1. Seed a broadcast
    async with AsyncSession(engine) as db:
        broadcast = SystemBroadcast(
            id=broadcast_id,
            title="Temp Pytest Broadcast",
            message="Will be deleted",
            type="info",
            is_active=True
        )
        db.add(broadcast)
        await db.commit()

    # 2. Delete it
    res = await super_admin_client.delete(f"/api/v1/superadmin/broadcasts/{broadcast_id}")
    assert res.status_code == 200

    # 3. Check AuditLog
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "DELETE_BROADCAST")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert "Temp Pytest Broadcast" in logs[0].description

@pytest.mark.anyio
async def test_superadmin_revoke_sessions_audit(super_admin_client: AsyncClient, seeded_user: User):
    # 1. Trigger session revocation
    res = await super_admin_client.delete(f"/api/v1/superadmin/sessions/{seeded_user.id}")
    assert res.status_code == 200

    # 2. Check AuditLog contains target email
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "REVOKE_SESSIONS")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert seeded_user.email in logs[0].description

@pytest.mark.anyio
async def test_superadmin_clear_hotel_cache_audit(super_admin_client: AsyncClient, seeded_hotel: Hotel):
    # 1. Clear cache
    res = await super_admin_client.delete(f"/api/v1/superadmin/cache/hotel/{seeded_hotel.id}")
    assert res.status_code == 200

    # 2. Check AuditLog
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "CLEAR_HOTEL_CACHE")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert logs[0].hotel_id == seeded_hotel.id
        assert seeded_hotel.name in logs[0].description

@pytest.mark.anyio
async def test_superadmin_flush_all_cache_audit(super_admin_client: AsyncClient):
    # 1. Flush cache
    res = await super_admin_client.delete("/api/v1/superadmin/cache/all")
    assert res.status_code == 200

    # 2. Check AuditLog
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "FLUSH_ALL_CACHE")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert "Flushed" in logs[0].description

@pytest.mark.anyio
async def test_superadmin_update_user_role_audit(super_admin_client: AsyncClient, seeded_user: User):
    # 1. Update role (role is sent in the request body, matching the frontend)
    res = await super_admin_client.patch(
        f"/api/v1/superadmin/users/{seeded_user.id}/role",
        json={"role": "MANAGER"}
    )
    assert res.status_code == 200

    # 2. Check AuditLog
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action == "UPDATE_USER_ROLE")
            .order_by(AuditLog.created_at.desc())
        )
        logs = log_res.scalars().all()
        assert len(logs) > 0
        assert seeded_user.email in logs[0].description
        assert "MANAGER" in logs[0].description

@pytest.mark.anyio
async def test_superadmin_export_endpoints_audit(super_admin_client: AsyncClient, seeded_hotel: Hotel):
    # Test exporting bookings
    res_b = await super_admin_client.get(f"/api/v1/superadmin/hotels/{seeded_hotel.id}/export/bookings")
    assert res_b.status_code == 200

    # Test exporting guests
    res_g = await super_admin_client.get(f"/api/v1/superadmin/hotels/{seeded_hotel.id}/export/guests")
    assert res_g.status_code == 200

    # Test exporting payments
    res_p = await super_admin_client.get(f"/api/v1/superadmin/hotels/{seeded_hotel.id}/export/payments")
    assert res_p.status_code == 200

    # Test exporting all hotels
    res_ah = await super_admin_client.get("/api/v1/superadmin/export/all-hotels")
    assert res_ah.status_code == 200

    # Verify audit logs in db
    async with AsyncSession(engine) as db:
        log_res = await db.execute(
            select(AuditLog)
            .where(AuditLog.action.in_(["EXPORT_BOOKINGS", "EXPORT_GUESTS", "EXPORT_PAYMENTS", "EXPORT_ALL_HOTELS"]))
        )
        logs = log_res.scalars().all()
        # Should have created 4 export logs
        actions = {l.action for l in logs}
        assert "EXPORT_BOOKINGS" in actions
        assert "EXPORT_GUESTS" in actions
        assert "EXPORT_PAYMENTS" in actions
        assert "EXPORT_ALL_HOTELS" in actions
