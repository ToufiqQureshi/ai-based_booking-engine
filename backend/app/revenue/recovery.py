"""
Abandoned-booking recovery.

A guest who picks dates and a room but never pays leaves a PENDING booking with
`paid_amount == 0`. Industry data shows a timely WhatsApp + email nudge recovers
10-30% of these. This module:

  * finds abandoned bookings (PENDING, unpaid, aged into the recovery window,
    not yet nudged),
  * sends a WhatsApp message and/or email with a link back to finish booking,
  * stamps `recovery_sent_at` so the guest is never spammed twice.

Recovery is opt-in per hotel via `hotel.settings["recovery_enabled"]` — the
hotelier stays in control. `run_abandoned_recovery()` is safe to call from a
cron/scheduled endpoint; the hotelier-facing endpoints let them preview
abandoned bookings and trigger a sweep for their own hotel on demand.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import select

from app.core.auth.deps import DbSession, CurrentUser, require_hotel_role
from app.bookings.booking import Booking, BookingStatus, Guest
from app.brand_console.hotel import Hotel

logger = logging.getLogger(__name__)
router = APIRouter()

# Defaults — wait this long after creation before nudging (give the guest a
# chance to finish on their own), and don't chase bookings older than this.
DEFAULT_ABANDON_AFTER_MINUTES = 30
DEFAULT_MAX_AGE_HOURS = 72


def _booking_link(hotel: Hotel) -> str:
    """Public booking URL the guest can click to resume."""
    base = "https://staybooker.ai/book"
    settings = hotel.settings if isinstance(hotel.settings, dict) else {}
    base = settings.get("public_booking_base_url") or base
    return f"{base}/{hotel.slug}/rooms"


async def _send_recovery_email(guest: Guest, hotel: Hotel, booking: Booking) -> bool:
    """Send the recovery email. Returns True on success. Never raises."""
    if not guest.email:
        return False
    try:
        from app.services.email_service import get_email_service
        email_service = await get_email_service()
        link = _booking_link(hotel)
        await email_service.send_email(
            to_email=guest.email,
            to_name=f"{guest.first_name} {guest.last_name}".strip(),
            subject=f"Your room at {hotel.name} is still available",
            html_content=f"""
                <p>Hi {guest.first_name or 'there'},</p>
                <p>You were just a step away from booking your stay at
                <strong>{hotel.name}</strong> for
                <strong>{booking.check_in}</strong> to <strong>{booking.check_out}</strong>.</p>
                <p>Your room is still available — finish your booking here:</p>
                <p><a href="{link}">Complete my booking</a></p>
                <p>See you soon,<br/>{hotel.name}</p>
            """,
        )
        return True
    except Exception:
        logger.exception("Recovery email failed for booking %s", booking.id)
        return False


async def _send_recovery_whatsapp(guest: Guest, hotel: Hotel, booking: Booking) -> bool:
    """Send the recovery WhatsApp message. Returns True on success. Never raises."""
    settings = hotel.settings if isinstance(hotel.settings, dict) else {}
    token = settings.get("whatsapp_api_key")
    phone_number_id = settings.get("whatsapp_phone_number_id")
    if not (token and phone_number_id and guest.phone):
        return False
    try:
        link = _booking_link(hotel)
        message = (
            f"Hi {guest.first_name or 'there'}! 👋\n\n"
            f"Your room at {hotel.name} for {booking.check_in} → {booking.check_out} "
            f"is still available. Finish your booking here:\n{link}"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://graph.facebook.com/v19.0/{phone_number_id}/messages",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": guest.phone,
                    "type": "text",
                    "text": {"body": message},
                },
            )
        return True
    except Exception:
        logger.exception("Recovery WhatsApp failed for booking %s", booking.id)
        return False


async def _find_abandoned(
    session,
    *,
    hotel_id: Optional[str] = None,
    abandon_after_minutes: int = DEFAULT_ABANDON_AFTER_MINUTES,
    max_age_hours: int = DEFAULT_MAX_AGE_HOURS,
    include_already_sent: bool = False,
) -> List[Booking]:
    """Abandoned = PENDING + unpaid + aged into the recovery window."""
    now = datetime.utcnow()
    newest = now - timedelta(minutes=abandon_after_minutes)
    oldest = now - timedelta(hours=max_age_hours)

    conditions = [
        Booking.status == BookingStatus.PENDING,
        Booking.paid_amount == 0,
        Booking.created_at <= newest,
        Booking.created_at >= oldest,
    ]
    if hotel_id:
        conditions.append(Booking.hotel_id == hotel_id)
    if not include_already_sent:
        conditions.append(Booking.recovery_sent_at == None)  # noqa: E711

    rows = (await session.execute(select(Booking).where(*conditions))).scalars().all()
    return rows


async def run_abandoned_recovery(
    hotel_id: Optional[str] = None,
    *,
    force: bool = False,
) -> dict:
    """
    Sweep abandoned bookings and send recovery nudges.

    Honors per-hotel `settings["recovery_enabled"]` unless `force=True` (used by
    the hotelier's manual "send now" trigger for their own hotel).
    Callable from a scheduled/cron endpoint. Safe — failures are isolated.
    """
    from app.core.db.database import async_session

    nudged = 0
    skipped_disabled = 0
    errors = 0

    async with async_session() as session:
        abandoned = await _find_abandoned(session, hotel_id=hotel_id)
        # Cache hotel lookups so we don't refetch per booking.
        hotel_cache: dict = {}
        
        # Batch fetch guests to eliminate N+1 queries
        guest_ids = [b.guest_id for b in abandoned if b.guest_id]
        if guest_ids:
            guests_res = await session.execute(select(Guest).where(Guest.id.in_(guest_ids)))
            guest_cache = {g.id: g for g in guests_res.scalars().all()}
        else:
            guest_cache = {}

        for booking in abandoned:
            try:
                hotel = hotel_cache.get(booking.hotel_id)
                if hotel is None:
                    hotel = await session.get(Hotel, booking.hotel_id)
                    hotel_cache[booking.hotel_id] = hotel
                if not hotel:
                    continue

                settings = hotel.settings if isinstance(hotel.settings, dict) else {}
                if not force and not settings.get("recovery_enabled", False):
                    skipped_disabled += 1
                    continue

                guest = guest_cache.get(booking.guest_id)
                if not guest:
                    continue

                sent_email = await _send_recovery_email(guest, hotel, booking)
                sent_wa = await _send_recovery_whatsapp(guest, hotel, booking)

                if sent_email or sent_wa:
                    booking.recovery_sent_at = datetime.utcnow()
                    session.add(booking)
                    nudged += 1
            except Exception:
                logger.exception("Recovery sweep failed for booking %s", booking.id)
                errors += 1

        await session.commit()

    return {
        "nudged": nudged,
        "skipped_disabled": skipped_disabled,
        "errors": errors,
        "scanned": len(abandoned),
    }


# ── Hotelier-facing endpoints ─────────────────────────────────────────────────

@router.get("/abandoned", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER", "STAFF"))])
async def list_abandoned_bookings(
    current_user: CurrentUser,
    session: DbSession,
    max_age_hours: int = Query(DEFAULT_MAX_AGE_HOURS, ge=1, le=168),
):
    """Preview abandoned bookings for the caller's hotel (incl. already-nudged)."""
    rows = await _find_abandoned(
        session,
        hotel_id=current_user.hotel_id,
        abandon_after_minutes=0,
        max_age_hours=max_age_hours,
        include_already_sent=True,
    )
    return [
        {
            "id": b.id,
            "booking_number": b.booking_number,
            "check_in": b.check_in,
            "check_out": b.check_out,
            "total_amount": b.total_amount,
            "created_at": b.created_at,
            "recovery_sent_at": b.recovery_sent_at,
        }
        for b in rows
    ]


@router.post("/run", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def run_recovery_now(current_user: CurrentUser):
    """Hotelier manually triggers a recovery sweep for their own hotel."""
    return await run_abandoned_recovery(hotel_id=current_user.hotel_id, force=True)


class RecoverySettings(BaseModel):
    recovery_enabled: bool


@router.get("/settings", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER", "STAFF"))])
async def get_recovery_settings(current_user: CurrentUser, session: DbSession):
    """Read the per-hotel recovery opt-in flag."""
    hotel = await session.get(Hotel, current_user.hotel_id)
    settings = hotel.settings if (hotel and isinstance(hotel.settings, dict)) else {}
    return {"recovery_enabled": bool(settings.get("recovery_enabled", False))}


@router.put("/settings", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_recovery_settings(
    data: RecoverySettings,
    current_user: CurrentUser,
    session: DbSession,
):
    """Toggle abandoned-booking recovery on/off for the caller's hotel."""
    hotel = await session.get(Hotel, current_user.hotel_id)
    if not hotel:
        return {"recovery_enabled": False}
    # JSON columns need a fresh dict assignment for SQLAlchemy to detect the change.
    settings = dict(hotel.settings) if isinstance(hotel.settings, dict) else {}
    settings["recovery_enabled"] = data.recovery_enabled
    hotel.settings = settings
    session.add(hotel)
    await session.commit()
    return {"recovery_enabled": data.recovery_enabled}
