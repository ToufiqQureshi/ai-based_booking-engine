from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, date
from typing import Optional, List
from enum import Enum
import uuid

class CompetitorSource(str, Enum):
    BOOKING = "BOOKING"
    AGODA = "AGODA"
    EXPEDIA = "EXPEDIA"
    MAKEMYTRIP = "MAKEMYTRIP"
    OTHER = "OTHER"

class Competitor(SQLModel, table=True):
    __tablename__ = "competitors"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    
    name: str # e.g. "Taj Hotel"
    url: str
    source: CompetitorSource = Field(default=CompetitorSource.BOOKING)
    
    is_active: bool = Field(default=True)
    is_scheduled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    last_scrape_status: Optional[str] = Field(default=None)
    last_scrape_error: Optional[str] = Field(default=None)
    last_scraped_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    rates: List["CompetitorRate"] = Relationship(back_populates="competitor")


class CompetitorRate(SQLModel, table=True):
    __tablename__ = "competitor_rates"
    
    id: int = Field(default=None, primary_key=True) # Auto-increment int for huge volume
    competitor_id: str = Field(foreign_key="competitors.id", index=True)
    
    check_in_date: date = Field(index=True)
    price: float
    currency: str = Field(default="INR")
    room_type: Optional[str] = Field(default="Standard")
    is_sold_out: bool = Field(default=False, index=True)
    
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    
    competitor: Optional[Competitor] = Relationship(back_populates="rates")


class ScraperUsage(SQLModel, table=True):
    __tablename__ = "scraper_usage"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    hotel_id: str = Field(foreign_key="hotels.id", index=True)
    competitor_id: str = Field(foreign_key="competitors.id", index=True)
    
    scraped_at: datetime = Field(default_factory=datetime.utcnow)
    request_count: int = Field(default=7)
    status: str # "success" or "failed"

