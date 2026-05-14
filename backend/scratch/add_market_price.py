import asyncio
from sqlmodel import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/hotelier_hub"

async def add_columns():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Adding market_price column to room_types...")
        try:
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN market_price DOUBLE PRECISION"))
            print("Successfully added market_price to room_types")
        except Exception as e:
            print(f"Error adding to room_types: {e}")

        print("Adding market_price column to rate_plans (if not exists)...")
        try:
            await conn.execute(text("ALTER TABLE rate_plans ADD COLUMN market_price DOUBLE PRECISION"))
            print("Successfully added market_price to rate_plans")
        except Exception as e:
            print(f"Error adding to rate_plans: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_columns())
