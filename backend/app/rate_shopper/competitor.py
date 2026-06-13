"""
Competitor and CompetitorRate Models
Used by the Rate Shopper engine.
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date
import uuid

class CompetitorBase(SQLModel):
    name: str = Field(index=True)
    url: str = Field(nullable=False)
    is_active: bool = Field(default=True)


class Competitor(CompetitorBase, table=True):
    __tablename__ = "competitors"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    # Crawler state
    last_scrape_status: Optional[str] = Field(default="Pending") # Pending, Running, Completed, Failed
    last_scrape_error: Optional[str] = Field(default=None)
    last_scraped_at: Optional[datetime] = Field(default=None)
    scrape_started_at: Optional[datetime] = Field(default=None)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    rates: List["CompetitorRate"] = Relationship(
        back_populates="competitor",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class CompetitorRate(SQLModel, table=True):
    __tablename__ = "competitor_rates"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    competitor_id: str = Field(foreign_key="competitors.id", index=True)
    
    check_in_date: date = Field(index=True)
    room_type: str = Field(index=True)
    status: str = Field(default="Available") # Available, Sold Out
    
    # Rates and plans scraped
    ep_base: Optional[float] = None
    ep_total: Optional[float] = None
    cp_base: Optional[float] = None
    cp_total: Optional[float] = None
    map_base: Optional[float] = None
    map_total: Optional[float] = None
    ap_base: Optional[float] = None
    ap_total: Optional[float] = None
    
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    
    competitor: Competitor = Relationship(back_populates="rates")


class CompetitorCreate(SQLModel):
    name: str
    url: str


class CompetitorRead(CompetitorBase):
    id: str
    hotel_id: str
    last_scrape_status: Optional[str]
    last_scrape_error: Optional[str]
    last_scraped_at: Optional[datetime]
    scrape_started_at: Optional[datetime]
    created_at: datetime
