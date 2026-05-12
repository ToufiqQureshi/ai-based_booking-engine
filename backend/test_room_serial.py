import asyncio
import json
from sqlmodel import select
from app.core.database import async_session
from app.models.room import RoomType
from app.models.room import RoomTypeRead

async def check():
    hotel_id = "3815e471-5d06-4993-99be-00ff4ae88d05"
    async with async_session() as session:
        res = await session.execute(select(RoomType).where(RoomType.hotel_id == hotel_id))
        rooms = res.scalars().all()
        for r in rooms:
            try:
                # Test serialization
                read_obj = RoomTypeRead.model_validate(r)
                print(f"Room {r.name} serializes OK")
            except Exception as e:
                print(f"Room {r.name} SERIALIZATION FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(check())
