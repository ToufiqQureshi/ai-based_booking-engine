import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.user import User
from app.models.hotel import Hotel

async def test_me():
    email = "tech.revmerito@gmail.com"
    async with async_session() as session:
        res = await session.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if not user:
            print("User not found")
            return
            
        print(f"User found: {user.email}, Hotel ID: {user.hotel_id}")
        
        if not user.hotel_id:
            print("No hotel_id on user record!")
            return
            
        res = await session.execute(select(Hotel).where(Hotel.id == user.hotel_id))
        hotel = res.scalar_one_or_none()
        if not hotel:
            print(f"HOTEL NOT FOUND in DB for ID {user.hotel_id}")
        else:
            print(f"Hotel found: {hotel.name}, Active: {hotel.is_active}")

if __name__ == "__main__":
    asyncio.run(test_me())
