from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, List
from datetime import datetime
import uuid

class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: Optional[str] = Field(default=None, index=True)
    user_email: str = Field(default="system")
    hotel_id: Optional[str] = Field(default=None, index=True)
    action: str = Field(index=True)
    description: str
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SystemBroadcast(SQLModel, table=True):
    __tablename__ = "system_broadcasts"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str
    message: str
    type: str = Field(default="info") # info, warning, success, urgent
    is_active: bool = Field(default=True)

    # Scheduling
    scheduled_at: Optional[datetime] = Field(default=None, index=True)
    expires_at: Optional[datetime] = None
    is_published: bool = Field(default=True, index=True)  # false if scheduled for future

    # Targeting (JSON list of plan names or hotel ids; empty = all)
    target_plans: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    target_hotel_ids: List[str] = Field(default_factory=list, sa_column=Column(JSON))

    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
