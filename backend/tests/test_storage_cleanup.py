"""
Storage lifecycle cleanup (orphaned-media prevention).

Covers app/core/storage.py: only objects inside our own public bucket are ever
targeted, unknown media-dict shapes are tolerated, and cleanup never raises.
"""
import pytest

from app.core import storage

BUCKET = storage.PUBLIC_BUCKET
BASE = f"https://proj.supabase.co/storage/v1/object/public/{BUCKET}/"


class TestExtractObjectPath:
    def test_valid_public_url(self):
        assert storage.extract_object_path(f"{BASE}rooms/abc.jpg") == "rooms/abc.jpg"

    def test_strips_query_string(self):
        assert storage.extract_object_path(f"{BASE}abc.png?token=xyz") == "abc.png"

    def test_foreign_host_ignored(self):
        # An attacker-controlled URL that isn't in our bucket must never resolve.
        assert storage.extract_object_path("https://evil.com/secret.jpg") is None

    def test_other_bucket_ignored(self):
        assert storage.extract_object_path(
            "https://proj.supabase.co/storage/v1/object/public/other-bucket/x.jpg"
        ) is None

    def test_non_string_ignored(self):
        assert storage.extract_object_path(None) is None
        assert storage.extract_object_path(123) is None


class TestCollectObjectPaths:
    def test_mixed_dicts_and_strings_dedup(self):
        items = [
            {"url": f"{BASE}a.jpg", "caption": "hero"},
            {"image": f"{BASE}b.png"},
            f"{BASE}a.jpg",                 # duplicate of first
            {"url": "https://cdn.example.com/c.jpg"},  # foreign -> ignored
            "not a url",
        ]
        assert storage.collect_object_paths(items) == ["a.jpg", "b.png"]

    def test_empty(self):
        assert storage.collect_object_paths([]) == []
        assert storage.collect_object_paths(None) == []


class TestDeleteMediaObjects:
    def test_removes_only_bucket_paths(self, monkeypatch):
        removed = {}

        class _FakeStorageBucket:
            def remove(self, paths):
                removed["paths"] = paths

        class _FakeStorage:
            def from_(self, bucket):
                removed["bucket"] = bucket
                return _FakeStorageBucket()

        class _FakeClient:
            storage = _FakeStorage()

        monkeypatch.setattr(storage, "get_supabase", lambda: _FakeClient())

        n = storage.delete_media_objects(
            [{"url": f"{BASE}room1.jpg"}],
            [f"{BASE}room2.png", "https://evil.com/x"],
        )
        assert n == 2
        assert removed["bucket"] == BUCKET
        assert removed["paths"] == ["room1.jpg", "room2.png"]

    def test_no_paths_skips_client(self, monkeypatch):
        def _boom():
            raise AssertionError("get_supabase must not be called when nothing to delete")
        monkeypatch.setattr(storage, "get_supabase", _boom)
        assert storage.delete_media_objects([{"caption": "no url here"}]) == 0

    def test_never_raises_on_backend_error(self, monkeypatch):
        def _raise():
            raise RuntimeError("storage down")
        monkeypatch.setattr(storage, "get_supabase", _raise)
        # Must swallow the error and report 0 — cleanup can never break a delete.
        assert storage.delete_media_objects([{"url": f"{BASE}a.jpg"}]) == 0


# ─── Orphaned-media sweep (scheduled cleanup) ─────────────────────────────────

import pytest as _pytest
import uuid as _uuid
from datetime import datetime as _dt, timezone as _tz
from sqlalchemy.ext.asyncio import AsyncSession as _AS


class _FakeBucket:
    def __init__(self, objects):
        self._objects = objects
        self.removed = []

    def list(self, path="", options=None):
        # single page (test set is small)
        off = (options or {}).get("offset", 0)
        return self._objects if off == 0 else []

    def remove(self, paths):
        self.removed.extend(paths)


class _FakeStorage:
    def __init__(self, bucket):
        self._bucket = bucket

    def from_(self, name):
        return self._bucket


@_pytest.mark.asyncio
async def test_sweep_deletes_only_old_unreferenced(monkeypatch, seeded_hotel):
    from tests.conftest import engine
    from app.rooms.room import RoomType
    from app.core import storage

    base = "https://x/storage/v1/object/public/hotel-assets/"
    # A room that references "keep.jpg" — must never be deleted.
    async with _AS(engine) as s:
        s.add(RoomType(
            id=str(_uuid.uuid4()), hotel_id=seeded_hotel.id, name="R",
            base_price=1000.0, total_inventory=1, base_occupancy=2, max_occupancy=2,
            photos=[{"url": base + "keep.jpg"}],
        ))
        await s.commit()

    old = "2020-01-01T00:00:00+00:00"
    new = _dt.now(_tz.utc).isoformat()
    objs = [
        {"name": "keep.jpg",      "created_at": old},  # referenced -> keep
        {"name": "orphan-old.jpg","created_at": old},  # unreferenced + old -> DELETE
        {"name": "orphan-new.jpg","created_at": new},  # unreferenced but within grace -> keep
        {"name": ".emptyFolderPlaceholder", "created_at": old},  # ignored
    ]
    bucket = _FakeBucket(objs)
    monkeypatch.setattr(storage, "get_supabase", lambda: type("C", (), {"storage": _FakeStorage(bucket)})())

    result = await storage.sweep_orphaned_media(grace_hours=24)

    assert bucket.removed == ["orphan-old.jpg"]
    assert result["deleted"] == 1
    assert result["scanned"] == 3  # placeholder skipped


@_pytest.mark.asyncio
async def test_sweep_keeps_addon_images_and_hotel_logo(monkeypatch, seeded_hotel):
    """Regression: single-string image columns (add-on image_url, hotel logo_url)
    must count as referenced. Previously the sweep only scanned room/hotel
    photos+videos, so it deleted every add-on image and hotel logo as 'orphans'."""
    from tests.conftest import engine
    from app.brand_console.hotel import Hotel
    from app.experiences.addon import AddOn
    from app.core import storage

    base = "https://x/storage/v1/object/public/hotel-assets/"
    async with _AS(engine) as s:
        s.add(AddOn(
            id=str(_uuid.uuid4()), hotel_id=seeded_hotel.id, name="Spa",
            price=3000.0, image_url=base + "addon.jpg", category="wellness",
        ))
        h = await s.get(Hotel, seeded_hotel.id)
        h.logo_url = base + "logo.png"
        s.add(h)
        await s.commit()

    old = "2020-01-01T00:00:00+00:00"
    objs = [
        {"name": "addon.jpg",  "created_at": old},   # referenced by add-on -> keep
        {"name": "logo.png",   "created_at": old},   # referenced by hotel logo -> keep
        {"name": "orphan.jpg", "created_at": old},   # unreferenced + old -> DELETE
    ]
    bucket = _FakeBucket(objs)
    monkeypatch.setattr(storage, "get_supabase", lambda: type("C", (), {"storage": _FakeStorage(bucket)})())

    result = await storage.sweep_orphaned_media(grace_hours=24)

    assert "addon.jpg" not in bucket.removed
    assert "logo.png" not in bucket.removed
    assert bucket.removed == ["orphan.jpg"]
    assert result["deleted"] == 1
