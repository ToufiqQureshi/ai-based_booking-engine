"""
Hotel Social Proof Settings

The "social proof" widget on a hotel's public booking page shows badges
like:
  - "12 people are viewing this hotel right now"
  - "Last booked 3 hours ago"
  - "X bookings this month"
  - Hotelier-defined custom badges (e.g. "Family owned since 2015")

This model is owned by the HOTELIER (not the super-admin) because the
display labels and which badges to show are a business / marketing
decision. The platform only ever:

  1. Computes the underlying real numbers (bookings this month, last
     booking timestamp, review aggregate) and exposes them via
     /api/v1/public/social-proof/{slug}.
  2. Caches the stats here so the public endpoint stays under 100ms
     even when the bookings table grows large.

Schema notes:
  - hotel_id has a UNIQUE index — at most one settings row per hotel.
  - The "real stats" columns (cached_*) are refreshed by a background
    task on a 5-minute cadence (see app/api/v1/social_proof.py).
  - custom_badges is a JSON array of {label, icon, sort_order} dicts
    so hoteliers can add their own marketing claims (e.g. "Eco
    certified 2024", "Award winning", "Pet friendly").
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import JSON, Column
from sqlmodel import SQLModel, Field


class HotelSocialProofSettings(SQLModel, table=True):
    """Per-hotel configuration for the public-page social proof widget.

    Hotelier-controlled: is_enabled, which badges to show, custom labels.
    Platform-controlled: cached_booking_count, cached_review_count,
    cached_avg_rating, cache_expires_at (written by background task).
    """
    __tablename__ = "hotel_social_proof_settings"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )
    # UNIQUE index — one settings row per hotel. Composed with the FK
    # for the public endpoint's <slug, settings> lookup.
    hotel_id: str = Field(
        foreign_key="hotels.id",
        unique=True,
        index=True,
    )

    # --- Hotelier-controlled toggles ---------------------------------
    is_enabled: bool = Field(default=False, index=True)
    show_viewers_count: bool = Field(default=True)
    show_last_booked: bool = Field(default=True)
    show_popular_badge: bool = Field(default=True)
    show_review_summary: bool = Field(default=True)
    popular_badge_text: str = Field(
        default="Popular choice! {count} bookings this month"
    )

    # Custom badges the hotelier can add: [{label, icon, sort_order}, ...]
    # icon is a lucide-react icon name OR an emoji.
    custom_badges: List[dict] = Field(
        default_factory=list,
        sa_column=Column(JSON),
    )

    # --- Platform-controlled (written by background task) -----------
    cached_booking_count: int = Field(default=0)
    cached_review_count: int = Field(default=0)
    cached_avg_rating: float = Field(default=0.0)
    cached_hours_since_last_booking: Optional[float] = Field(default=None)
    cache_refreshed_at: Optional[datetime] = Field(default=None)

    # --- Bookkeeping -----------------------------------------------
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class HotelSocialProofSettingsRead(SQLModel):
    """Hotelier-facing read schema — never includes the cached stats
    (those are public, not for the dashboard)."""
    id: str
    hotel_id: str
    is_enabled: bool
    show_viewers_count: bool
    show_last_booked: bool
    show_popular_badge: bool
    show_review_summary: bool
    popular_badge_text: str
    custom_badges: List[dict]
    updated_at: datetime


class HotelSocialProofSettingsUpdate(SQLModel):
    """Hotelier-facing write schema. Only the hotelier-owned fields are
    accepted; cached_* are ignored even if the request body includes
    them (defense in depth)."""
    is_enabled: Optional[bool] = None
    show_viewers_count: Optional[bool] = None
    show_last_booked: Optional[bool] = None
    show_popular_badge: Optional[bool] = None
    show_review_summary: Optional[bool] = None
    popular_badge_text: Optional[str] = None
    custom_badges: Optional[List[dict]] = None


class PublicSocialProofResponse(SQLModel):
    """Public-facing response — the only fields the booking page needs.

    Designed for < 100ms response time: when is_enabled is False or the
    hotel is paused, the route short-circuits with an empty payload
    before any DB / Redis work.
    """
    is_enabled: bool
    active_viewers: Optional[int] = None
    hours_since_last_booking: Optional[float] = None
    bookings_this_month: Optional[int] = None
    review_count: Optional[int] = None
    avg_rating: Optional[float] = None
    custom_badges: List[dict] = []
    cancellation_policy_text: Optional[str] = None
    has_refundable_rate: Optional[bool] = None
