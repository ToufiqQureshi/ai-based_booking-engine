import asyncio
from sqlmodel import select
from app.core.database import get_session
from app.models.user import User

async def list_users():
    async for session in get_session():
        result = await session.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"ID: {u.id} | Email: {u.email} | Role: {u.role} | Name: {u.name}")

if __name__ == "__main__":
    asyncio.run(list_users())
