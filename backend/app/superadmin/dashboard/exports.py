"""
Super Admin — Hotel data export (CSV).
"""
import csv
import io
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlmodel import select

from app.core.auth.deps import DbSession
from app.bookings.booking import Booking, Guest
from app.brand_console.hotel import Hotel
from app.payments.payment import Payment
from app.guests.user import User
from app.system.audit import AuditLog
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


def _csv_response(rows: list[list], headers: list[str], filename: str) -> StreamingResponse:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/hotels/{hotel_id}/export/bookings")
async def export_bookings(
    hotel_id: str,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.exports.read")),
):
    """Export all bookings for a hotel as CSV."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    bk_res = await session.execute(
        select(Booking).where(Booking.hotel_id == hotel_id).order_by(Booking.created_at.desc())
    )
    bookings = bk_res.scalars().all()

    guest_ids = list({b.guest_id for b in bookings if b.guest_id})
    guest_map = {}
    if guest_ids:
        g_res = await session.execute(select(Guest).where(Guest.id.in_(guest_ids)))
        guest_map = {g.id: g for g in g_res.scalars().all()}

    headers = [
        "Booking #", "Status", "Check-in", "Check-out",
        "Guest Name", "Guest Email", "Guest Phone",
        "Rooms", "Total Amount", "Created At",
    ]
    rows = []
    for b in bookings:
        g = guest_map.get(b.guest_id)
        rooms_str = ", ".join(r.get("room_type_name", "") for r in (b.rooms or []))
        rows.append([
            b.booking_number, b.status,
            b.check_in.isoformat() if b.check_in else "",
            b.check_out.isoformat() if b.check_out else "",
            f"{g.first_name} {g.last_name}" if g else "",
            g.email if g else "",
            g.phone if g else "",
            rooms_str,
            b.total_amount,
            b.created_at.isoformat() if b.created_at else "",
        ])

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="EXPORT_BOOKINGS",
        description=f"Exported booking data for hotel '{hotel.name}' to CSV",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()

    filename = f"{hotel.slug}-bookings-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return _csv_response(rows, headers, filename)


@router.get("/hotels/{hotel_id}/export/guests")
async def export_guests(
    hotel_id: str,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.exports.read")),
):
    """Export guest list for a hotel as CSV."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    g_res = await session.execute(select(Guest).where(Guest.hotel_id == hotel_id))
    guests = g_res.scalars().all()

    headers = ["Name", "Email", "Phone", "Nationality", "Created At"]
    rows = [
        [f"{g.first_name} {g.last_name}", g.email, g.phone or "",
         g.nationality or "", g.created_at.isoformat() if g.created_at else ""]
        for g in guests
    ]

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="EXPORT_GUESTS",
        description=f"Exported guest list data for hotel '{hotel.name}' to CSV",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()

    filename = f"{hotel.slug}-guests-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return _csv_response(rows, headers, filename)


@router.get("/hotels/{hotel_id}/export/payments")
async def export_payments(
    hotel_id: str,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.exports.read")),
):
    """Export payment records for a hotel as CSV."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    p_res = await session.execute(
        select(Payment).where(Payment.hotel_id == hotel_id).order_by(Payment.created_at.desc())
    )
    payments = p_res.scalars().all()

    headers = ["Booking ID", "Amount", "Currency", "Method", "Status", "Date"]
    rows = [
        [p.booking_id, p.amount, getattr(p, "currency", "INR"),
         getattr(p, "payment_method", ""), p.status,
         p.created_at.isoformat() if p.created_at else ""]
        for p in payments
    ]

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        hotel_id=hotel_id,
        action="EXPORT_PAYMENTS",
        description=f"Exported payment records data for hotel '{hotel.name}' to CSV",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()

    filename = f"{hotel.slug}-payments-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return _csv_response(rows, headers, filename)


@router.get("/export/all-hotels")
async def export_all_hotels(
    request: Request,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.exports.read")),
):
    """Export platform-wide hotel summary as CSV."""
    from app.superadmin.subscriptions.subscription import Subscription
    from sqlmodel import func

    hotels_res = await session.execute(select(Hotel))
    hotels = hotels_res.scalars().all()
    hotel_ids = [h.id for h in hotels]

    subs_res = await session.execute(select(Subscription).where(Subscription.hotel_id.in_(hotel_ids)))
    subs_map = {s.hotel_id: s for s in subs_res.scalars().all()}

    owners_res = await session.execute(
        select(User).where(User.hotel_id.in_(hotel_ids), User.role == "OWNER")
    )
    owners_map = {u.hotel_id: u for u in owners_res.scalars().all()}

    headers = [
        "Hotel Name", "Slug", "Owner Email", "Is Active", "Is Paused",
        "Plan", "Subscription Status", "End Date",
        "AI Agent", "Created At"
    ]
    rows = [
        [
            h.name, h.slug,
            owners_map.get(h.id, User()).email if owners_map.get(h.id) else "N/A",
            h.is_active, h.is_paused,
            subs_map.get(h.id).plan_name if subs_map.get(h.id) else "None",
            subs_map.get(h.id).status if subs_map.get(h.id) else "none",
            subs_map.get(h.id).end_date.isoformat() if subs_map.get(h.id) and subs_map[h.id].end_date else "",
            h.feature_ai_agent,
            h.created_at.isoformat() if h.created_at else "",
        ]
        for h in hotels
    ]

    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="EXPORT_ALL_HOTELS",
        description="Exported summary list of all platform hotels as CSV",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()

    filename = f"all-hotels-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return _csv_response(rows, headers, filename)


