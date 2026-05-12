import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.hotel import Hotel

async def check():
    async with async_session() as session:
        res = await session.execute(select(Hotel).where(Hotel.id == "3815e471-5d06-4993-99be-00ff4ae88d05"))
        h = res.scalar_one_or_none()
        if h:
            print(f"Hotel: {h.name}, Active: {h.is_active}")
        else:
            print("Hotel not found")

if __name__ == "__main__":
    asyncio.run(check())
