import httpx
import logging

logger = logging.getLogger(__name__)

async def sync_to_google_sheet(webhook_url: str, data: dict):
    """
    Sends lead data to a Google Sheet via a webhook (Apps Script/Make/Zapier).
    """
    if not webhook_url:
        return
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=data, timeout=10.0)
            if response.status_code >= 400:
                logger.error(f"Failed to sync to Google Sheet: {response.text}")
            else:
                logger.info("Successfully synced to Google Sheet")
    except Exception as e:
        logger.error(f"Error syncing to Google Sheet: {str(e)}")
