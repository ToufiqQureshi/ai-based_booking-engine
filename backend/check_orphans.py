import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.links import UserHotelLink
from app.models.user import User

async def check():
    async with async_session() as session:
        res = await session.execute(select(UserHotelLink))
        links = res.scalars().all()
        for l in links:
            res_u = await session.get(User, l.user_id)
            if not res_u:
                print(f"ORPHAN LINK! User ID {l.user_id} does not exist in users table.")
            else:
                print(f"Valid link: User {res_u.email}, Hotel {l.hotel_id}")

if __name__ == "__main__":
    asyncio.run(check())
