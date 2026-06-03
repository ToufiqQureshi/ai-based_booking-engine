"""
User Model
Frontend ke User interface se match karta hai.
Multi-tenant system hai - har user ek hotel se linked hai.
"""
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from enum import Enum
import uuid

if TYPE_CHECKING:
    from app.models.hotel import Hotel
    from app.models.chain import Chain


class UserRole(str, Enum):
    """User roles - Frontend ke UserRole type se match"""
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"
    SUPER_ADMIN = "SUPER_ADMIN"


class UserBase(SQLModel):
    """Base fields jo create aur response dono mein common hain"""
    email: str = Field(unique=True, index=True)
    name: str
    role: UserRole = Field(default=UserRole.OWNER)


class User(UserBase, table=True):
    """
    Database table for users.
    Frontend expects: id, email, name, role, hotel_id, created_at, updated_at
    """
    __tablename__ = "users"
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    supabase_id: Optional[str] = Field(default=None, index=True, unique=True)
    hashed_password: str
    hotel_id: Optional[str] = Field(default=None, foreign_key="hotels.id", index=True)
    chain_id: Optional[str] = Field(default=None, foreign_key="chains.id", index=True)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship - User belongs to Hotel
    hotel: Optional["Hotel"] = Relationship(back_populates="users")
    chain: Optional["Chain"] = Relationship(back_populates="users")


class UserCreate(SQLModel):
    """Signup request schema - matches frontend SignupRequest"""
    email: str
    password: str
    name: str
    hotel_name: str  # New hotel bhi banegi signup par


class UserLogin(SQLModel):
    """Login request schema - matches frontend LoginRequest"""
    email: str
    password: str


class UserRead(UserBase):
    """Response schema - Frontend ke User interface se match"""
    id: str
    hotel_id: Optional[str]
    chain_id: Optional[str]
    created_at: datetime
    updated_at: datetime
