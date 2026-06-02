import asyncio
from app.core.database import async_session
from app.models.hotel import Hotel
from sqlmodel import select

async def check():
    async with async_session() as session:
        result = await session.execute(
            select(Hotel).where(Hotel.id == "3815e471-5d06-4993-99be-00ff4ae88d05")
        )
        hotel = result.scalar_one_or_none()
        if hotel:
            print(f"Found hotel: {hotel.name}, isActive: {hotel.is_active}")
        else:
            print("Hotel NOT found!")

asyncio.run(check())
