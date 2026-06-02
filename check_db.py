import asyncio
from app.core.database import get_session, async_session
from app.models.booking import Booking
from sqlmodel import select, func

async def check():
    async with async_session() as session:
        result = await session.execute(select(func.count(Booking.id)))
        count = result.scalar()
        print(f"Total bookings in DB: {count}")

        from app.models.hotel import Hotel
        h_result = await session.execute(select(Hotel.id, Hotel.name))
        hotels = h_result.all()
        for h_id, h_name in hotels:
            b_res = await session.execute(select(func.count(Booking.id)).where(Booking.hotel_id == h_id))
            b_count = b_res.scalar()
            print(f"Hotel '{h_name}' (ID: {h_id}): {b_count} bookings")

asyncio.run(check())
