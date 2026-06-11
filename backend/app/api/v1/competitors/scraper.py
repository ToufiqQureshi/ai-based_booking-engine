import re
import uuid
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

from scrapingbee import ScrapingBeeClient
from scrapling import Selector

from app.core.config import get_settings
from app.core.decodo_usage import record_decodo_request

logger = logging.getLogger(__name__)

# --- ScrapingBee API constants ---

# Past this age a "running" competitor row is treated as an orphaned/crashed
# worker rather than active work-in-progress — no other process ever revisits it.
STALE_SCRAPE_MINUTES = 15

# Each manual "Refresh" click burns ~7 paid requests. This cooldown
# prevents rapid re-clicks from multiplying the third-party bill.
MANUAL_SCRAPE_COOLDOWN_SECONDS = 5 * 60


def _decodo_auth_header() -> Optional[str]:
    """
    Deprecated Decodo credentials checker.
    """
    return get_settings().DECODO_AUTH_TOKEN


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
    Fetch one day's rate from MMT via ScrapingBee Client + Scrapling.
    """
    api_key = get_settings().SCRAPINGBEE_API_KEY
    if not api_key:
        logger.error("ScrapingBee API key not configured")
        return {"status": "failed", "reason": "scrapingbee_not_configured"}

    try:
        logger.info(f"Fetching Hotel URL via ScrapingBee: {url[:60]}...")

        import requests

        import urllib.parse
        encoded_target_url = urllib.parse.quote(url, safe='')

        # We execute the HTTP request asynchronously by using asyncio.to_thread since
        # requests.get makes a blocking network call.
        def perform_scrapingbee_call():
            # We set block_resources to True to avoid downloading heavy images/media.
            # This speeds up the loading process and prevents 120s timeouts.
            # Passing manually-encoded target URL directly to query params ensures proper formatting.
            # Using stealth_proxy=True resolves heavy Akamai proxy locks that trigger timeouts.
            return requests.get(
                f"https://app.scrapingbee.com/api/v1/?api_key={api_key}&url={encoded_target_url}&render_js=True&stealth_proxy=True&wait_for=.listingRow&block_resources=False",
                timeout=120.0
            )

        response = await asyncio.to_thread(perform_scrapingbee_call)
        record_decodo_request(hotel_id)

        if response.status_code != 200:
            logger.error(f"ScrapingBee returned status code {response.status_code}: {response.text[:300]}")
            return {"status": "failed", "reason": f"API_status_{response.status_code}"}

        html_content = response.text or ""
        if not html_content.strip():
            logger.warning(f"ScrapingBee returned empty HTML content for {url[:60]}")
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
        if sold_out_check and "You Just Missed It" in sold_out_check.text:
            return {"status": "success", "price": 0.0, "is_sold_out": True}

        # Primary selector, ID fallback, then data-attribute fallback
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
        logger.info(f"Parsed price: Rs.{price:,.0f} from text {price_text!r}")
        return {"status": "success", "price": price, "is_sold_out": False}

    except Exception as e:
        logger.error(f"Scraper error: {e}")
        return {"status": "failed", "reason": str(e)}
