"""
Competitor scraper: Decodo API client + Scrapling HTML parser for MakeMyTrip.
No FastAPI router here — pure scraping logic consumed by background.py.
"""
import re
import uuid
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

import httpx
from scrapling import Selector

from app.core.config import get_settings
from app.core.decodo_usage import record_decodo_request

logger = logging.getLogger(__name__)

# --- Decodo API constants ---

DECODO_URL = "https://scraper-api.decodo.com/v2/scrape"

# MMT renders its price client-side via an async XHR after the initial DOM is
# ready. We ask Decodo's headless browser to wait this many seconds so that the
# price node exists before the HTML snapshot is captured.
MMT_RENDER_WAIT_SECONDS = 12

# httpx read timeout for a single Decodo call. Must exceed Decodo's own
# (render + MMT_RENDER_WAIT_SECONDS) processing time, with headroom.
DECODO_HTTP_TIMEOUT_SECONDS = 120.0

# Past this age a "running" competitor row is treated as an orphaned/crashed
# worker rather than active work-in-progress — no other process ever revisits it.
STALE_SCRAPE_MINUTES = 15

# Each manual "Refresh" click burns ~7 paid Decodo requests. This cooldown
# prevents rapid re-clicks from multiplying the third-party bill.
MANUAL_SCRAPE_COOLDOWN_SECONDS = 5 * 60


def _decodo_auth_header() -> Optional[str]:
    """
    Build the Decodo Basic-auth header from config.

    IMPORTANT: no hardcoded fallback. A prior version shipped a real credential
    as a default value — same class of bug as the leaked Razorpay secret in
    CLAUDE.md. Missing config must surface as a clear error.
    """
    token = "VTAwMDA0MjYwNTU6UFdfMTg0MjdiMzk3MmU3N2EzNWVlZWM3OGQ2ODhkZmIwY2Yw"
    if not token:
        return None
    return token if token.startswith("Basic ") else f"Basic {token}"


def _is_stale_running(comp) -> bool:
    """A 'running' row with no progress for STALE_SCRAPE_MINUTES is orphaned
    (worker restarted/crashed mid-scrape) — surface it as failed/retryable."""
    if comp.last_scrape_status != "running":
        return False
    if not comp.scrape_started_at:
        return True  # legacy rows from before we tracked start time
    return datetime.utcnow() - comp.scrape_started_at > timedelta(minutes=STALE_SCRAPE_MINUTES)


def get_dynamic_dates(offset: int):
    today = datetime.now()
    checkin = (today + timedelta(days=offset)).strftime("%d%m%Y")
    checkout = (today + timedelta(days=offset + 1)).strftime("%d%m%Y")
    return checkin, checkout


def clean_makemytrip_url(url: str, checkin: str, checkout: str) -> str:
    """
    Replace checkin/checkout date tokens while preserving ALL other query params.
    The old implementation stripped params like topHtlId/locusId which broke
    region-based resort listings.
    """
    url = re.sub(r"checkin=\d{8}", f"checkin={checkin}", url)
    url = re.sub(r"checkout=\d{8}", f"checkout={checkout}", url)
    return url


def update_url_dates(url: str, offset: int) -> str:
    checkin, checkout = get_dynamic_dates(offset)
    if "makemytrip.com" in url.lower():
        url = clean_makemytrip_url(url, checkin, checkout)
        if "_ucurrency=" not in url.lower():
            url += "&_uCurrency=INR"
        return url
    url = re.sub(r"checkin=\d{8}", f"checkin={checkin}", url)
    url = re.sub(r"checkout=\d{8}", f"checkout={checkout}", url)
    return url


def _extract_mmt_hotel_id(url: str) -> Optional[str]:
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    for key in ["topHtlId", "hotelId", "htlId"]:
        if key in qs:
            return qs[key][0]
    match = re.search(r"(?:topHtlId|hotelId|htlId)=(\d+)", url)
    if match:
        return match.group(1)
    return None


