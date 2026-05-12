import asyncio
from sqlmodel import select, func
from app.core.database import async_session
from app.models.booking import Booking
from app.models.room import RoomType

async def test_dashboard():
    hotel_id = "3815e471-5d06-4993-99be-00ff4ae88d05"
    async with async_session() as session:
        # arrivals_today
        res = await session.execute(select(func.count(Booking.id)).where(
            Booking.hotel_id == hotel_id
        ))
        print(f"Total Bookings: {res.scalar()}")
        
        # total_rooms
        res = await session.execute(select(func.sum(RoomType.total_inventory)).where(
            RoomType.hotel_id == hotel_id, RoomType.is_active == True
        ))
        print(f"Total Rooms Inventory: {res.scalar()}")

if __name__ == "__main__":
    asyncio.run(test_dashboard())
