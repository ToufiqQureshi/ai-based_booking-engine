import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.links import UserHotelLink
from app.models.user import User

async def check():
    async with async_session() as session:
        res = await session.execute(select(User).where(User.email == "tech.revmerito@gmail.com"))
        u = res.scalar_one_or_none()
        if u:
            print(f"USER: {u.email} ({u.id}), ROLE: {u.role}")
            res = await session.execute(select(UserHotelLink).where(UserHotelLink.user_id == u.id))
            links = res.scalars().all()
            print(f"LINKS: {[l.hotel_id for l in links]}")
            if not links:
                print("NO LINKS FOUND! This is why the dropdown is empty.")
        else:
            print("User not found")

if __name__ == "__main__":
    asyncio.run(check())
