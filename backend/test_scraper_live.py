"""
Live scraper test — run this on the actual server where DECODO_AUTH_TOKEN is set.

    cd backend
    DECODO_AUTH_TOKEN=Basic_xxxx python test_scraper_live.py <mmt_url>

Example:
    python test_scraper_live.py "https://www.makemytrip.com/hotels/hotel-details/?hotelId=201503121210209224&_uCurrency=INR&checkin=10062026&checkout=11062026&city=CTDEL&..."
"""
import asyncio
import sys
import os
import re
import httpx
from scrapling import Selector

DECODO_URL = "https://scraper-api.decodo.com/v2/scrape"


def get_auth() -> str:
    token = os.environ.get("DECODO_AUTH_TOKEN", "")
    if not token:
        print("❌  DECODO_AUTH_TOKEN env var is not set.")
        sys.exit(1)
    return token if token.startswith("Basic ") else f"Basic {token}"


async def test_scrape(url: str):
    auth = get_auth()
    print(f"\n🔍  Testing Decodo scrape for URL:\n    {url[:100]}...\n")

    payload = {
        "url": url,
        "proxy_pool": "premium",
        "headless": "html",
        "geo": "India",
        "device_type": "desktop_chrome",
        # Wait for MMT's client-side price XHR to populate before snapshotting.
        "browser_actions": [
            {"type": "wait", "wait_time_s": "12"},
        ],
    }

    print(f"📤  Payload: {payload}\n")

    try:
        async with httpx.AsyncClient(timeout=70.0) as client:
            response = await client.post(
                DECODO_URL,
                json=payload,
                headers={
                    "accept": "application/json",
                    "content-type": "application/json",
                    "authorization": auth,
                },
            )
    except httpx.HTTPError as e:
        print(f"❌  HTTP error: {e}")
        return

    print(f"📥  Decodo HTTP status: {response.status_code}")

    if response.status_code != 200:
        print(f"❌  Non-200 response body:\n{response.text[:500]}")
        return

    res_json = response.json()
    print(f"🗂   Top-level keys: {list(res_json.keys())}")
    print(f"    Top-level status_code: {res_json.get('status_code')}")

    results = res_json.get("results", [])
    print(f"    results count: {len(results)}")

    if not results:
        print("❌  Empty results — check top-level status_code above for 613/error.")
        return

    first = results[0]
    print(f"    results[0] keys: {list(first.keys())}")
    print(f"    results[0].status_code: {first.get('status_code')}")

    html = first.get("content", "")
    print(f"    HTML length: {len(html)} chars")

    if not html:
        print("❌  content is empty string.")
        return

    if "access denied" in html.lower() or "reference id" in html.lower():
        print("⛔  Akamai blocked (Access Denied / Reference ID in HTML).")
        print(f"    First 500 chars:\n{html[:500]}")
        return

    print("\n🧪  Parsing HTML with Scrapling...\n")
    page = Selector(html)

    # Sold out
    sold = page.css("p.font14.appendBottom5.redText.latoBold.lineHight17").first
    if sold and "You Just Missed It" in sold.text:
        print("✅  Status: SOLD OUT")
        return

    # Price element
    price_el = page.css('p.priceText.latoBlack.font22.blackText.appendBottom5[id="hlistpg_hotel_shown_price"]').first
    if not price_el:
        price_el = page.css('#hlistpg_hotel_shown_price').first
    if not price_el:
        price_el = page.css('[data-cy="hotel-price"]').first

    if not price_el:
        print("❌  Price element NOT FOUND — CSS selectors don't match this page.")
        print(f"\n    First 1000 chars of HTML (for selector debugging):")
        print(html[:1000])
        # Try to find any price-like element
        print("\n    Searching for any element with '₹' or 'priceText' or 'price'...")
        for tag in ["p", "span", "div"]:
            matches = page.css(tag)
            for el in matches:
                t = el.text or ""
                if "₹" in t or "priceText" in (el.attrib.get("class") or ""):
                    print(f"    Found: <{tag} class='{el.attrib.get('class','')}' id='{el.attrib.get('id','')}'>  text={t[:60]!r}")
        return

    price_text = price_el.text or ""
    if not re.search(r"\d", price_text):
        for child in price_el.css("*"):
            ct = child.text or ""
            if re.search(r"\d", ct):
                price_text = ct
                break

    m = re.search(r"[\d,]+", price_text)
    if not m:
        print(f"❌  Could not parse digits from: {price_text!r}")
        return

    price = float(re.sub(r"[^\d]", "", m.group()))
    print(f"✅  SUCCESS! Price = ₹{price:,.0f}  (raw text: {price_text!r})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    asyncio.run(test_scrape(sys.argv[1]))
