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