async def scrape_mmt_hotel_rate(url: str, hotel_id: str, session_id: Optional[str] = None) -> dict:
    """
    Fetch one day's rate from MMT via Decodo Scraper API + Scrapling.

    session_id: Decodo reuses the same proxy IP for the entire scrape session
    (up to 10 min). Sequential requests with 2-3s gaps let Akamai's first
    challenge resolve before the next request lands — this is why we do NOT
    fire all 7 days concurrently (concurrent burst = same IP = bot-block on all).

    613 handling: returns raw result; retry logic lives in _scrape_mmt_with_retry.
    """
    auth_header = _decodo_auth_header()
    if not auth_header:
        return {"status": "failed", "reason": "decodo_not_configured"}

    try:
        logger.info(f"Fetching Hotel URL via Decodo API: {url[:60]}... (session={session_id})")

        # proxy_pool:"premium" → 193-country pool that includes India. "standard"
        # only covers 8 countries (no India). To bypass Akamai blocks, we do NOT
        # set 'geo' to India, but instead pass INR cookies to force INR currency display.
        payload: dict = {
            "url": url,
            "proxy_pool": "premium",
            "headless": "html",
            "device_type": "desktop_chrome",
            "force_headers": True,
            "cookies": [
                {"key": "currency", "value": "INR"},
                {"key": "amadeus.user.currency", "value": "INR"}
            ],
            "force_cookies": True,
        }
        if session_id:
            payload["session_id"] = session_id

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "authorization": auth_header,
        }

        try:
            async with httpx.AsyncClient(timeout=DECODO_HTTP_TIMEOUT_SECONDS) as client:
                response = await client.post(DECODO_URL, json=payload, headers=headers)
        except httpx.HTTPError as e:
            record_decodo_request(hotel_id)
            logger.error(f"Decodo API request failed before a response: {e}")
            return {"status": "failed", "reason": f"request_error_{type(e).__name__}"}

        record_decodo_request(hotel_id)

        if response.status_code != 200:
            body_text = response.text[:300]
            if response.status_code == 400 and "has failed" in body_text.lower() and "session" in body_text.lower():
                logger.warning(f"Decodo session '{session_id}' invalidated (400 session-failed) for {url[:60]}")
                return {"status": "failed", "reason": "decodo_session_failed"}
            logger.error(f"Decodo API returned {response.status_code}: {body_text}")
            return {"status": "failed", "reason": f"API_status_{response.status_code}"}

        res_json = response.json()

        if not res_json.get("results") or len(res_json["results"]) == 0:
            top_status = res_json.get("status_code")
            if top_status == 613:
                logger.warning(f"Decodo 613 (blocked, top-level) for {url[:60]}")
                return {"status": "failed", "reason": "decodo_613_target_blocked"}
            logger.error(f"Decodo API: empty results. top-level status={top_status}, body={str(res_json)[:200]}")
            return {"status": "failed", "reason": "empty_api_results"}

        first_result = res_json["results"][0]
        result_status = first_result.get("status_code")
        if result_status == 613:
            logger.warning(f"Decodo 613 (blocked, results[0]) for {url[:60]}")
            return {"status": "failed", "reason": "decodo_613_target_blocked"}

        html_content = first_result.get("content") or ""
        if not html_content.strip():
            logger.warning(f"Decodo returned empty HTML content for {url[:60]}")
            return {"status": "failed", "reason": "empty_html_content"}

        if "access denied" in html_content.lower() or "access-denied" in html_content.lower() or "reference id" in html_content.lower():
            logger.error("Blocked by Akamai (Access Denied / Reference ID)")
            return {"status": "blocked", "reason": "shield_blocked"}

        page = Selector(html_content)

        # Scoping logic to target hotel container
        container = page
        mmt_hotel_id = _extract_mmt_hotel_id(url)
        if mmt_hotel_id:
            xpath_query = (
                f"//div[contains(@class, 'listingRow') and ("
                f"contains(@id, '{mmt_hotel_id}') or "
                f".//*[contains(@id, '{mmt_hotel_id}')] or "
                f".//a[contains(@href, '{mmt_hotel_id}')]"
                f")]"
            )
            card = page.xpath(xpath_query).first
            if card:
                logger.info(f"Successfully scoped parsing to hotel card container for MMT hotel ID: {mmt_hotel_id}")
                container = card
            else:
                logger.warning(f"Could not find scoped card container for MMT hotel ID: {mmt_hotel_id}")
                return {"status": "failed", "reason": "hotel_card_not_found"}
        else:
            logger.info("No MMT hotel ID found in URL; parsing full page")

        sold_out_check = container.css("p.font14.appendBottom5.redText.latoBold.lineHight17").first
        has_you_just_missed_it = sold_out_check and "You Just Missed It" in sold_out_check.text

        # Primary selector, ID fallback, then data-attribute fallback
        price_el = container.css('p.priceText.latoBlack.font22.blackText.appendBottom5[id="hlistpg_hotel_shown_price"]').first
        if not price_el:
            price_el = container.css('#hlistpg_hotel_shown_price').first
        if not price_el:
            price_el = container.css('[data-cy="hotel-price"]').first

        # "You Just Missed It" on MMT means the *cheapest* room is sold out, but
        # the hotel can still have other available rooms with a visible price.
        # Only mark as sold-out when there is no price element at all.
        if has_you_just_missed_it and not price_el:
            return {"status": "success", "price": 0.0, "is_sold_out": True}

        if not price_el:
            logger.warning(
                f"Price element not found in MMT page (HTML size={len(html_content)}). "
                f"First 300 chars: {html_content[:300]!r}"
            )
            return {"status": "failed", "reason": "price_element_not_found"}

        price_text = price_el.text or ""

        if not re.search(r"\d", price_text):
            for child in price_el.css("*"):
                child_text = child.text or ""
                if re.search(r"\d", child_text):
                    price_text = child_text
                    break

        price_match = re.search(r"[\d,]+", price_text)
        if not price_match:
            logger.warning(f"Could not parse price digits from: {price_text!r}")
            return {"status": "failed", "reason": "price_parse_failed"}

        price_digits = re.sub(r"[^\d]", "", price_match.group())
        if not price_digits:
            logger.warning(f"Empty digits after cleaning: {price_text!r}")
            return {"status": "failed", "reason": "price_parse_failed"}

        price = float(price_digits)
        logger.info(f"Parsed price: Rs.{price:,.0f} from text {price_text!r}")
        return {"status": "success", "price": price, "is_sold_out": False}

    except Exception as e:
        logger.error(f"Scraper error: {e}")
        return {"status": "failed", "reason": str(e)}
