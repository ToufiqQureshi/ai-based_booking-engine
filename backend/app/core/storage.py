"""
Best-effort Supabase Storage object cleanup.

When a room or hotel is deleted we must also remove its media from the public
`hotel-assets` bucket, otherwise orphaned files accumulate forever — wasting
storage and money (the lifecycle gap called out in the storage audit).

Design rules:
  - NEVER raise. Cleanup must never break the owning delete operation; a failed
    object removal is logged and swallowed.
  - Only ever touch objects inside our own public bucket. We parse the object
    path out of a Supabase public URL and refuse anything that isn't clearly
    within `hotel-assets`, so a tampered/foreign URL can't make us delete
    something unexpected.
  - Tolerant of unknown media-dict shapes (photos/videos are stored as JSON
    dicts whose key names have varied over time), so we scan every string value.
"""
import logging
from typing import Iterable, List, Optional

from app.core.db.supabase import get_supabase

logger = logging.getLogger(__name__)

PUBLIC_BUCKET = "hotel-assets"
# Supabase public URLs look like:
#   https://<proj>.supabase.co/storage/v1/object/public/hotel-assets/<object-path>
_BUCKET_MARKER = f"/{PUBLIC_BUCKET}/"


def extract_object_path(url: str) -> Optional[str]:
    """Return the object path within PUBLIC_BUCKET for a Supabase public URL.

    Returns None for anything that isn't a hotel-assets URL (foreign hosts,
    other buckets, non-strings) so we never delete outside our own bucket.
    """
    if not isinstance(url, str):
        return None
    idx = url.find(_BUCKET_MARKER)
    if idx == -1:
        return None
    path = url[idx + len(_BUCKET_MARKER):]
    # Drop any query string / fragment Supabase may append (e.g. ?token=...).
    path = path.split("?", 1)[0].split("#", 1)[0].strip("/")
    return path or None


def collect_object_paths(media_items: Iterable) -> List[str]:
    """Pull every hotel-assets object path out of a list of media entries.

    Each entry may be a plain URL string or a dict (e.g. {"url": ...}); we scan
    all string values so we don't depend on a specific key name. Duplicates are
    de-duplicated while preserving order.
    """
    paths: List[str] = []
    seen = set()
    for item in media_items or []:
        if isinstance(item, str):
            candidates = [item]
        elif isinstance(item, dict):
            candidates = [v for v in item.values() if isinstance(v, str)]
        else:
            candidates = []
        for c in candidates:
            p = extract_object_path(c)
            if p and p not in seen:
                seen.add(p)
                paths.append(p)
    return paths


def delete_media_objects(*media_lists: Iterable) -> int:
    """Best-effort removal of every hotel-assets object referenced by the given
    media list(s). Returns the number of objects removal was attempted for.
    Never raises — safe to call from a request handler or background task.
    """
    try:
        paths: List[str] = []
        seen = set()
        for media_items in media_lists:
            for p in collect_object_paths(media_items):
                if p not in seen:
                    seen.add(p)
                    paths.append(p)
        if not paths:
            return 0
        client = get_supabase()
        client.storage.from_(PUBLIC_BUCKET).remove(paths)
        logger.info("Storage cleanup: removed %d object(s) from %s", len(paths), PUBLIC_BUCKET)
        return len(paths)
    except Exception as exc:  # pragma: no cover - cleanup must never break a delete
        logger.warning("Storage cleanup failed (non-fatal): %s", exc)
        return 0
