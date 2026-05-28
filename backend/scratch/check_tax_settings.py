import asyncio
from app.db.session import async_session
from app.models.hotel import Hotel
from sqlalchemy import select

async def main():
    async with async_session() as session:
        result = await session.execute(select(Hotel))
        hotels = result.scalars().all()
        for h in hotels:
            print(f"Hotel: {h.name} (Slug: {h.slug})")
            print(f"Settings: {h.settings}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
