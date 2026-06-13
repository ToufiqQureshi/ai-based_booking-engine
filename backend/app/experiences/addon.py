
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import uuid
from datetime import datetime

class AddOn(SQLModel, table=True):
    __tablename__ = "addons"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(index=True)
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    category: str = "general" # e.g., "food", "romance", "wellness", "transport"
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AddOnCreate(SQLModel):
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    category: str = "general"
    is_active: bool = True

class AddOnUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
