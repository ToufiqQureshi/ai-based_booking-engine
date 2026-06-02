import asyncio
from app.core.database import get_session, async_session
from app.models.user import User
from sqlmodel import select, func

async def check():
    async with async_session() as session:
        users_res = await session.execute(select(User.email, User.role, User.hotel_id))
        for u in users_res.all():
            print(f"User: {u.email}, Role: {u.role}, Hotel ID: {u.hotel_id}")

asyncio.run(check())
