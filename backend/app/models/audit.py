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

    # Scheduling — Optional so existing rows with NULL deserialize cleanly
    scheduled_at: Optional[datetime] = Field(default=None, index=True)
    expires_at: Optional[datetime] = Field(default=None)
    is_published: Optional[bool] = Field(default=True, index=True)

    # Targeting — Optional to tolerate NULL in legacy rows
    target_plans: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    target_hotel_ids: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    created_by: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
