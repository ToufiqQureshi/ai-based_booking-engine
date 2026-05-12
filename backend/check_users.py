import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.user import User

async def check():
    async with async_session() as session:
        # Check tech.revmerito
        res = await session.execute(select(User).where(User.email == "tech.revmerito@gmail.com"))
        u1 = res.scalar_one_or_none()
        if u1: 
            print(f"Dot: {u1.email}, Hotel: {u1.hotel_id}")
            from app.models.links import UserHotelLink
            res = await session.execute(select(UserHotelLink).where(UserHotelLink.user_id == u1.id))
            print(f"  Links: {len(res.scalars().all())}")
        
        # Check tech_revmerito
        res = await session.execute(select(User).where(User.email == "tech_revmerito@gmail.com"))
        u2 = res.scalar_one_or_none()
        if u2: 
            print(f"Underscore: {u2.email}, Hotel: {u2.hotel_id}")
            res = await session.execute(select(UserHotelLink).where(UserHotelLink.user_id == u2.id))
            print(f"  Links: {len(res.scalars().all())}")

if __name__ == "__main__":
    asyncio.run(check())
