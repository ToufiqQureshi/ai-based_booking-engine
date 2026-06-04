import redis
import os
import json
import time
import asyncio
import fnmatch
import logging
from typing import Optional, Any

_logger = logging.getLogger(__name__)

class RedisClient:
    _instance: Optional[redis.Redis] = None
    _is_disabled: bool = False
    _local_memory_cache = {} # Format: {key: (value, expire_at)}
    _local_nx_locks: dict[str, asyncio.Lock] = {}
    _local_nx_locks_guard: Optional[asyncio.Lock] = None

    @classmethod
    def get_instance(cls) -> Optional[redis.Redis]:
        if cls._is_disabled:
            return None
            
        if cls._instance is None:
            from app.core.config import get_settings
            settings = get_settings()
            
            try:
                # If REDIS_URL is provided (typical for Railway/Heroku), use it directly
                if settings.REDIS_URL:
                    cls._instance = redis.Redis.from_url(
                        settings.REDIS_URL,
                        decode_responses=True,
                        socket_timeout=2,
                        socket_connect_timeout=2,
                        retry_on_timeout=True
                    )
                else:
                    # Fallback to discrete parameters
                    cls._instance = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        password=settings.REDIS_PASSWORD,
                        db=0,
                        decode_responses=True,
                        socket_timeout=2,
                        socket_connect_timeout=2,
                        retry_on_timeout=True
                    )
                # Ping test to verify connection
                cls._instance.ping()
            except Exception as e:
                if "PYTEST_CURRENT_TEST" in os.environ:
                    _logger.warning(f"Redis Connection Failed in test environment. Using Local Memory. Error: {e}")
                else:
                    _logger.error(f"Redis Connection Failed. Disabling Redis for this worker. Using Local Memory. Error: {e}")
                cls._instance = None
                cls._is_disabled = True
                
        return cls._instance

    @classmethod
    def set_value(cls, key: str, value: str, expire: int = 3600):
        r = cls.get_instance()
        if r:
            try:
                r.setex(key, expire, value)
                return
            except Exception as e:
                _logger.warning(f"Redis set failed, using local memory: {e}")
        
        # Memory Fallback
        cls._local_memory_cache[key] = (value, time.time() + expire)

    @classmethod
    def get_value(cls, key: str) -> Optional[str]:
        # First clean expired items from local memory cache to avoid memory leak
        cls._clean_local_memory()
        
        r = cls.get_instance()
        if r:
            try:
                val = r.get(key)
                if val is not None:
                    # If redis returns a bytes string (depending on config/mode), decode it
                    if isinstance(val, bytes):
                        return val.decode('utf-8')
                    return val
            except Exception as e:
                _logger.warning(f"Redis get failed, using local memory: {e}")
        
        # Memory Fallback
        if key in cls._local_memory_cache:
            val, expire_at = cls._local_memory_cache[key]
            if time.time() < expire_at:
                return val
            else:
                del cls._local_memory_cache[key]
        return None

    @classmethod
    def delete_key(cls, key: str):
        """Utility to delete a specific key"""
        cls.delete_value(key)

    @classmethod
    def delete_value(cls, key: str):
        r = cls.get_instance()
        if r:
            try:
                r.delete(key)
            except Exception as e:
                _logger.warning(f"Redis delete failed for key {key}: {e}")
        if key in cls._local_memory_cache:
            try:
                del cls._local_memory_cache[key]
            except KeyError:
                pass

    @classmethod
    def delete_pattern(cls, pattern: str):
        r = cls.get_instance()
        if r:
            try:
                # Convert glob pattern to Redis pattern
                # In Redis, availability:* is fine. For local fnmatch it's also fine.
                keys = r.keys(pattern)
                if keys:
                    r.delete(*keys)
            except Exception as e:
                _logger.error(f"Redis delete pattern failed: {e}")

        # Local Memory Pattern Delete
        keys_to_del = [k for k in cls._local_memory_cache.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_del:
            try:
                del cls._local_memory_cache[k]
            except KeyError:
                pass

    @classmethod
    def _get_local_nx_lock(cls, key: str) -> asyncio.Lock:
        """Return a per-key asyncio.Lock for serializing SET-NX in the in-memory fallback.

        We need this because Python's GIL does NOT make dict reads/writes atomic across
        coroutines when they await between get + set. A shared global lock would
        serialize all NX calls, so we use one lock per key instead.
        """
        if cls._local_nx_locks_guard is None:
            cls._local_nx_locks_guard = asyncio.Lock()
        # NOTE: get_instance_of_event_loop matters — locks are tied to a running loop.
        # We lazily create per-key locks inside the caller's coroutine to avoid
        # "attached to a different loop" errors.
        return cls._local_nx_locks.setdefault(key, asyncio.Lock())

    @classmethod
    async def set_nx_ex(cls, key: str, value: str, expire: int = 60) -> bool:
        """Atomic SET NX EX. Returns True if the key was set, False if it already existed.

        This is the only safe primitive for distributed locks / idempotency keys.
        Using the old get-then-set pattern races: two concurrent requests can both
        read "no key", both write, and both proceed — which is the bug we are fixing
        in the payment endpoints.
        """
        r = cls.get_instance()
        if r:
            try:
                # redis-py exposes set with nx + ex flags; returns True/None.
                result = r.set(key, value, nx=True, ex=expire)
                return bool(result)
            except Exception as e:
                _logger.warning(f"Redis SET NX EX failed, using local memory: {e}")

        # In-memory fallback: use a per-key asyncio.Lock to make the check-then-set
        # atomic across coroutines on this worker. Across workers / instances, the
        # caller must understand that in-memory mode is not distributed — which is
        # already the case for the rest of the cache.
        lock = cls._get_local_nx_lock(key)
        async with lock:
            existing = cls._local_memory_cache.get(key)
            if existing is not None:
                _, expire_at = existing
                if time.time() < expire_at:
                    return False
            cls._local_memory_cache[key] = (value, time.time() + expire)
            return True

    @classmethod
    def _clean_local_memory(cls):
        now = time.time()
        expired = [k for k, v in cls._local_memory_cache.items() if now > v[1]]
        for k in expired:
            try:
                del cls._local_memory_cache[k]
            except KeyError:
                pass

# Global accessor
redis_client = RedisClient
