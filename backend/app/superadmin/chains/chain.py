from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
import uuid

if TYPE_CHECKING:
    from app.brand_console.hotel import Hotel
    from app.guests.user import User

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

    # ── Chain Widget appearance & features ────────────────────────────────────
    # The multi-property "chain widget" gets the same style system as the single
    # hotel booking widget, plus brand-level features that matter to large groups.
    widget_layout: str = Field(default="modern")          # modern, minimal, classic, floating, far, ota, glassmorphism
    widget_bg_color: str = Field(default="#FFFFFF")
    widget_theme: str = Field(default="light")            # light, dark, theme
    widget_show_price: bool = Field(default=True)          # show "from" price in the picker
    widget_show_loyalty: bool = Field(default=True)        # "Members save more" brand badge
    widget_show_property_count: bool = Field(default=True) # "X properties across Y cities" social proof

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
