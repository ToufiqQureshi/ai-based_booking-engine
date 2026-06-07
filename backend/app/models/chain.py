from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.user import User

class Chain(SQLModel, table=True):
    """
    Brand or Chain group containing multiple hotel properties.
    """
    __tablename__ = "chains"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(default="#4f46e5")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    hotels: List["Hotel"] = Relationship(
        back_populates="chain",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    users: List["User"] = Relationship(
        back_populates="chain",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
