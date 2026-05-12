import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.room import RoomType
from app.models.booking import Booking

async def check_stats():
    hotel_id = "3815e471-5d06-4993-99be-00ff4ae88d05"
    async with async_session() as session:
        # Check Rooms
        res = await session.execute(select(RoomType).where(RoomType.hotel_id == hotel_id))
        rooms = res.scalars().all()
        print(f"Rooms found: {len(rooms)}")
        for r in rooms:
            print(f"- {r.name} (Active: {r.is_active}, Inventory: {r.total_inventory})")
            
        # Check Bookings
        res = await session.execute(select(Booking).where(Booking.hotel_id == hotel_id))
        bookings = res.scalars().all()
        print(f"Bookings found: {len(bookings)}")

if __name__ == "__main__":
    asyncio.run(check_stats())
