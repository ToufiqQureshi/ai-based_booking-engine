import asyncio
from sqlmodel import select
from app.core.database import async_session
from app.models.user import User

async def make_super_admin(email):
    async with async_session() as session:
        statement = select(User).where(User.email == email)
        results = await session.execute(statement)
        user = results.scalar_one_or_none()
        
        if user:
            user.role = 'SUPER_ADMIN'
            session.add(user)
            await session.commit()
            print(f"Success: User {email} is now a SUPER_ADMIN")
        else:
            print(f"Error: User {email} not found")

if __name__ == "__main__":
    import sys
    email = sys.argv[1] if len(sys.argv) > 1 else "techrevmerito@gmail.com"
    asyncio.run(make_super_admin(email))
