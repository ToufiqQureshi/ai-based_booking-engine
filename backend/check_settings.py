"""Quick check of integration settings via direct DB query"""
import asyncio
import httpx

async def check():
    SB_URL = "https://iupgzyilraahuwqnkgqq.supabase.co"
    SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cGd6eWlscmFhaHV3cW5rZ3FxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ5NjcxNCwiZXhwIjoyMDkyMDcyNzE0fQ.xqSqSmY7yDase4w50TJpKCCocd-pymdkDtS1NfUAi7M"
    
    async with httpx.AsyncClient(timeout=15) as c:
        # Check integration_settings directly
        r = await c.get(f"{SB_URL}/rest/v1/integration_settings?select=*",
            headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
        if r.status_code == 200:
            data = r.json()
            for s in data:
                print(f"\nHotel ID: {s.get('hotel_id','?')}")
                print(f"  AI Provider: {s.get('ai_provider')}")
                print(f"  AI Model: {s.get('ai_model')}")
                print(f"  AI Base URL: {s.get('ai_base_url')}")
                print(f"  AI API Key: {s.get('ai_api_key','')[:15]}..." if s.get('ai_api_key') else "  AI API Key: None")
                print(f"  Widget Layout: {s.get('widget_layout')}")
                print(f"  Widget Logo: {s.get('widget_logo_url')}")
        else:
            print(f"Error: {r.status_code} - {r.text[:200]}")

asyncio.run(check())
