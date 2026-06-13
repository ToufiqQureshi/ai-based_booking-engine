from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional

class UserHotelLink(SQLModel, table=True):
    """
    Many-to-Many link between User and Hotel.
    Allows a user to be associated with multiple hotels.
    """
    __tablename__ = "user_hotel_links"
    
    user_id: str = Field(foreign_key="users.id", primary_key=True)
    # DB-01: index hotel_id for "all users of a hotel" lookups in the
    # multi-property flow (the composite PK only helps user_id-first lookups).
    hotel_id: str = Field(foreign_key="hotels.id", primary_key=True, index=True)
    
    role: str = Field(default="OWNER") # Role specific to this hotel
    is_active: bool = Field(default=True)
    
    joined_at: datetime = Field(default_factory=datetime.utcnow)
