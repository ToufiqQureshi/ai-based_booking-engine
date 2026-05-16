import asyncio
import logging
import sys
import os
sys.path.insert(0, os.path.abspath("."))
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from main import app
from app.core.config import get_settings
settings = get_settings()
from app.core.security import create_access_token
import uuid
from datetime import timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_superadmin")

from app.models.hotel import Hotel
from app.models.user import User, UserRole
from app.models.room import RoomType, RoomBlock
from app.models.booking import Guest, Booking, BookingStatus, BookingSource
from app.models.analytics import AnalyticsSession, AnalyticsEvent
from datetime import date

async def setup_test_data(session: AsyncSession):
    hotel_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    guest_id = str(uuid.uuid4())
    room_type_id = str(uuid.uuid4())
    booking_id = str(uuid.uuid4())
    analytics_session_id = str(uuid.uuid4())
    
    unique_id = str(uuid.uuid4())[:8]
    hotel = Hotel(id=hotel_id, name=f"Test Hotel API {unique_id}", slug=f"test-hotel-{unique_id}", is_active=True)
    user = User(id=user_id, supabase_id=user_id, email=f"supertest_{unique_id}@example.com", hashed_password="dummy", name="Super Test", role=UserRole.SUPER_ADMIN, hotel_id=hotel_id, is_active=True)
    room_type = RoomType(id=room_type_id, hotel_id=hotel_id, name="Test Room", base_price=100, capacity=2)
    room_block = RoomBlock(id=str(uuid.uuid4()), hotel_id=hotel_id, room_type_id=room_type_id, start_date=date(2025, 1, 1), end_date=date(2025, 1, 2), reason="test", blocked_count=1)
    guest = Guest(id=guest_id, hotel_id=hotel_id, first_name="Test", last_name="Guest", email=f"guest_{unique_id}@test.com")
    booking = Booking(id=booking_id, hotel_id=hotel_id, guest_id=guest_id, booking_number=f"TEST-{unique_id}", check_in=date(2025, 1, 1), check_out=date(2025, 1, 2), total_amount=100, status=BookingStatus.CONFIRMED, source=BookingSource.DIRECT)
    analytics_session = AnalyticsSession(id=analytics_session_id, hotel_id=hotel_id)
    analytics_event = AnalyticsEvent(id=str(uuid.uuid4()), session_id=analytics_session_id, event_type="test")
    
    session.add(hotel)
    session.add(user)
    await session.flush()
    
    session.add(room_type)
    await session.flush()
    
    session.add(room_block)
    session.add(guest)
    await session.flush()
    
    session.add(booking)
    session.add(analytics_session)
    await session.flush()
    
    session.add(analytics_event)
    await session.commit()
    
    return hotel_id, user_id

from app.core.database import async_session, engine
from sqlmodel import SQLModel

