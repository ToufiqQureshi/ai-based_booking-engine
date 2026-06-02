import asyncio
from app.core.redis_client import redis_client

async def clear_cache():
    try:
        # Get instance and clear all keys with prefix dashboard_stats and dashboard_recent_bookings
        r = redis_client.get_instance()
        for key in r.scan_iter("dashboard_*"):
            r.delete(key)
            print(f"Deleted cache key: {key}")
        print("Cache cleared successfully.")
    except Exception as e:
        print(f"Error clearing cache: {e}")

asyncio.run(clear_cache())
