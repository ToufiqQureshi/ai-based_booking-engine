"""
Video upload support on /api/v1/upload.

Covers MP4/WebM magic-byte validation, size limits, and that a spoofed/foreign
file is rejected — videos must be validated as strictly as images (PUB-02).
"""
import pytest
from httpx import AsyncClient

from app.system import upload as upload_mod

# Minimal valid container headers.
MP4_BYTES = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 32
WEBM_BYTES = b"\x1a\x45\xdf\xa3" + b"\x00" * 32


# ─── Unit: magic-byte detection ───────────────────────────────────────────────

class TestVideoMagicBytes:
    def test_valid_mp4(self):
        assert upload_mod._detect_safe_content_type(MP4_BYTES, ".mp4") == "video/mp4"

    def test_valid_webm(self):
        assert upload_mod._detect_safe_content_type(WEBM_BYTES, ".webm") == "video/webm"

    def test_mp4_ext_with_non_video_bytes_rejected(self):
        import fastapi
        with pytest.raises(fastapi.HTTPException) as e:
            upload_mod._detect_safe_content_type(b"<html>nope</html>", ".mp4")
        assert e.value.status_code == 400

    def test_webm_ext_with_bad_bytes_rejected(self):
        import fastapi
        with pytest.raises(fastapi.HTTPException) as e:
            upload_mod._detect_safe_content_type(b"GIF89a....", ".webm")
        assert e.value.status_code == 400


# ─── Endpoint ─────────────────────────────────────────────────────────────────

def _mock_supabase(monkeypatch):
    uploaded = {}

    class _Bucket:
        def upload(self, path, file, file_options):
            uploaded["path"] = path
            uploaded["content_type"] = file_options.get("content-type")

        def get_public_url(self, name):
            return f"https://proj.supabase.co/storage/v1/object/public/hotel-assets/{name}"

    class _Storage:
        def from_(self, bucket):
            uploaded["bucket"] = bucket
            return _Bucket()

    class _Client:
        storage = _Storage()

    monkeypatch.setattr(upload_mod, "get_supabase", lambda: _Client())
    return uploaded


class TestVideoUploadEndpoint:
    pytestmark = pytest.mark.asyncio

    async def test_valid_mp4_upload(self, auth_client: AsyncClient, monkeypatch):
        uploaded = _mock_supabase(monkeypatch)
        r = await auth_client.post(
            "/api/v1/upload",
            files={"file": ("walkthrough.mp4", MP4_BYTES, "video/mp4")},
        )
        assert r.status_code == 200, r.text
        assert "hotel-assets" in r.json()["url"]
        assert uploaded["bucket"] == "hotel-assets"
        # Content-type is derived from the bytes, not the client header.
        assert uploaded["content_type"] == "video/mp4"

    async def test_fake_mp4_rejected(self, auth_client: AsyncClient, monkeypatch):
        _mock_supabase(monkeypatch)
        r = await auth_client.post(
            "/api/v1/upload",
            files={"file": ("evil.mp4", b"<script>alert(1)</script>", "video/mp4")},
        )
        assert r.status_code == 400

    async def test_oversized_video_rejected(self, auth_client: AsyncClient, monkeypatch):
        _mock_supabase(monkeypatch)
        monkeypatch.setattr(upload_mod, "MAX_VIDEO_SIZE", 1024)  # shrink cap for the test
        big = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4096
        r = await auth_client.post(
            "/api/v1/upload",
            files={"file": ("big.mp4", big, "video/mp4")},
        )
        assert r.status_code == 413
