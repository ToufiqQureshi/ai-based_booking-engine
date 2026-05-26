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
            self.sender = SendTransacEmailRequestSender(
                email=self.settings.BREVO_SENDER_EMAIL,
                name=self.settings.BREVO_SENDER_NAME
            )
        else:
            self.client = None
            self.sender = None
            logger.warning("BREVO_API_KEY is not set. Email service is disabled.")

    async def _send_email(self, to_email: str, to_name: str, subject: str, html_content: str):
        if not self.client:
            logger.warning(f"Simulating email to {to_email}: {subject}")
            return False

        try:
            to = [SendTransacEmailRequestToItem(email=to_email, name=to_name)]
            await self.client.transactional_emails.send_transac_email(
                subject=subject,
                html_content=html_content,
                sender=self.sender,
                to=to
            )
            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    async def send_guest_booking_confirmation(self, guest_email: str, guest_name: str, booking_number: str, check_in: str, check_out: str, total_amount: float):
        subject = f"Booking Confirmation: {booking_number}"
        html_content = f"""
        <html>
            <body>
                <h2>Hi {guest_name},</h2>
                <p>Thank you for booking with us!</p>
                <p><strong>Booking Reference:</strong> {booking_number}</p>
                <p><strong>Check-in:</strong> {check_in}</p>
                <p><strong>Check-out:</strong> {check_out}</p>
                <p><strong>Total Amount:</strong> INR {total_amount}</p>
                <p>We look forward to hosting you!</p>
            </body>
        </html>
        """
        await self._send_email(to_email=guest_email, to_name=guest_name, subject=subject, html_content=html_content)

    async def send_hotel_booking_notification(self, hotel_emails: str, booking_number: str, guest_name: str, check_in: str, check_out: str, total_amount: float):
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
        
        # Send to all emails in comma-separated list
        emails = [e.strip() for e in hotel_emails.split(",") if e.strip()]
        for email in emails:
            await self._send_email(to_email=email, to_name="Hotel Management", subject=subject, html_content=html_content)

# Dependency injection
async def get_email_service() -> EmailService:
    return EmailService()
