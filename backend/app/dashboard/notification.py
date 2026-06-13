from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
import uuid
from app.guests.user import User

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    title: str
    message: str
    type: str = Field(default="info") # info, success, warning, error
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    # user: Optional[User] = Relationship(back_populates="notifications")
