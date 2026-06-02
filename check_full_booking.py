import asyncio
from app.core.database import get_session, async_session
from app.models.booking import Booking, Guest
from sqlmodel import select, func

async def check():
    h_id = "3815e471-5d06-4993-99be-00ff4ae88d05" # The grand plaza
    try:
        async with async_session() as session:
            result = await session.execute(
                select(Booking, Guest)
                .join(Guest, Booking.guest_id == Guest.id)
                .where(Booking.hotel_id == h_id)
                .order_by(Booking.created_at.desc())
                .limit(5)
            )
            rows = result.all()
            print("Full booking fetch succeeded! Found:", len(rows))
    except Exception as e:
        print("ERROR FETCHING FULL BOOKINGS:", type(e).__name__, str(e))

asyncio.run(check())
