import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test():
    engine = create_async_engine("postgresql+asyncpg://postgres.iupgzyilraahuwqnkgqq:Staybooker_2026@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?ssl=require")
    try:
        async with engine.connect() as conn:
            print("CONNECTED SUCCESSFULLY!")
    except Exception as e:
        print(f"FAILED: {e}")
    finally:
        await engine.dispose()

asyncio.run(test())
