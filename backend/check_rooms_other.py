import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.room import RoomType

async def check():
    hotel_id = "6920199a-e64c-4cfa-b63b-fdde48e3d9e1"
    async with async_session() as session:
        res = await session.execute(select(RoomType).where(RoomType.hotel_id == hotel_id))
        rooms = res.scalars().all()
        print(f"Hotel {hotel_id} Rooms: {len(rooms)}")

if __name__ == "__main__":
    asyncio.run(check())
