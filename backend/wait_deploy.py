import asyncio
import httpx
import time

async def main():
    BASE = "https://ai-basedbooking-engine-production.up.railway.app/api/v1"
    SLUG = "techrevmeritogmailcom"
    
    print("Waiting for Railway deployment...")
    async with httpx.AsyncClient(timeout=10) as c:
        for _ in range(30):
            try:
                r = await c.post(f"{BASE}/public/chat/guest", json={"hotel_slug":SLUG,"message":"hi","history":[]})
                if r.status_code == 200:
                    resp = r.json().get("response","")
                    print(f"200 OK: {resp}")
                    if "SyntaxError" not in resp:
                        break
                else:
                    print(f"HTTP {r.status_code}: {r.text[:100]}")
            except Exception as e:
                print(f"Error: {e}")
            await asyncio.sleep(5)

asyncio.run(main())
