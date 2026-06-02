import asyncio
from app.core.database import get_session, async_session
from app.models.user import User
from sqlmodel import select
import jwt
import time
import urllib.request
import urllib.error
import json

async def check():
    async with async_session() as session:
        user_res = await session.execute(select(User).where(User.email == "tech.revmerito@gmail.com"))
        user = user_res.scalar_one()
        
        # Generate Supabase JWT
        secret = "N2y834oQ45Hyw6/iWw7Ef2VJRVW2I/zo84Rki/Vw+6jHZ7Z6F5DFM+wkSENFoIAw50S49Wnbr/VONI2fI93wKw=="
        payload = {
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "sub": user.supabase_id,
            "email": user.email,
            "role": "authenticated"
        }
        token = jwt.encode(payload, secret, algorithm="HS256")
        print("Generated token.")
        
        # Fetch stats from prod
        req = urllib.request.Request("https://api.staybooker.ai/api/v1/dashboard/stats")
        req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as response:
                print("Prod Stats Response:", response.read().decode())
        except urllib.error.HTTPError as e:
            print("Prod Stats Error:", e.code, e.read().decode())

        # Fetch recent bookings from prod
        req2 = urllib.request.Request("https://api.staybooker.ai/api/v1/dashboard/recent-bookings")
        req2.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req2) as response:
                print("Prod Recent Response:", response.read().decode())
        except urllib.error.HTTPError as e:
            print("Prod Recent Error:", e.code, e.read().decode())

asyncio.run(check())
