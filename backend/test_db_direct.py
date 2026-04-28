import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test():
    # Direct Postgres connection instead of pooler
    engine = create_async_engine("postgresql+asyncpg://postgres:Staybooker_2026@db.iupgzyilraahuwqnkgqq.supabase.co:5432/postgres?ssl=require")
    try:
        async with engine.connect() as conn:
            print("DIRECT CONNECT SUCCESSFUL!")
    except Exception as e:
        print(f"DIRECT CONNECT FAILED: {e}")
    finally:
        await engine.dispose()

asyncio.run(test())
