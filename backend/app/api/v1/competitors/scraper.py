"""
Competitor scraper: ScrapingBee API client + Scrapling HTML parser for MakeMyTrip.
No FastAPI router here — pure scraping logic consumed by background.py.
"""
import re
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

import httpx
from scrapling import Selector

from app.core.config import get_settings
from app.core.scrapingbee_usage import record_scrapingbee_request

logger = logging.getLogger(__name__)

# --- ScrapingBee API constants ---
SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/"

# CSS selector ScrapingBee waits for before returning the page snapshot.
# MMT loads prices via an async XHR — we wait until the price node appears in
# the DOM rather than using a fixed delay.
MMT_PRICE_WAIT_FOR = "#hlistpg_hotel_shown_price"

# Additional fixed wait (ms) after the wait_for element appears — lets late-loading
# price values settle inside the already-visible element.
MMT_POST_RENDER_WAIT_MS = 3000

# httpx read timeout for a single ScrapingBee call.
# ScrapingBee's own max is 140s; we add headroom for network.
SCRAPINGBEE_HTTP_TIMEOUT_SECONDS = 150.0

# Past this age a "running" competitor row is treated as an orphaned/crashed
# worker rather than active work-in-progress.
STALE_SCRAPE_MINUTES = 15

# Each manual "Refresh" click burns ~7 paid ScrapingBee requests. This cooldown
# prevents rapid re-clicks from multiplying the third-party bill.
MANUAL_SCRAPE_COOLDOWN_SECONDS = 5 * 60

# Per-process semaphore: caps concurrent ScrapingBee calls so multiple hoteliers
# clicking "Refresh Rates" simultaneously don't burst past the plan's concurrent
# request limit and trigger 429s.  3 is conservative — raise if the plan allows more.
# NOTE: this is per-worker; with multiple Railway replicas multiply accordingly.
_SCRAPINGBEE_SEMAPHORE: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    global _SCRAPINGBEE_SEMAPHORE
    if _SCRAPINGBEE_SEMAPHORE is None:
        _SCRAPINGBEE_SEMAPHORE = asyncio.Semaphore(3)
    return _SCRAPINGBEE_SEMAPHORE


def _get_api_key() -> Optional[str]:
    """
    Read ScrapingBee API key from config (Railway env var: SCRAPINGBEE_API_KEY).
    No hardcoded fallback — missing config must surface as a clear error.
    """
    return get_settings().SCRAPINGBEE_API_KEY or None


def _is_stale_running(comp) -> bool:
    """A 'running' row with no progress for STALE_SCRAPE_MINUTES is orphaned."""
    if comp.last_scrape_status != "running":
        return False
    if not comp.scrape_started_at:
        return True
    return datetime.utcnow() - comp.scrape_started_at > timedelta(minutes=STALE_SCRAPE_MINUTES)


def get_dynamic_dates(offset: int):
    today = datetime.now()
    checkin = (today + timedelta(days=offset)).strftime("%d%m%Y")
    checkout = (today + timedelta(days=offset + 1)).strftime("%d%m%Y")
    return checkin, checkout


