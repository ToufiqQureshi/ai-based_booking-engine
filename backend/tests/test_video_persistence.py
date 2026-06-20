"""
Per-entity video persistence + per-entity caps.

- RoomType / Hotel expose a `videos` JSON column that round-trips.
- Caps are enforced at the schema boundary: 2 videos/room, 5 videos/property.
"""
import uuid

import pytest
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.rooms.room import RoomType, RoomTypeCreate, MAX_ROOM_VIDEOS
from app.brand_console.hotel import Hotel, HotelUpdate


def _vid(n):
    return [{"url": f"https://x/storage/v1/object/public/hotel-assets/v{i}.mp4"} for i in range(n)]


# ─── Schema caps (pure validation, no DB) ─────────────────────────────────────

class TestVideoCaps:
    def test_room_allows_two_videos(self):
        rc = RoomTypeCreate(name="R", base_price=1000, videos=_vid(MAX_ROOM_VIDEOS))
        assert len(rc.videos) == MAX_ROOM_VIDEOS

    def test_room_rejects_three_videos(self):
        with pytest.raises(ValidationError):
            RoomTypeCreate(name="R", base_price=1000, videos=_vid(3))

    def test_property_allows_five_videos(self):
        hu = HotelUpdate(videos=_vid(5))
        assert len(hu.videos) == 5

    def test_property_rejects_six_videos(self):
        with pytest.raises(ValidationError):
            HotelUpdate(videos=_vid(6))


# ─── DB round-trip ────────────────────────────────────────────────────────────

class TestVideoRoundTrip:
    pytestmark = pytest.mark.asyncio

    async def test_room_videos_persist(self, seeded_hotel: Hotel):
        from tests.conftest import engine
        rid = str(uuid.uuid4())
        async with AsyncSession(engine) as session:
            session.add(RoomType(
                id=rid, hotel_id=seeded_hotel.id, name="Vid Room",
                base_price=1000.0, total_inventory=1, base_occupancy=2, max_occupancy=2,
                videos=[{"url": "https://x/storage/v1/object/public/hotel-assets/clip.mp4",
                         "type": "video", "mime": "video/mp4"}],
            ))
            await session.commit()
        async with AsyncSession(engine) as session:
            got = await session.get(RoomType, rid)
            assert got.videos and got.videos[0]["mime"] == "video/mp4"

    async def test_hotel_has_videos_default_empty(self, seeded_hotel: Hotel):
        from tests.conftest import engine
        async with AsyncSession(engine) as session:
            h = await session.get(Hotel, seeded_hotel.id)
            assert isinstance(h.videos, list)  # defaults to [] — never NULL on read
