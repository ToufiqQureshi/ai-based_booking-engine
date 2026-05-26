import logging
from brevo import AsyncBrevo
from brevo.transactional_emails import (
    SendTransacEmailRequestSender,
    SendTransacEmailRequestToItem,
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.BREVO_API_KEY
        
        if self.api_key:
            self.client = AsyncBrevo(api_key=self.api_key)
        else:
            self.client = None
            logger.warning("BREVO_API_KEY is not set. Email service is disabled.")

    def _get_sender(self, custom_email: str = None, custom_name: str = None) -> SendTransacEmailRequestSender:
        return SendTransacEmailRequestSender(
            email=custom_email or self.settings.BREVO_SENDER_EMAIL,
            name=custom_name or self.settings.BREVO_SENDER_NAME
        )

    async def _send_email(self, to_emails: list, subject: str, html_content: str, sender: SendTransacEmailRequestSender, cc_emails: list = None):
        if not self.client:
            logger.warning(f"Simulating email to {to_emails}: {subject}")
            return False

        try:
            to_items = [SendTransacEmailRequestToItem(email=e.strip()) for e in to_emails if e.strip()]
            cc_items = None
            if cc_emails:
                cc_items = [SendTransacEmailRequestToItem(email=e.strip()) for e in cc_emails if e.strip()]
                
            kwargs = {
                "subject": subject,
                "html_content": html_content,
                "sender": sender,
                "to": to_items
            }
            if cc_items:
                kwargs["cc"] = cc_items

            await self.client.transactional_emails.send_transac_email(**kwargs)
            logger.info(f"Email sent successfully to {to_emails}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_emails}: {e}")
            return False

    async def send_guest_booking_confirmation(self, guest_email: str, guest_name: str, booking_number: str, check_in: str, check_out: str, total_amount: float, sender_email: str = None, sender_name: str = None, signature: str = None):
        subject = f"Booking Confirmation: {booking_number}"
        
        sig_html = f"<br><br>{signature}" if signature else "<br><br><p>We look forward to hosting you!</p>"
        
        html_content = f"""
        <html>
            <body>
                <h2>Hi {guest_name},</h2>
                <p>Thank you for booking with us!</p>
                <p><strong>Booking Reference:</strong> {booking_number}</p>
                <p><strong>Check-in:</strong> {check_in}</p>
                <p><strong>Check-out:</strong> {check_out}</p>
                <p><strong>Total Amount:</strong> INR {total_amount}</p>
                {sig_html}
            </body>
        </html>
        """
        
        sender = self._get_sender(custom_email=sender_email, custom_name=sender_name)
        await self._send_email(to_emails=[guest_email], subject=subject, html_content=html_content, sender=sender)

    async def send_hotel_booking_notification(self, hotel_emails: str, booking_number: str, guest_name: str, check_in: str, check_out: str, total_amount: float, cc_list: str = None, sender_email: str = None, sender_name: str = None):
        if not hotel_emails:
            hotel_emails = self.settings.HOTEL_NOTIFICATION_EMAILS
            if not hotel_emails:
                logger.warning("No hotel emails configured for notification.")
                return

        subject = f"New Booking Received: {booking_number}"
        html_content = f"""
        <html>
            <body>
                <h2>New Booking Alert</h2>
                <p>A new booking has been confirmed.</p>
                <p><strong>Booking Reference:</strong> {booking_number}</p>
                <p><strong>Guest Name:</strong> {guest_name}</p>
                <p><strong>Check-in:</strong> {check_in}</p>
                <p><strong>Check-out:</strong> {check_out}</p>
                <p><strong>Total Revenue:</strong> INR {total_amount}</p>
            </body>
        </html>
        """
        
        sender = self._get_sender(custom_email=sender_email, custom_name=sender_name)
        emails = [e.strip() for e in hotel_emails.split(",") if e.strip()]
        cc_emails = [e.strip() for e in cc_list.split(",")] if cc_list else []
        
        await self._send_email(to_emails=emails, subject=subject, html_content=html_content, sender=sender, cc_emails=cc_emails)

# Dependency injection
async def get_email_service() -> EmailService:
    return EmailService()
