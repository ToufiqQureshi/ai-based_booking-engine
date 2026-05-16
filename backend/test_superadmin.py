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

from app.core.database import async_session

async def run_tests():
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
            
            # 6. Test DELETE /hotels/{id}
            logger.info(f"Testing DELETE /api/v1/superadmin/hotels/{hotel_id}...")
            res = await client.delete(f"/api/v1/superadmin/hotels/{hotel_id}", headers=headers)
            assert res.status_code == 200, f"DELETE /hotels failed: {res.text}"
            logger.info("✅ DELETE /hotels passed")
            
        # Verify user is suspended, not deleted
        res = await session.execute(text("SELECT is_active, hotel_id FROM users WHERE id = :id"), {"id": user_id})
        user_record = res.fetchone()
        assert user_record is not None, "User should not be deleted"
        assert user_record.is_active is False, "User should be inactive"
        assert user_record.hotel_id is None, "User should have NULL hotel_id"
        logger.info("✅ Verified user was suspended instead of deleted.")
        
        # Verify hotel is deleted
        res = await session.execute(text("SELECT id FROM hotels WHERE id = :id"), {"id": hotel_id})
        assert res.fetchone() is None, "Hotel should be deleted"
        logger.info("✅ Verified hotel was deleted.")
        
        # Cleanup
        await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        await session.commit()
        logger.info("Test cleanup complete. ALL TESTS PASSED! 🎉")

if __name__ == '__main__':
    asyncio.run(run_tests())