async def run_tests():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        
    async with async_session() as session:
        logger.info("Setting up test data in DB...")
        hotel_id, user_id = await setup_test_data(session)
        
    # Generate token
    token = create_access_token(str(user_id), expires_delta=timedelta(minutes=60))
    headers = {"Authorization": f"Bearer {token}"}
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        
        # 1. Test GET /hotels
        logger.info("Testing GET /api/v1/superadmin/hotels...")
        res = await client.get("/api/v1/superadmin/hotels", headers=headers)
        assert res.status_code == 200, f"GET /hotels failed: {res.text}"
        logger.info("✅ GET /hotels passed")
        
        # 2. Test PATCH /hotels/{id}
        logger.info(f"Testing PATCH /api/v1/superadmin/hotels/{hotel_id}...")
        res = await client.patch(f"/api/v1/superadmin/hotels/{hotel_id}", json={"feature_ai_agent": True}, headers=headers)
        assert res.status_code == 200, f"PATCH /hotels failed: {res.text}"
        logger.info("✅ PATCH /hotels passed")
        
        # 3. Test POST subscription
        logger.info(f"Testing POST /api/v1/superadmin/hotels/{hotel_id}/subscription...")
        res = await client.post(f"/api/v1/superadmin/hotels/{hotel_id}/subscription", json={"plan_name": "Pro", "status": "active", "end_date": "2026-12-31T23:59:59"}, headers=headers)
        assert res.status_code == 200, f"POST /subscription failed: {res.text}"
        logger.info("✅ POST /subscription passed")
        
        # 4. Test GET /users
        logger.info("Testing GET /api/v1/superadmin/users...")
        res = await client.get("/api/v1/superadmin/users", headers=headers)
        assert res.status_code == 200, f"GET /users failed: {res.text}"
        logger.info("✅ GET /users passed")
        
        # 5. Test PATCH /users/{id}/role
        logger.info(f"Testing PATCH /api/v1/superadmin/users/{user_id}/role...")
        res = await client.patch(f"/api/v1/superadmin/users/{user_id}/role?role=SUPER_ADMIN", headers=headers)
        assert res.status_code == 200, f"PATCH /users/role failed: {res.text}"
        logger.info("✅ PATCH /users/role passed")
        
        # 6. Test PATCH quotas
        logger.info(f"Testing PATCH /api/v1/superadmin/hotels/{hotel_id}/quotas...")
        res = await client.patch(f"/api/v1/superadmin/hotels/{hotel_id}/quotas", json={"whatsapp_credits": 2500, "sms_credits": 1500, "ai_usage_limit": 100000}, headers=headers)
        assert res.status_code == 200, f"PATCH quotas failed: {res.text}"
        logger.info("✅ PATCH quotas passed")
        
        # 7. Test POST impersonate
        logger.info(f"Testing POST /api/v1/superadmin/impersonate/{hotel_id}...")
        res = await client.post(f"/api/v1/superadmin/impersonate/{hotel_id}", headers=headers)
        assert res.status_code == 200, f"POST impersonate failed: {res.text}"
        assert "access_token" in res.json(), "Access token missing in impersonation response"
        logger.info("✅ POST impersonate passed")
        
        # 8. Test POST & GET broadcasts
        logger.info("Testing Broadcasts API...")
        b_res = await client.post("/api/v1/superadmin/broadcasts", json={"title": "Maintenance", "message": "Server upgrade at 2 AM", "type": "warning"}, headers=headers)
        assert b_res.status_code == 200, f"POST broadcast failed: {b_res.text}"
        b_id = b_res.json()["id"]
        
        b_list = await client.get("/api/v1/superadmin/broadcasts", headers=headers)
        assert b_list.status_code == 200
        assert any(b["id"] == b_id for b in b_list.json()), "Broadcast not in list"
        logger.info("✅ Broadcasts passed")
        
        # 9. Test GET audit logs
        logger.info("Testing GET /api/v1/superadmin/audit-logs...")
        a_res = await client.get("/api/v1/superadmin/audit-logs", headers=headers)
        assert a_res.status_code == 200
        assert len(a_res.json()) > 0, "Audit logs should not be empty"
        logger.info("✅ Audit logs passed")
        
        # 10. Test DELETE /hotels/{id}
        logger.info(f"Testing DELETE /api/v1/superadmin/hotels/{hotel_id}...")
        res = await client.delete(f"/api/v1/superadmin/hotels/{hotel_id}", headers=headers)
        assert res.status_code == 200, f"DELETE /hotels failed: {res.text}"
        logger.info("✅ DELETE /hotels passed")
        
    async with async_session() as verify_session:
        # Verify user is suspended, not deleted
        res = await verify_session.execute(text("SELECT is_active, hotel_id FROM users WHERE id = :id"), {"id": user_id})
        user_record = res.fetchone()
        assert user_record is not None, "User should not be deleted"
        assert user_record[0] is False or user_record[0] == 0 or (hasattr(user_record, 'is_active') and user_record.is_active is False), "User should be inactive"
        assert user_record[1] is None or (hasattr(user_record, 'hotel_id') and user_record.hotel_id is None), "User should have NULL hotel_id"
        logger.info("✅ Verified user was suspended instead of deleted.")
        
        # Verify hotel is deleted
        res = await verify_session.execute(text("SELECT id FROM hotels WHERE id = :id"), {"id": hotel_id})
        assert res.fetchone() is None, "Hotel should be deleted"
        logger.info("✅ Verified hotel was deleted.")
        
        # Cleanup
        await verify_session.execute(text("DELETE FROM audit_logs WHERE user_id = :id"), {"id": user_id})
        await verify_session.execute(text("DELETE FROM system_broadcasts WHERE id = :id"), {"id": b_id})
        await verify_session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        await verify_session.commit()
        logger.info("Test cleanup complete. ALL TESTS PASSED! 🎉")

if __name__ == '__main__':
    asyncio.run(run_tests())
