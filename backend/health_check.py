"""
StayBooker Health Check v3 - Full test with correct keys
"""
import asyncio
import httpx
import json
from datetime import date, timedelta

BASE = "https://ai-basedbooking-engine-production.up.railway.app/api/v1"
SLUG = "techrevmeritogmailcom"
EMAIL = "tech.revmerito@gmail.com"
PASS_ = "Toufiq@123"
SB_URL = "https://iupgzyilraahuwqnkgqq.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cGd6eWlscmFhaHV3cW5rZ3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTY3MTQsImV4cCI6MjA5MjA3MjcxNH0.THN18KXDYbmjZHMjS20bci1SQJz-xaskV75WM5MfXBw"

R="\033[91m"; G="\033[92m"; Y="\033[93m"; C="\033[96m"; N="\033[0m"; B="\033[1m"
res = []

def lg(n, ok, d=""):
    res.append((n, ok, d))
    print(f"  [{G}PASS{N}] {n}" if ok else f"  [{R}FAIL{N}] {n}" + (f" - {d}" if d else ""))

async def run():
    ci = (date.today()+timedelta(7)).isoformat()
    co = (date.today()+timedelta(8)).isoformat()
    
    print(f"\n{B}{C}{'='*60}\n  STAYBOOKER HEALTH CHECK v3\n{'='*60}{N}\n")
    
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        # PUBLIC
        print(f"{B}{Y}[1] PUBLIC{N}")
        
        try:
            r = await c.get(f"{BASE}/public/hotels/slug/{SLUG}/widget-config")
            d = r.json() if r.status_code==200 else {}
            lg("Widget Config", r.status_code==200, f"hotel={d.get('hotel_name','?')}")
        except Exception as e: lg("Widget Config", False, str(e))
        
        try:
            r = await c.get(f"{BASE}/public/hotels/slug/{SLUG}")
            lg("Hotel Slug", r.status_code==200)
        except Exception as e: lg("Hotel Slug", False, str(e))
        
        try:
            r = await c.get(f"{BASE}/public/hotels/{SLUG}/rooms?check_in={ci}&check_out={co}&adults=2")
            lg("Room Search", r.status_code==200, f"{len(r.json())} rooms" if r.status_code==200 else f"HTTP {r.status_code}")
        except Exception as e: lg("Room Search", False, str(e))
        
        try:
            r = await c.post(f"{BASE}/public/chat/guest", json={"hotel_slug":SLUG,"message":"hi","history":[]})
            if r.status_code==200:
                rp = r.json().get("response","")
                bad = any(w in rp.lower() for w in ["trouble","technical","offline","difficulties"])
                lg("AI Chat", not bad, rp[:100])
            else:
                lg("AI Chat", False, f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e: lg("AI Chat", False, str(e))
        
        # FRONTEND
        print(f"\n{B}{Y}[2] FRONTEND{N}")
        for n, u in [("Login",f"https://staybooker.ai/login"),("Widget",f"https://staybooker.ai/book/{SLUG}/widget"),("Rooms",f"https://staybooker.ai/book/{SLUG}/rooms")]:
            try:
                r = await c.get(u)
                lg(n, r.status_code==200)
            except Exception as e: lg(n, False, str(e))
        
        # AUTH
        print(f"\n{B}{Y}[3] AUTHENTICATED{N}")
        token = None
        try:
            r = await c.post(f"{SB_URL}/auth/v1/token?grant_type=password",
                json={"email":EMAIL,"password":PASS_},
                headers={"apikey":SB_KEY,"Content-Type":"application/json"})
            if r.status_code==200:
                token = r.json().get("access_token")
                lg("Login", True)
            else:
                lg("Login", False, f"HTTP {r.status_code}: {r.text[:100]}")
        except Exception as e: lg("Login", False, str(e))
        
        if token:
            h = {"Authorization":f"Bearer {token}"}
            tests = [
                ("G","Properties","/properties"),
                ("G","Integration Settings","/integration/settings"),
                ("G","Dashboard","/analytics/dashboard"),
                ("G","Rooms API","/rooms"),
                ("G","Bookings","/bookings"),
                ("G","Rate Plans","/rates/plans"),
                ("G","Guests","/guests"),
                ("G","Widget Code","/integration/widget-code"),
                ("G","Availability","/availability"),
                ("G","Rate Shopper","/competitors/rates"),
                ("G","Amenities","/amenities"),
                ("G","Payments","/payments"),
                ("P","Test AI","/integration/test-ai"),
            ]
            for m, n, p in tests:
                try:
                    r = await (c.get if m=="G" else c.post)(f"{BASE}{p}", headers=h)
                    if r.status_code==200:
                        if "test-ai" in p:
                            d=r.json(); lg(n, d.get("status")=="success", d.get("message","")[:80])
                        else:
                            lg(n, True)
                    else:
                        lg(n, False, f"HTTP {r.status_code}: {r.text[:80]}")
                except Exception as e: lg(n, False, str(e))
        
        # SUMMARY
        p=sum(1 for _,o,_ in res if o); f=sum(1 for _,o,_ in res if not o)
        print(f"\n{B}{C}{'='*60}\n  {G}{p} PASSED{N} | {R}{f} FAILED{N} | {p+f} TOTAL")
        if f:
            print(f"\n  {R}FAILURES:{N}")
            for n,o,d in res:
                if not o: print(f"    x {n}: {d}")
        print(f"{B}{C}{'='*60}{N}\n")

asyncio.run(run())
