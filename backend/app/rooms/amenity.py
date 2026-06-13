from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
import secrets

# Link Table for Many-to-Many
class RoomAmenityLink(SQLModel, table=True):
    __tablename__ = "room_amenity_links"
    room_id: str = Field(foreign_key="room_types.id", primary_key=True)
    amenity_id: str = Field(foreign_key="amenities.id", primary_key=True)

class Amenity(SQLModel, table=True):
    __tablename__ = "amenities"
    
    id: str = Field(default_factory=lambda: secrets.token_urlsafe(8), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    name: str
    icon_slug: str = Field(default="star") # Lucide icon name, e.g. "wifi", "waves"
    category: str = Field(default="general") # general, bathroom, tech, etc.
    scope: str = Field(default="room", description="room or hotel")
    description: Optional[str] = None
    is_featured: bool = Field(default=False) # Show on room card?
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Pydantic Schemas
from pydantic import BaseModel

class AmenityCreate(BaseModel):
    name: str
    icon_slug: str
    category: str = "general"
    scope: str = "room"
    description: Optional[str] = None
    is_featured: bool = False

class AmenityRead(BaseModel):
    id: str
    name: str
    icon_slug: str
    category: str
    scope: str
    description: Optional[str] = None
    is_featured: bool
