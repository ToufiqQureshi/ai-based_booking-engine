import asyncio
from sqlmodel import select
from app.core.database import get_session
from app.models.user import User, UserRole

async def promote_admin():
    email = "tech.revmerito@gmail.com"
    async for session in get_session():
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.role = UserRole.SUPER_ADMIN
            session.add(user)
            await session.commit()
            print(f"SUCCESS: {email} promoted to SUPER_ADMIN")
        else:
            print(f"ERROR: User with email {email} not found")

if __name__ == "__main__":
    asyncio.run(promote_admin())
