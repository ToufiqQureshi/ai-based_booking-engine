"""
Super Admin — Support ticket queue.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import select, func

from app.api.deps import DbSession, CurrentUser
from app.models.audit import AuditLog
from app.models.ticket import SupportTicket, TicketMessage
from app.models.hotel import Hotel
from app.models.user import User
from .hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


SLA_HOURS = {"urgent": 2, "high": 8, "normal": 24, "low": 72}


async def _next_ticket_number(session) -> str:
    count = (await session.execute(select(func.count(SupportTicket.id)))).scalar() or 0
    year = datetime.utcnow().year
    return f"T-{year}-{(count + 1):06d}"


# ──────────────── Listing & Stats ────────────────

@router.get("/tickets/summary")
async def tickets_summary(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    rows = (await session.execute(
        select(SupportTicket.status, func.count(SupportTicket.id))
        .group_by(SupportTicket.status)
    )).all()
    by_status = {s: c for s, c in rows}

    now = datetime.utcnow()
    sla_breach = (await session.execute(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.status.in_(["open", "in_progress", "awaiting_customer"]),
            SupportTicket.sla_due_at.is_not(None),
            SupportTicket.sla_due_at < now,
        )
    )).scalar() or 0

    unassigned = (await session.execute(
        select(func.count(SupportTicket.id)).where(
            SupportTicket.assigned_to.is_(None),
            SupportTicket.status.in_(["open", "in_progress"]),
        )
    )).scalar() or 0
    return {
        "by_status": by_status,
        "sla_breach": sla_breach,
        "unassigned": unassigned,
    }


@router.get("/tickets")
async def list_tickets(
    session: DbSession,
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    hotel_id: Optional[str] = None,
    limit: int = 100,
    super_admin: User = Depends(get_super_admin),
):
    q = select(SupportTicket)
    if status_filter:
        q = q.where(SupportTicket.status == status_filter)
    if priority:
        q = q.where(SupportTicket.priority == priority)
    if assigned_to:
        q = q.where(SupportTicket.assigned_to == assigned_to)
    if hotel_id:
        q = q.where(SupportTicket.hotel_id == hotel_id)
    q = q.order_by(SupportTicket.created_at.desc()).limit(limit)
    return (await session.execute(q)).scalars().all()


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    ticket = await session.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    messages = (await session.execute(
        select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at.asc())
    )).scalars().all()
    hotel = None
    if ticket.hotel_id:
        h = await session.get(Hotel, ticket.hotel_id)
        if h:
            hotel = {"id": h.id, "name": h.name, "slug": h.slug}
    return {
        "ticket": ticket.model_dump(),
        "messages": [m.model_dump() for m in messages],
        "hotel": hotel,
    }


# ──────────────── Create / Reply / Manage ────────────────

@router.post("/tickets")
async def create_ticket(
    data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Super admin can also raise a ticket on behalf of a hotelier."""
    priority = data.get("priority", "normal")
    sla_due = datetime.utcnow() + timedelta(hours=SLA_HOURS.get(priority, 24))

    ticket = SupportTicket(
        ticket_number=await _next_ticket_number(session),
        hotel_id=data.get("hotel_id"),
        raised_by=data.get("raised_by") or super_admin.id,
        raised_by_email=data.get("raised_by_email") or super_admin.email,
        raised_by_name=data.get("raised_by_name") or super_admin.name,
        subject=data["subject"],
        description=data["description"],
        category=data.get("category", "general"),
        priority=priority,
        sla_due_at=sla_due,
    )
    session.add(ticket)
    await session.flush()

    msg = TicketMessage(
        ticket_id=ticket.id,
        author_id=ticket.raised_by,
        author_email=ticket.raised_by_email,
        author_name=ticket.raised_by_name,
        author_type="super_admin",
        body=ticket.description,
    )
    session.add(msg)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=ticket.hotel_id,
        action="TICKET_CREATE",
        description=f"Opened ticket {ticket.ticket_number}: {ticket.subject}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/reply")
