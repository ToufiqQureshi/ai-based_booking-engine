"""
Support Ticket System
Hoteliers raise tickets, Super Admin team responds.
"""
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, List
from datetime import datetime
import uuid


class SupportTicket(SQLModel, table=True):
    __tablename__ = "support_tickets"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    ticket_number: str = Field(unique=True, index=True)  # T-2026-000123

    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)
    raised_by: Optional[str] = None  # user id
    raised_by_email: str
    raised_by_name: Optional[str] = None

    subject: str
    description: str
    category: str = Field(default="general", index=True)
    # billing, technical, integration, account, feature_request, bug, general
    priority: str = Field(default="normal", index=True)  # low, normal, high, urgent
    status: str = Field(default="open", index=True)
    # open, in_progress, awaiting_customer, resolved, closed

    assigned_to: Optional[str] = None  # super admin user id
    assigned_to_email: Optional[str] = None
    assigned_at: Optional[datetime] = None

    # SLA tracking
    sla_due_at: Optional[datetime] = None
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    attachments: List[dict] = Field(default_factory=list, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TicketMessage(SQLModel, table=True):
    """A message thread inside a ticket - both hotelier & admin reply here."""
    __tablename__ = "ticket_messages"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    ticket_id: str = Field(foreign_key="support_tickets.id", index=True)

    author_id: Optional[str] = None
    author_email: str
    author_name: Optional[str] = None
    author_type: str = Field(default="hotelier")  # hotelier, super_admin, system

    body: str
    is_internal_note: bool = Field(default=False)  # only admins see this
    attachments: List[dict] = Field(default_factory=list, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)
