import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='room_types';"))
        cols = [r[0] for r in res.all()]
        print(f"RoomType columns: {cols}")
        
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='hotels';"))
        cols = [r[0] for r in res.all()]
        print(f"Hotel columns: {cols}")

if __name__ == "__main__":
    asyncio.run(check())
