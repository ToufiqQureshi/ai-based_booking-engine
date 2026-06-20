from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Depends
import os
import uuid
import io
import logging
from PIL import Image, UnidentifiedImageError
from app.core.db.supabase import get_supabase
from app.core.utils.limiter import limiter
from app.core.auth.deps import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])

# SECURITY: File upload constraints
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB — images / PDF
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB — room/property showcase videos
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}
VIDEO_EXTENSIONS = {".mp4", ".webm"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"
}
VIDEO_CONTENT_TYPES = {"video/mp4", "video/webm"}

# Map a verified PIL image format to its canonical, safe content-type. We
# derive the content-type from the actual bytes, NOT the client-supplied
# header, so a file can't be served as text/html from the public bucket.
_PIL_FORMAT_TO_CONTENT_TYPE = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
    "GIF": "image/gif",
}


def _looks_like_mp4(contents: bytes) -> bool:
    """MP4/ISO-BMFF: a 'ftyp' box near the start (bytes 4-8). Covers MP4/M4V."""
    return len(contents) >= 12 and contents[4:8] == b"ftyp"


def _looks_like_webm(contents: bytes) -> bool:
    """WebM/Matroska: starts with the EBML header magic 0x1A45DFA3."""
    return contents[:4] == b"\x1a\x45\xdf\xa3"


def _detect_safe_content_type(contents: bytes, original_ext: str) -> str:
    """Validate the bytes match an allowed type and return a safe content-type.
    Raises HTTPException(400) on mismatch (PUB-02)."""
    if original_ext == ".pdf":
        if not contents.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="File content is not a valid PDF")
        return "application/pdf"
    # Video: validate container magic bytes so the bytes can't masquerade as
    # something executable/HTML, and so the bucket serves a correct video type.
    if original_ext == ".mp4":
        if not _looks_like_mp4(contents):
            raise HTTPException(status_code=400, detail="File content is not a valid MP4 video")
        return "video/mp4"
    if original_ext == ".webm":
        if not _looks_like_webm(contents):
            raise HTTPException(status_code=400, detail="File content is not a valid WebM video")
        return "video/webm"
    # Otherwise it must be a real, decodable image.
    try:
        with Image.open(io.BytesIO(contents)) as img:
            img.verify()
            fmt = (img.format or "").upper()
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="File content is not a valid image")
    content_type = _PIL_FORMAT_TO_CONTENT_TYPE.get(fmt)
    if not content_type:
        raise HTTPException(status_code=400, detail="Unsupported image format")
    return content_type


@router.post("", response_model=dict)
@limiter.limit("20/hour")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user = Depends(get_current_active_user)
):
    try:
        # SECURITY: Validate filename exists
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # SECURITY: Validate extension
        original_ext = os.path.splitext(file.filename)[1].lower()
        is_video = original_ext in VIDEO_EXTENSIONS
        if original_ext not in ALLOWED_EXTENSIONS and not is_video:
            raise HTTPException(status_code=400, detail="File type not allowed")

        size_cap = MAX_VIDEO_SIZE if is_video else MAX_FILE_SIZE

        # SECURITY: reject oversized uploads from the declared Content-Length
        # BEFORE reading the whole body into memory (cheap early guard).
        declared_len = request.headers.get("content-length")
        if declared_len and declared_len.isdigit() and int(declared_len) > size_cap + 1024:
            raise HTTPException(status_code=413, detail="File too large")

        # 1. Read file content
        contents = await file.read()

        # 2. Check file size (authoritative — Content-Length can be spoofed/absent)
        if len(contents) > size_cap:
            raise HTTPException(status_code=413, detail="File too large")

        # 2b. SECURITY (PUB-02): validate magic bytes and derive a safe
        # content-type server-side instead of trusting the client header.
        safe_content_type = _detect_safe_content_type(contents, original_ext)

        # 3. Choose bucket
        bucket_id = "reports" if original_ext == ".pdf" else "hotel-assets"

        # 4. Generate unique filename
        unique_filename = f"{uuid.uuid4()}{original_ext}"

        # 5. Upload to Supabase Storage
        supabase_client = get_supabase()
        supabase_client.storage.from_(bucket_id).upload(
            path=unique_filename,
            file=contents,
            file_options={"content-type": safe_content_type},
        )

        # 6. Get Public URL (if public bucket)
        if bucket_id == "hotel-assets":
            url_res = supabase_client.storage.from_(bucket_id).get_public_url(unique_filename)
            return {"url": url_res}
        else:
            # For reports, returning just the path if it's private
            return {"url": unique_filename, "bucket": bucket_id}

    except HTTPException:
        # Re-raise client errors (400/413) untouched — previously these were
        # swallowed by a broad `except Exception` and turned into 500s.
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="File upload failed")



