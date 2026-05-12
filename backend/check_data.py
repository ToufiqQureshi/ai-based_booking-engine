import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.user import User
from app.models.hotel import Hotel

async def check_data():
    async with async_session() as session:
        # Check User
        res = await session.execute(select(User).where(User.email == "tech.revmerito@gmail.com"))
        user = res.scalar_one_or_none()
        if user:
            print(f"User: {user.email}, Hotel ID: {user.hotel_id}, Role: {user.role}")
            
            # Check Hotel
            if user.hotel_id:
                res = await session.execute(select(Hotel).where(Hotel.id == user.hotel_id))
                hotel = res.scalar_one_or_none()
                if hotel:
                    print(f"Hotel found: {hotel.name}, Slug: {hotel.slug}")
                else:
                    print(f"Hotel with ID {user.hotel_id} NOT FOUND!")
            else:
                print("User has NO hotel_id set!")
        else:
            print("User tech.revmerito@gmail.com not found")

        # List all hotels just in case
        print("\nAll Hotels in DB:")
        res = await session.execute(select(Hotel))
        hotels = res.scalars().all()
        for h in hotels:
            print(f"- {h.name} ({h.id})")

if __name__ == "__main__":
    asyncio.run(check_data())
