from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Depends
import os
import uuid
import io
import aiofiles
import logging
from typing import List
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from app.core.supabase import get_supabase
from app.api.deps import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["Upload"])

# SECURITY: File upload constraints
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"
}

# Map a verified PIL image format to its canonical, safe content-type. We
# derive the content-type from the actual bytes, NOT the client-supplied
# header, so a file can't be served as text/html from the public bucket.
_PIL_FORMAT_TO_CONTENT_TYPE = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
    "GIF": "image/gif",
}


def _detect_safe_content_type(contents: bytes, original_ext: str) -> str:
    """Validate the bytes match an allowed type and return a safe content-type.
    Raises HTTPException(400) on mismatch (PUB-02)."""
    if original_ext == ".pdf":
        if not contents.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="File content is not a valid PDF")
        return "application/pdf"
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
async def upload_file(
    file: UploadFile = File(...),
    current_user = Depends(get_current_active_user)
):
    try:
        # SECURITY: Validate filename exists
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # SECURITY: Validate extension
        original_ext = os.path.splitext(file.filename)[1].lower()
        if original_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="File type not allowed")

        # 1. Read file content
        contents = await file.read()

        # 2. Check file size
        if len(contents) > MAX_FILE_SIZE:
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


