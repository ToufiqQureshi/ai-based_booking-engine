import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check_table():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_hotel_links');"))
        exists = res.scalar()
        print(f"Table user_hotel_links exists: {exists}")
        
        if exists:
            res = await conn.execute(text("SELECT count(*) FROM user_hotel_links;"))
            print(f"Links count: {res.scalar()}")

if __name__ == "__main__":
    asyncio.run(check_table())
