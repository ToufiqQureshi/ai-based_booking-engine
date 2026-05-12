import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.user import User

async def list_users():
    async with async_session() as session:
        statement = select(User)
        results = await session.execute(statement)
        users = results.scalars().all()
        for u in users:
            print(f"Email: {u.email}, Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(list_users())
