import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost/staybooker_db')
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def main():
    async with SessionLocal() as session:
        res = await session.execute(text("SELECT * FROM users WHERE email='toufiqqureshi@gmail.com'"))
        print(res.fetchall())

asyncio.run(main())
