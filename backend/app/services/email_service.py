"""
Email Service — transactional emails via Brevo or hotel-custom SMTP.
Brevo is imported lazily so the module loads cleanly in test environments
where the brevo SDK isn't installed.
"""
import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.utils.config import get_settings

logger = logging.getLogger(__name__)


def _get_brevo():
    """Lazy import of brevo SDK — avoids hard boot failure if package is absent."""
    try:
        from brevo import AsyncBrevo
        from brevo.transactional_emails import (
            SendTransacEmailRequestSender,
            SendTransacEmailRequestToItem,
            SendTransacEmailRequestReplyTo,
        )
        return AsyncBrevo, SendTransacEmailRequestSender, SendTransacEmailRequestToItem, SendTransacEmailRequestReplyTo
    except ImportError:
        logger.warning("brevo SDK not installed — Brevo email delivery will be skipped")
        return None, None, None, None


class EmailService:
    def __init__(self):
        self.settings = get_settings()
        self.default_api_key = self.settings.BREVO_API_KEY

        AsyncBrevo, *_ = _get_brevo()
        if self.default_api_key and AsyncBrevo:
            self.default_client = AsyncBrevo(api_key=self.default_api_key)
        else:
            self.default_client = None
            if not self.default_api_key:
                logger.warning("BREVO_API_KEY is not set — platform email will be skipped")

    def _get_sender(self, custom_email: str = None, custom_name: str = None):
        _, SendTransacEmailRequestSender, *_ = _get_brevo()
        if not SendTransacEmailRequestSender:
            return None
        return SendTransacEmailRequestSender(
            email=custom_email or self.settings.BREVO_SENDER_EMAIL,
            name=custom_name or self.settings.BREVO_SENDER_NAME,
        )

    async def _send_via_smtp(
        self, to_emails, subject, html_content,
        smtp_host, smtp_port, smtp_username, smtp_password, smtp_from, cc_emails=None
    ):
        try:
            msg = EmailMessage()
            msg.set_content("Please enable HTML to view this email.")
            msg.add_alternative(html_content, subtype="html")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = ", ".join(to_emails)
            if cc_emails:
                msg["Cc"] = ", ".join(cc_emails)
            await aiosmtplib.send(
                msg,
                hostname=smtp_host,
                port=smtp_port,
                username=smtp_username,
                password=smtp_password,
                start_tls=True if smtp_port == 587 else False,
                use_tls=True if smtp_port == 465 else False,
            )
            logger.info("SMTP email sent to %s", to_emails)
            return True
        except Exception as e:
            logger.error("SMTP send failed to %s: %s", to_emails, e)
            return False

    async def _send_email(self, to_emails, subject, html_content, sender, cc_emails=None, reply_to=None, custom_client=None):
        _, _, SendTransacEmailRequestToItem, SendTransacEmailRequestReplyTo = _get_brevo()
        client = custom_client or self.default_client
        if not client or not SendTransacEmailRequestToItem:
            logger.warning("Brevo not available — simulating email to %s: %s", to_emails, subject)
            return False
        try:
            to_items = [SendTransacEmailRequestToItem(email=e.strip()) for e in to_emails if e.strip()]
            cc_items = (
                [SendTransacEmailRequestToItem(email=e.strip()) for e in cc_emails if e.strip()]
                if cc_emails else None
            )
            kwargs = {"subject": subject, "html_content": html_content, "sender": sender, "to": to_items}
            if cc_items:
                kwargs["cc"] = cc_items
            if reply_to and SendTransacEmailRequestReplyTo:
                kwargs["reply_to"] = SendTransacEmailRequestReplyTo(email=reply_to, name=sender.name)
            await client.transactional_emails.send_transac_email(**kwargs)
            logger.info("Brevo email sent to %s", to_emails)
            return True
        except Exception as e:
            logger.error("Brevo send failed to %s: %s", to_emails, e)
            return False

    def _replace_template(self, template: str, kwargs: dict) -> str:
        for k, v in kwargs.items():
            template = template.replace(f"[{k}]", str(v))
            template = template.replace(f"{{{k}}}", str(v))
        return template

    async def _dispatch_hotel_email(self, hotel_settings: dict, to_emails, subject, html_content, cc_emails=None):
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
                cc_emails=cc_emails,
            )
        
        custom_client = None
        custom_brevo_key = hotel_settings.get("brevo_api_key")
        if custom_brevo_key:
            AsyncBrevo, *_ = _get_brevo()
            if AsyncBrevo:
                try:
                    custom_client = AsyncBrevo(api_key=custom_brevo_key)
                except Exception as e:
                    logger.error("Failed to initialize custom Brevo client: %s", e)

        reply_to_email = hotel_settings.get("email_reply_to")
        sender_name = hotel_settings.get("email_sender_name")
        sender = self._get_sender(custom_name=sender_name)
        return await self._send_email(
            to_emails, subject, html_content, sender, cc_emails,
            reply_to=reply_to_email, custom_client=custom_client
        )

    async def send_guest_booking_confirmation(
        self, guest_email, guest_name, booking_number, check_in, check_out, total_amount, hotel_settings=None
    ):
        hotel_settings = hotel_settings or {}
        subject = f"Booking Confirmation: {booking_number}"
        template = hotel_settings.get("email_template_booking_confirmed") or hotel_settings.get("email_template")
        if template:
            html_content = self._replace_template(template, {
                "GUEST_NAME": guest_name, "BOOKING_REFERENCE": booking_number,
                "CHECK_IN": check_in, "CHECK_OUT": check_out, "TOTAL_AMOUNT": total_amount,
            })
        else:
            sig = hotel_settings.get("email_signature", "")
            sig_html = f"<br><br>{sig}" if sig else "<br><br><p>We look forward to welcoming you!</p>"
            html_content = f"""<html><body>
                <h2>Hi {guest_name},</h2>
                <p>Thank you for booking with us!</p>
                <p><strong>Booking Reference:</strong> {booking_number}</p>
                <p><strong>Check-in:</strong> {check_in}</p>
                <p><strong>Check-out:</strong> {check_out}</p>
                <p><strong>Total Amount:</strong> INR {total_amount}</p>
                {sig_html}
            </body></html>"""
        await self._dispatch_hotel_email(hotel_settings, [guest_email], subject, html_content)

    async def send_hotel_booking_notification(
        self, hotel_emails, booking_number, guest_name, check_in, check_out, total_amount, hotel_settings=None
    ):
        hotel_settings = hotel_settings or {}
        if not hotel_emails:
            hotel_emails = self.settings.HOTEL_NOTIFICATION_EMAILS
            if not hotel_emails:
                logger.warning("No hotel emails configured for notification")
                return
        subject = f"New Booking Received: {booking_number}"
        html_content = f"""<html><body>
            <h2>New Booking Alert</h2>
            <p><strong>Booking Reference:</strong> {booking_number}</p>
            <p><strong>Guest Name:</strong> {guest_name}</p>
            <p><strong>Check-in:</strong> {check_in}</p>
            <p><strong>Check-out:</strong> {check_out}</p>
            <p><strong>Total Revenue:</strong> INR {total_amount}</p>
        </body></html>"""
        emails = [e.strip() for e in hotel_emails.split(",") if e.strip()]
        cc_list = hotel_settings.get("email_cc_list")
        cc_emails = [e.strip() for e in cc_list.split(",")] if cc_list else []
        await self._dispatch_hotel_email(hotel_settings, emails, subject, html_content, cc_emails=cc_emails)


    async def send_guest_booking_cancellation(
        self, guest_email, guest_name, booking_number, refund_amount, hotel_settings=None
    ):
        hotel_settings = hotel_settings or {}
        subject = f"Booking Cancellation Confirmed: {booking_number}"
        
        template = hotel_settings.get("email_template_booking_cancelled")
        if template:
            html_content = self._replace_template(template, {
                "GUEST_NAME": guest_name, "BOOKING_REFERENCE": booking_number,
                "REFUND_AMOUNT": refund_amount,
            })
        else:
            # Simplified HTML without templates for now
            html_content = f"""<html><body>
                <h2>Hi {guest_name},</h2>
                <p>Your booking <strong>{booking_number}</strong> has been successfully cancelled.</p>
                <p><strong>Refund Amount:</strong> INR {refund_amount}</p>
                <p>If you have any questions, please contact the hotel directly.</p>
            </body></html>"""
        await self._dispatch_hotel_email(hotel_settings, [guest_email], subject, html_content)

    async def send_hotel_booking_cancellation(
        self, hotel_emails, booking_number, guest_name, refund_amount, hotel_settings=None
    ):
        hotel_settings = hotel_settings or {}
        if not hotel_emails:
            hotel_emails = self.settings.HOTEL_NOTIFICATION_EMAILS
            if not hotel_emails:
                return
        subject = f"Booking Cancelled Alert: {booking_number}"
        html_content = f"""<html><body>
            <h2>Booking Cancellation Alert</h2>
            <p><strong>Booking Reference:</strong> {booking_number}</p>
            <p><strong>Guest Name:</strong> {guest_name}</p>
            <p><strong>Refund Amount:</strong> INR {refund_amount}</p>
        </body></html>"""
        emails = [e.strip() for e in hotel_emails.split(",") if e.strip()]
        await self._dispatch_hotel_email(hotel_settings, emails, subject, html_content)

async def get_email_service() -> EmailService:
    return EmailService()
