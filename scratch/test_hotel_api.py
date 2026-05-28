import httpx
import sys
import json

try:
    url = "https://api.staybooker.ai/api/v1/public/hotels/grand-plaza"
    r = httpx.get(url)
    print("STATUS:", r.status_code)
    hotel = r.json()
    print("NAME:", hotel.get("name"))
    print("SETTINGS keys:", hotel.get("settings", {}).keys())
    print("TAX SETTINGS:", {k: v for k, v in hotel.get("settings", {}).items() if "tax" in k})
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
