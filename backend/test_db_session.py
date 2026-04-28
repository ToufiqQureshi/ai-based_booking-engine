import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test():
    # Session Pooler port
    engine = create_async_engine("postgresql+asyncpg://postgres.iupgzyilraahuwqnkgqq:Staybooker_2026@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?ssl=require")
    try:
        async with engine.connect() as conn:
            print("SESSION POOLER CONNECT SUCCESSFUL!")
    except Exception as e:
        print(f"SESSION POOLER CONNECT FAILED: {e}")
    finally:
        await engine.dispose()

asyncio.run(test())
