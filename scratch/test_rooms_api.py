import httpx
import sys
import json

try:
    # Query rooms API directly on localhost or staybooker API
    url = "https://api.staybooker.ai/api/v1/public/hotels/grand-plaza/rooms"
    params = {
        "check_in": "2026-05-28",
        "check_out": "2026-05-29",
        "guests": "2",
        "adults": "2",
        "children": "0"
    }
    r = httpx.get(url, params=params)
    print("STATUS:", r.status_code)
    rooms = r.json()
    print("ROOMS COUNT:", len(rooms))
    for room in rooms:
        print(f"Room: {room['name']}")
        for option in room.get('rate_options', []):
            print(f"  Option: {option['name']}, price_per_night={option.get('price_per_night')}, total_price={option.get('total_price')}")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
