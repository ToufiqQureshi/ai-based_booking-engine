import asyncio
import os
import sys

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.core.database import engine
from sqlalchemy import text

async def list_hotels():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT id, name, slug FROM hotels"))
        hotels = result.all()
        print(f"Found {len(hotels)} hotels:")
        for h in hotels:
            print(f"- {h.name} ({h.slug}) [ID: {h.id}]")

if __name__ == "__main__":
    asyncio.run(list_hotels())
