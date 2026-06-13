"""
Durable AI-usage accounting (AI-10).

Redis remains the fast path for quota enforcement, but it flaps on some
deploys (Railway internal DNS), which used to make the hotelier usage
dashboard go blank. These tables are the SOURCE OF TRUTH the dashboard reads
from, so usage counts survive any Redis outage.

  - AIUsageDaily        one row per (hotel, agent_type, day): tokens, messages,
                        and a maintained unique-participant count.
  - AIUsageParticipant  one row per distinct participant per (hotel, agent, day);
                        the hashed id (never raw PII) makes the unique count exact.
"""
from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint, Index
from datetime import date, datetime
import uuid


class AIUsageDaily(SQLModel, table=True):
    __tablename__ = "ai_usage_daily"
    __table_args__ = (
        UniqueConstraint("hotel_id", "agent_type", "usage_date", name="uq_ai_usage_daily"),
        Index("idx_ai_usage_daily_lookup", "hotel_id", "usage_date"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    agent_type: str = Field(index=True)  # hotelier | guest | whatsapp
    usage_date: date = Field(index=True)

    total_tokens: int = Field(default=0)
    message_count: int = Field(default=0)   # AI runs (message exchanges)
    unique_users: int = Field(default=0)    # distinct participants that day

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AIUsageParticipant(SQLModel, table=True):
    __tablename__ = "ai_usage_participant"
    __table_args__ = (
        UniqueConstraint("hotel_id", "agent_type", "usage_date", "user_hash", name="uq_ai_usage_participant"),
    )

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    agent_type: str = Field()
    usage_date: date = Field(index=True)
    user_hash: str = Field()  # sha256(phone/email/ip)[:16] — never raw PII
    created_at: datetime = Field(default_factory=datetime.utcnow)