async def reply_ticket(
    ticket_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    ticket = await session.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    msg = TicketMessage(
        ticket_id=ticket_id,
        author_id=super_admin.id,
        author_email=super_admin.email,
        author_name=super_admin.name,
        author_type="super_admin",
        body=data["body"],
        is_internal_note=bool(data.get("is_internal_note", False)),
        attachments=data.get("attachments", []),
    )
    session.add(msg)

    if not ticket.first_response_at and not msg.is_internal_note:
        ticket.first_response_at = datetime.utcnow()
    if not msg.is_internal_note and ticket.status == "open":
        ticket.status = "awaiting_customer"
    ticket.updated_at = datetime.utcnow()
    session.add(ticket)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=ticket.hotel_id,
        action="TICKET_REPLY",
        description=f"Replied on ticket {ticket.ticket_number}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(msg)
    return msg


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    ticket = await session.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    for k in ("subject", "category", "priority", "status"):
        if k in data:
            setattr(ticket, k, data[k])
    if "priority" in data:
        ticket.sla_due_at = ticket.created_at + timedelta(
            hours=SLA_HOURS.get(ticket.priority, 24)
        )
    if data.get("status") == "resolved":
        ticket.resolved_at = datetime.utcnow()
    if data.get("status") == "closed":
        ticket.closed_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()
    session.add(ticket)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=ticket.hotel_id,
        action="TICKET_UPDATE",
        description=f"Updated ticket {ticket.ticket_number}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return ticket


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: str, request: Request, session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.tickets.delete")),
):
    """Permanently delete a ticket and its message thread."""
    ticket = await session.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    messages = (await session.execute(
        select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)
    )).scalars().all()
    for m in messages:
        await session.delete(m)

    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=ticket.hotel_id,
        action="TICKET_DELETE",
        description=f"Deleted ticket {ticket.ticket_number}: {ticket.subject}",
        ip_address=_get_client_ip(request),
    ))
    await session.delete(ticket)
    await session.commit()
    return {"message": "Deleted"}


@router.post("/tickets/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: str, data: dict, request: Request, session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    ticket = await session.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    assignee_id = data.get("assigned_to")
    if not assignee_id:
        ticket.assigned_to = None
        ticket.assigned_to_email = None
        ticket.assigned_at = None
    else:
        assignee = await session.get(User, assignee_id)
        if not assignee:
            raise HTTPException(404, "Assignee not found")
        ticket.assigned_to = assignee.id
        ticket.assigned_to_email = assignee.email
        ticket.assigned_at = datetime.utcnow()
        if ticket.status == "open":
            ticket.status = "in_progress"
    ticket.updated_at = datetime.utcnow()
    session.add(ticket)
    session.add(AuditLog(
        user_id=super_admin.id, user_email=super_admin.email, hotel_id=ticket.hotel_id,
        action="TICKET_ASSIGN",
        description=f"Ticket {ticket.ticket_number} assigned to {ticket.assigned_to_email or 'unassigned'}",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    return ticket


# ──────────────── Hotelier-side endpoints ────────────────

@router.get("/tickets/mine/list")
async def list_my_tickets(
    session: DbSession,
    current_user: CurrentUser,
):
    """A hotelier sees only their own tickets."""
    q = select(SupportTicket).where(SupportTicket.raised_by == current_user.id)
    q = q.order_by(SupportTicket.created_at.desc())
    return (await session.execute(q)).scalars().all()


@router.post("/tickets/mine/create")
async def create_my_ticket(
    data: dict, request: Request, session: DbSession,
    current_user: CurrentUser,
):
    priority = data.get("priority", "normal")
    sla_due = datetime.utcnow() + timedelta(hours=SLA_HOURS.get(priority, 24))
    ticket = SupportTicket(
        ticket_number=await _next_ticket_number(session),
        hotel_id=getattr(current_user, "hotel_id", None),
        raised_by=current_user.id,
        raised_by_email=current_user.email,
        raised_by_name=current_user.name,
        subject=data["subject"],
        description=data["description"],
        category=data.get("category", "general"),
        priority=priority,
        sla_due_at=sla_due,
    )
    session.add(ticket)
    await session.flush()
    session.add(TicketMessage(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_email=current_user.email,
        author_name=current_user.name,
        author_type="hotelier",
        body=ticket.description,
    ))
    await session.commit()
    await session.refresh(ticket)
    return ticket