def clean_makemytrip_url(url: str, checkin: str, checkout: str) -> str:
    """Replace checkin/checkout date tokens while preserving ALL other query params."""
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
    Fetch one day's rate from MMT via ScrapingBee API + Scrapling parser.

    Uses stealth_proxy (ScrapingBee's highest tier) because MakeMyTrip has
    advanced bot protection (Akamai). stealth_proxy is incompatible with
    session_id — IP rotation is handled internally by ScrapingBee.

    wait_for waits until the price DOM node appears rather than a fixed delay,
    which is more reliable and avoids unnecessary billing time.

    Retry logic lives in _scrape_mmt_with_retry (background.py caller).
    """
    api_key = _get_api_key()
    if not api_key:
        return {"status": "failed", "reason": "scrapingbee_not_configured"}

    try:
        logger.info(f"Fetching via ScrapingBee (stealth): {url[:60]}...")

        params: dict = {
            "api_key": api_key,
            "url": url,
            "render_js": "true",                      # headless browser — MMT prices need JS
            "stealth_proxy": "true",                   # required for MMT's Akamai bot protection
            "country_code": "in",                      # India IP → INR prices on MMT
            "wait_for": MMT_PRICE_WAIT_FOR,            # wait until price element exists in DOM
            "wait": str(MMT_POST_RENDER_WAIT_MS),      # extra settle time after element appears
            "block_resources": "false",                # load all resources so price XHR fires
            "block_ads": "true",
            "device": "desktop",
            "window_width": "1920",
            "window_height": "1080",
        }
        try:
            async with _get_semaphore():
                async with httpx.AsyncClient(timeout=SCRAPINGBEE_HTTP_TIMEOUT_SECONDS) as client:
                    response = await client.get(SCRAPINGBEE_URL, params=params)
        except httpx.HTTPError as e:
            record_scrapingbee_request(hotel_id)
            logger.error(f"ScrapingBee request failed: {e}")
            return {"status": "failed", "reason": f"request_error_{type(e).__name__}"}

        # Always record the attempt (we are billed per attempt)
        record_scrapingbee_request(hotel_id)

        # ScrapingBee returns 200 on success; non-200 = billing/auth/service issue
        if response.status_code == 401:
            logger.error("ScrapingBee: invalid API key or out of credits")
            return {"status": "failed", "reason": "scrapingbee_auth_failed"}

        if response.status_code == 429:
            logger.warning("ScrapingBee: too many concurrent requests")
            return {"status": "failed", "reason": "scrapingbee_rate_limited"}

        if response.status_code != 200:
            body_text = response.text[:300]
            logger.error(f"ScrapingBee returned {response.status_code}: {body_text}")
            # 500 from ScrapingBee often means the target site blocked the request
            if response.status_code == 500:
                return {"status": "failed", "reason": "scrapingbee_target_blocked"}
            return {"status": "failed", "reason": f"scrapingbee_status_{response.status_code}"}

        html_content = response.text
        if not html_content or not html_content.strip():
            logger.warning(f"ScrapingBee returned empty HTML for {url[:60]}")
            return {"status": "failed", "reason": "empty_html_content"}

        # Check for bot-block / access denied in the returned page
        lc = html_content.lower()
        if "access denied" in lc or "access-denied" in lc or "reference id" in lc:
            logger.error("Blocked by Akamai (Access Denied / Reference ID in HTML)")
            return {"status": "blocked", "reason": "shield_blocked"}

        if "captcha" in lc or "are you a robot" in lc:
            logger.warning("CAPTCHA page returned from ScrapingBee")
            return {"status": "failed", "reason": "captcha_page"}

        page = Selector(html_content)

        # Scope parsing to the hotel's own listing card
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
                logger.info(f"Scoped to hotel card for MMT ID: {mmt_hotel_id}")
                container = card
            else:
                logger.warning(f"Hotel card not found for MMT ID: {mmt_hotel_id}")
                return {"status": "failed", "reason": "hotel_card_not_found"}
        else:
            logger.info("No MMT hotel ID in URL; parsing full page")

        sold_out_check = container.css("p.font14.appendBottom5.redText.latoBold.lineHight17").first
        if sold_out_check and "You Just Missed It" in sold_out_check.text:
            return {"status": "success", "price": 0.0, "is_sold_out": True}

        # Primary selector → ID fallback → data-attribute fallback
        price_el = container.css('p.priceText.latoBlack.font22.blackText.appendBottom5[id="hlistpg_hotel_shown_price"]').first
        if not price_el:
            price_el = container.css('#hlistpg_hotel_shown_price').first
        if not price_el:
            price_el = container.css('[data-cy="hotel-price"]').first

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
        logger.info(f"Parsed price: Rs.{price:,.0f} from {price_text!r}")
        return {"status": "success", "price": price, "is_sold_out": False}

    except Exception as e:
        logger.error(f"Scraper error: {e}")
        return {"status": "failed", "reason": str(e)}
