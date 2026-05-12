import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.room import RoomType
from app.models.hotel import Hotel

async def check():
    async with async_session() as session:
        res = await session.execute(select(RoomType))
        rooms = res.scalars().all()
        print(f"Total Rooms in DB: {len(rooms)}")
        
        # Group by hotel
        hotel_rooms = {}
        for r in rooms:
            hotel_rooms[r.hotel_id] = hotel_rooms.get(r.hotel_id, 0) + 1
            
        for hid, count in hotel_rooms.items():
            res_h = await session.get(Hotel, hid)
            hname = res_h.name if res_h else "UNKNOWN"
            print(f"Hotel: {hname} ({hid}) -> Rooms: {count}")

if __name__ == "__main__":
    asyncio.run(check())
