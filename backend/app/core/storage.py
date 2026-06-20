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


def _is_older_than(created_at, cutoff) -> bool:
    """True only if we can confirm the object is older than `cutoff`.
    Unparseable / missing timestamps return False — fail-safe, so a freshly
    uploaded object whose age we can't read is never deleted."""
    if not created_at:
        return False
    try:
        from datetime import datetime
        ts = str(created_at).replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts)
        return dt < cutoff
    except Exception:
        return False


async def sweep_orphaned_media(grace_hours: int = 24) -> dict:
    """Delete hotel-assets objects that no room/hotel record references AND that
    are older than `grace_hours` (so in-progress uploads aren't nuked).

    This is the safety net for the orphans that per-delete cleanup can't catch:
    a photo uploaded then removed from the form before saving, a replaced image,
    or a booking widget asset that was swapped out. Runs on a schedule and can
    be triggered manually. Best-effort; never raises.

    Returns {"scanned", "referenced", "orphaned", "deleted"}.
    """
    from datetime import datetime, timezone, timedelta
    from sqlmodel import select
    from app.core.db.database import async_session
    from app.rooms.room import RoomType
    from app.brand_console.hotel import Hotel

    try:
        # 1. Every object path still referenced by a room or hotel (photos+videos).
        referenced: set = set()
        async with async_session() as s:
            for model in (RoomType, Hotel):
                rows = (await s.execute(select(model.photos, model.videos))).all()
                for photos, videos in rows:
                    for p in collect_object_paths(photos or []):
                        referenced.add(p)
                    for p in collect_object_paths(videos or []):
                        referenced.add(p)

        # 2. List every object in the public bucket (Supabase pages at 100).
        client = get_supabase()
        bucket = client.storage.from_(PUBLIC_BUCKET)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=grace_hours)
        orphans: List[str] = []
        scanned = 0
        offset = 0
        while True:
            batch = bucket.list("", {"limit": 100, "offset": offset, "sortBy": {"column": "name", "order": "asc"}})
            if not batch:
                break
            for obj in batch:
                name = obj.get("name")
                # Skip folder placeholders / unnamed rows.
                if not name or name == ".emptyFolderPlaceholder":
                    continue
                scanned += 1
                if name not in referenced and _is_older_than(obj.get("created_at"), cutoff):
                    orphans.append(name)
            if len(batch) < 100:
                break
            offset += 100

        # 3. Remove orphans in batches.
        deleted = 0
        for i in range(0, len(orphans), 100):
            chunk = orphans[i:i + 100]
            bucket.remove(chunk)
            deleted += len(chunk)

        result = {"scanned": scanned, "referenced": len(referenced),
                  "orphaned": len(orphans), "deleted": deleted}
        logger.info("Orphan media sweep: %s", result)
        return result
    except Exception as exc:
        logger.warning("Orphan media sweep failed (non-fatal): %s", exc)
        return {"scanned": 0, "referenced": 0, "orphaned": 0, "deleted": 0, "error": str(exc)}

