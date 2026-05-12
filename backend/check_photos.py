import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.room import RoomType

async def check():
    hotel_id = "3815e471-5d06-4993-99be-00ff4ae88d05"
    async with async_session() as session:
        res = await session.execute(select(RoomType).where(RoomType.hotel_id == hotel_id))
        rooms = res.scalars().all()
        for r in rooms:
            print(f"Room: {r.name}, Photos: {len(r.photos)}")
            for p in r.photos:
                print(f"  - {p.get('url')[:50]}...")

if __name__ == "__main__":
    asyncio.run(check())
