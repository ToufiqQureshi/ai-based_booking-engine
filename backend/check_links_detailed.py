import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.links import UserHotelLink
from app.models.user import User

async def check():
    async with async_session() as session:
        res = await session.execute(select(UserHotelLink))
        links = res.scalars().all()
        print(f"Total Links: {len(links)}")
        for l in links:
            # Get user email
            res_u = await session.execute(select(User).where(User.id == l.user_id))
            user = res_u.scalar_one_or_none()
            email = user.email if user else "UNKNOWN"
            print(f"User: {email} ({l.user_id}), Hotel ID: {l.hotel_id}")

if __name__ == "__main__":
    asyncio.run(check())
