import logging
from typing import Optional
import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        self.settings = get_settings()

    async def send_whatsapp_message(
        self, phone_number: str, message: str, hotel_settings: dict = None
    ) -> bool:
        """
        Sends a free-form WhatsApp message using Meta's Graph API.
        Note: Free-form messages only work if the user has messaged the business within the last 24 hours.
        For automated proactive alerts (like booking confirmations outside the 24h window), 
        you must use `send_whatsapp_template` instead.
        """
        # If the hotel has their own credentials, use them. Otherwise, fallback to platform defaults.
        hotel_settings = hotel_settings or {}
        access_token = hotel_settings.get("whatsapp_access_token") or self.settings.WHATSAPP_TOKEN
        phone_number_id = hotel_settings.get("whatsapp_phone_number_id") or self.settings.WHATSAPP_PHONE_NUMBER_ID

        if not access_token or not phone_number_id:
            logger.warning("WhatsApp API credentials missing. Skipping message to %s", phone_number)
            return False

        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        # Clean the phone number (remove +, spaces, dashes)
        clean_phone = "".join(c for c in phone_number if c.isdigit())

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {"preview_url": False, "body": message},
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                if response.status_code in (200, 201):
                    logger.info("Successfully sent WhatsApp message to %s", clean_phone)
                    return True
                else:
                    logger.error(
                        "Failed to send WhatsApp message to %s. Status: %s, Error: %s",
                        clean_phone, response.status_code, response.text
                    )
                    return False
        except Exception as e:
            logger.exception("Exception while sending WhatsApp message to %s: %s", clean_phone, str(e))
            return False

    async def send_whatsapp_template(
        self, phone_number: str, template_name: str, language_code: str = "en", components: list = None, hotel_settings: dict = None
    ) -> bool:
        """
        Sends a pre-approved WhatsApp template message. This is required for proactive alerts.
        """
        hotel_settings = hotel_settings or {}
        access_token = hotel_settings.get("whatsapp_access_token") or self.settings.WHATSAPP_TOKEN
        phone_number_id = hotel_settings.get("whatsapp_phone_number_id") or self.settings.WHATSAPP_PHONE_NUMBER_ID

        if not access_token or not phone_number_id:
            logger.warning("WhatsApp API credentials missing. Skipping template to %s", phone_number)
            return False

        url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        clean_phone = "".join(c for c in phone_number if c.isdigit())

        payload = {
            "messaging_product": "whatsapp",
            "to": clean_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or []
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                if response.status_code in (200, 201):
                    logger.info("Successfully sent WhatsApp template %s to %s", template_name, clean_phone)
                    return True
                else:
                    logger.error(
                        "Failed to send WhatsApp template to %s. Status: %s, Error: %s",
                        clean_phone, response.status_code, response.text
                    )
                    return False
        except Exception as e:
            logger.exception("Exception while sending WhatsApp template to %s: %s", clean_phone, str(e))
            return False

async def get_whatsapp_service() -> WhatsAppService:
    return WhatsAppService()
