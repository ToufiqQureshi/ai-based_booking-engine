import os

content = """import logging
from brevo import AsyncBrevo
from brevo.transactional_emails import (
    SendTransacEmailRequestSender,
    SendTransacEmailRequestToItem,
    SendTransacEmailRequestReplyTo
)
from app.core.config import get_settings
import aiosmtplib
from email.message import EmailMessage

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.settings = get_settings()
        self.default_api_key = self.settings.BREVO_API_KEY
        
        if self.default_api_key:
            self.default_client = AsyncBrevo(api_key=self.default_api_key)
        else:
            self.default_client = None
            logger.warning("Default BREVO_API_KEY is not set.")

    def _get_sender(self, custom_email: str = None, custom_name: str = None) -> SendTransacEmailRequestSender:
        return SendTransacEmailRequestSender(
            email=custom_email or self.settings.BREVO_SENDER_EMAIL,
            name=custom_name or self.settings.BREVO_SENDER_NAME
        )

    async def _send_via_smtp(self, to_emails: list, subject: str, html_content: str, smtp_host: str, smtp_port: int, smtp_username: str, smtp_password: str, smtp_from: str, cc_emails: list = None):
        try:
            msg = EmailMessage()
            msg.set_content("Please enable HTML to view this email.")
            msg.add_alternative(html_content, subtype='html')
            msg['Subject'] = subject
            msg['From'] = smtp_from
            msg['To'] = ", ".join(to_emails)
            if cc_emails:
                msg['Cc'] = ", ".join(cc_emails)
            
            await aiosmtplib.send(
                msg,
                hostname=smtp_host,
                port=smtp_port,
                username=smtp_username,
                password=smtp_password,
                start_tls=True if smtp_port == 587 else False,
                use_tls=True if smtp_port == 465 else False
            )
            logger.info(f"SMTP Email sent successfully to {to_emails}")
            return True
        except Exception as e:
            logger.error(f"SMTP Failed to send email to {to_emails}: {e}")
            return False

    async def _send_email(self, to_emails: list, subject: str, html_content: str, sender: SendTransacEmailRequestSender, cc_emails: list = None, reply_to: str = None, custom_client: AsyncBrevo = None):
        client = custom_client or self.default_client
        if not client:
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
            if reply_to:
                kwargs["reply_to"] = SendTransacEmailRequestReplyTo(email=reply_to, name=sender.name)

            await client.transactional_emails.send_transac_email(**kwargs)
            logger.info(f"Brevo Email sent successfully to {to_emails}")
            return True
        except Exception as e:
            logger.error(f"Brevo Failed to send email to {to_emails}: {e}")
            return False

    def _replace_template(self, template: str, kwargs: dict) -> str:
        for k, v in kwargs.items():
            template = template.replace(f"[{k}]", str(v))
        return template

    async def _dispatch_hotel_email(self, hotel_settings: dict, to_emails: list, subject: str, html_content: str, cc_emails: list = None):
        # 1. Custom SMTP
        smtp_host = hotel_settings.get("smtp_host")
        smtp_password = hotel_settings.get("smtp_password")
        if smtp_host and smtp_password:
            return await self._send_via_smtp(
                to_emails=to_emails,
                subject=subject,
                html_content=html_content,
                smtp_host=smtp_host,
                smtp_port=int(hotel_settings.get("smtp_port", 587)),
                smtp_username=hotel_settings.get("smtp_username"),
                smtp_password=smtp_password,
                smtp_from=hotel_settings.get("smtp_from_email") or hotel_settings.get("smtp_username"),
                cc_emails=cc_emails
            )
        
        # 2. Custom Brevo
        custom_brevo_key = hotel_settings.get("brevo_api_key")
        reply_to_email = hotel_settings.get("email_reply_to")
        sender_name = hotel_settings.get("email_sender_name")
        
        if custom_brevo_key:
            client = AsyncBrevo(api_key=custom_brevo_key)
            sender = self._get_sender(custom_name=sender_name) # Will likely fail if domain not verified, but hotel choice
            # If using custom brevo, they should have verified domain, so we can try using their reply-to as sender email if it exists
            if reply_to_email:
                sender.email = reply_to_email
            return await self._send_email(to_emails, subject, html_content, sender, cc_emails, custom_client=client)

        # 3. Fallback to Platform Brevo with Reply-To
        sender = self._get_sender(custom_name=sender_name) # Uses noreply@staybooker.ai
        return await self._send_email(to_emails, subject, html_content, sender, cc_emails, reply_to=reply_to_email)


    async def send_guest_booking_confirmation(self, guest_email: str, guest_name: str, booking_number: str, check_in: str, check_out: str, total_amount: float, hotel_settings: dict = None):
        hotel_settings = hotel_settings or {}
        subject = f"Booking Confirmation: {booking_number}"
        template = hotel_settings.get("email_template")
        
        if template:
            html_content = self._replace_template(template, {
                "GUEST_NAME": guest_name,
                "BOOKING_REFERENCE": booking_number,
                "CHECK_IN": check_in,
                "CHECK_OUT": check_out,
                "TOTAL_AMOUNT": total_amount
            })
        else:
            sig_html = f"<br><br>{hotel_settings.get('email_signature', '')}" if hotel_settings.get('email_signature') else "<br><br><p>We look forward to hosting you!</p>"
            html_content = f\"\"\"
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
            \"\"\"
            
        await self._dispatch_hotel_email(hotel_settings, [guest_email], subject, html_content)


    async def send_hotel_booking_notification(self, hotel_emails: str, booking_number: str, guest_name: str, check_in: str, check_out: str, total_amount: float, hotel_settings: dict = None):
        hotel_settings = hotel_settings or {}
        if not hotel_emails:
            hotel_emails = self.settings.HOTEL_NOTIFICATION_EMAILS
            if not hotel_emails:
                logger.warning("No hotel emails configured for notification.")
                return

        subject = f"New Booking Received: {booking_number}"
        html_content = f\"\"\"
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
        \"\"\"
        
        emails = [e.strip() for e in hotel_emails.split(",") if e.strip()]
        cc_list = hotel_settings.get("email_cc_list")
        cc_emails = [e.strip() for e in cc_list.split(",")] if cc_list else []
        
        await self._dispatch_hotel_email(hotel_settings, emails, subject, html_content, cc_emails=cc_emails)


# Dependency injection
async def get_email_service() -> EmailService:
    return EmailService()
"""

with open('backend/app/services/email_service.py', 'w', encoding='utf-8') as f:
    f.write(content)
