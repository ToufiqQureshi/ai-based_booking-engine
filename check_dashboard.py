import asyncio
from datetime import date
from app.core.database import get_session, async_session
from app.models.booking import Booking
from sqlmodel import select, func

async def check():
    today = date.today()
    h_id = "3815e471-5d06-4993-99be-00ff4ae88d05" # The grand plaza
    async with async_session() as session:
        count = await session.execute(select(func.count(Booking.id)).where(Booking.hotel_id == h_id))
        print(f"Total bookings for grand plaza: {count.scalar()}")

        # Check today's check-ins
        arrivals = await session.execute(
            select(func.count(Booking.id)).where(
                Booking.hotel_id == h_id,
                Booking.check_in == today
            )
        )
        print(f"Arrivals today: {arrivals.scalar()}")

        # recent bookings
        recent = await session.execute(
            select(Booking.id, Booking.guest_id, Booking.created_at)
            .where(Booking.hotel_id == h_id)
            .order_by(Booking.created_at.desc())
            .limit(5)
        )
        print("Recent 5 bookings:")
        for r in recent.all():
            print(r)

asyncio.run(check())
