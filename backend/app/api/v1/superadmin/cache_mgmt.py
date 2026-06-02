"""
Super Admin — Cache management and Redis stats.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import DbSession
from app.core.redis_client import redis_client
from app.models.hotel import Hotel
from app.models.user import User
from .hotels import get_super_admin

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/cache/stats")
async def cache_stats(super_admin: User = Depends(get_super_admin)):
    """Redis cache statistics."""
    r = redis_client.get_instance()
    if not r:
        return {
            "redis_connected": False,
            "mode": "in-memory fallback",
            "local_keys": len(redis_client._local_memory_cache),
        }
    try:
        info = r.info("memory")
        keyspace = r.info("keyspace")
        server = r.info("server")
        db0 = keyspace.get("db0", {})
        return {
            "redis_connected": True,
            "mode": "redis",
            "redis_version": server.get("redis_version"),
            "used_memory_human": info.get("used_memory_human"),
            "used_memory_peak_human": info.get("used_memory_peak_human"),
            "total_keys": db0.get("keys", 0),
            "expires": db0.get("expires", 0),
            "uptime_seconds": server.get("uptime_in_seconds"),
        }
    except Exception as e:
        logger.error("Redis stats failed: %s", e)
        return {"redis_connected": False, "error": str(e)}


@router.get("/cache/keys")
async def list_cache_keys(
    pattern: str = "*",
    super_admin: User = Depends(get_super_admin),
):
    """List cache keys matching a pattern (max 200)."""
    r = redis_client.get_instance()
    if not r:
        local_keys = list(redis_client._local_memory_cache.keys())
        return {"keys": local_keys[:200], "total": len(local_keys), "mode": "in-memory"}
    try:
        keys = r.keys(pattern)[:200]
        return {"keys": keys, "total": len(keys), "mode": "redis"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cache/hotel/{hotel_id}")
async def clear_hotel_cache(
    hotel_id: str,
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Clear all cache entries for a specific hotel."""
    hotel = await session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    patterns = [
        f"dashboard_stats:{hotel_id}*",
        f"dashboard_recent_bookings:{hotel_id}*",
        f"rooms:{hotel_id}:*",
        f"room:{hotel_id}:*",
        f"availability:{hotel_id}*",
        f"bookings:{hotel_id}:*",
        f"analytics_dashboard:{hotel_id}:*",
        f"reports_dashboard:{hotel_id}:*",
        f"reports_occupancy:{hotel_id}:*",
        f"integration:{hotel_id}:*",
        f"public:hotel-details:{hotel_id}",
        f"public:widget-config:{hotel_id}",
        f"public:slug-to-id:{hotel.slug}",
        f"public:rooms:{hotel_id}:*",
        f"public:social-proof:{hotel.slug}",
    ]
    cleared = 0
    for p in patterns:
        try:
            redis_client.delete_pattern(p)
            cleared += 1
        except Exception:
            pass

    return {
        "status": "success",
        "hotel_id": hotel_id,
        "hotel_name": hotel.name,
        "patterns_cleared": cleared,
    }


@router.delete("/cache/all")
async def flush_all_cache(super_admin: User = Depends(get_super_admin)):
    """Flush the entire Redis cache. USE WITH CAUTION."""
    r = redis_client.get_instance()
    if not r:
        redis_client._local_memory_cache.clear()
        return {"status": "success", "mode": "in-memory", "keys_cleared": "all"}
    try:
        r.flushdb()
        return {"status": "success", "mode": "redis", "message": "All keys flushed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
