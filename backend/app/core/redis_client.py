import redis
import os
import json
import time
import asyncio
import fnmatch
import logging
from typing import Optional, Any

from redis.retry import Retry
from redis.backoff import ExponentialBackoff
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError

_logger = logging.getLogger(__name__)

# Railway's private network DNS (`redis.railway.internal`) intermittently fails
# to resolve — "Error -2 ... Name or service not known" — roughly every half
# hour. It is almost always a one-shot blip: the very next resolve succeeds.
# So instead of giving up on the first failure (which dumped the whole worker
# onto memory-only mode), we let redis-py retry the connect/command a few times
# with tiny exponential backoff (~50ms → 500ms, ~0.7s worst case). This absorbs
# the DNS flaps in-place and keeps shared state (rate limits, locks, AI usage)
# on real Redis instead of churning to the local fallback dozens of times a day.
_CONN_RETRY = Retry(ExponentialBackoff(cap=0.5, base=0.05), retries=3)
_RETRY_ON_ERRORS = [RedisConnectionError, RedisTimeoutError]


def _connection_kwargs() -> dict:
    """Shared resilient-connection settings for both REDIS_URL and host/port."""
    return dict(
        decode_responses=True,
        socket_timeout=2,
        socket_connect_timeout=2,
        # Auto-retry transient connect/DNS/timeout errors before surfacing them.
        retry=_CONN_RETRY,
        retry_on_error=_RETRY_ON_ERRORS,
        # Validate idle connections so a silently-dropped socket is replaced
        # rather than handed out and failing the next real command.
        health_check_interval=30,
    )


class RedisClient:
    _instance: Optional[redis.Redis] = None
    # Epoch ts before which we skip Redis and serve from local memory. After a
    # failure we back off for _RETRY_COOLDOWN_SECONDS and then transparently
    # retry, so a worker recovers ON ITS OWN once Redis comes back — no process
    # restart needed. (The old behavior disabled Redis PERMANENTLY on the first
    # failure: a single blip at boot left that worker degraded to per-process
    # memory for life, silently breaking shared rate limits, distributed locks
    # and payment idempotency across workers.)
    _retry_after: float = 0.0
    _RETRY_COOLDOWN_SECONDS: int = 300
    _local_memory_cache = {} # Format: {key: (value, expire_at)}
    _local_nx_locks: dict[str, asyncio.Lock] = {}
    _local_nx_locks_guard: Optional[asyncio.Lock] = None

    @classmethod
    def _cooldown_seconds(cls) -> int:
        """Back-off window (env-driven). Short by default so a deploy-time DNS
        blip doesn't keep a worker on memory-only mode for minutes."""
        try:
            from app.core.config import get_settings
            return max(1, int(get_settings().REDIS_RETRY_COOLDOWN_SECONDS))
        except Exception:
            return cls._RETRY_COOLDOWN_SECONDS

    @classmethod
    def _mark_failed(cls, e: Exception) -> None:
        """Drop the dead connection and back off before the next attempt.

        Called both on connect failure and on a mid-flight operation failure so
        we don't pay the socket timeout on every subsequent call while Redis is
        down — we serve from memory for the cooldown, then retry once.
        """
        cls._instance = None
        cooldown = cls._cooldown_seconds()
        cls._retry_after = time.time() + cooldown
        if "PYTEST_CURRENT_TEST" in os.environ:
            _logger.warning(f"Redis unavailable in test environment. Using Local Memory. Error: {e}")
        else:
            _logger.error(
                f"Redis unavailable; serving from local memory for {cooldown}s "
                f"then retrying. Error: {e}"
            )

    @classmethod
    def get_instance(cls) -> Optional[redis.Redis]:
        # Healthy cached connection — reuse it.
        if cls._instance is not None:
            return cls._instance

        # In the back-off window after a recent failure: stay on memory so we
        # don't hammer a down Redis (and eat 2s timeouts) on every request.
        if time.time() < cls._retry_after:
            return None

        from app.core.config import get_settings
        settings = get_settings()

        try:
            # If REDIS_URL is provided (typical for Railway/Heroku), use it directly
            if settings.REDIS_URL:
                inst = redis.Redis.from_url(settings.REDIS_URL, **_connection_kwargs())
            else:
                # Fallback to discrete parameters
                inst = redis.Redis(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    password=settings.REDIS_PASSWORD,
                    db=0,
                    **_connection_kwargs(),
                )
            # Ping test to verify connection before we trust it. With the retry
            # config above this transparently rides out a transient DNS blip.
            inst.ping()
            cls._instance = inst
            cls._retry_after = 0.0  # recovered — clear the back-off
        except Exception as e:
            cls._mark_failed(e)

        return cls._instance

    @classmethod
    def set_value(cls, key: str, value: str, expire: int = 3600):
        r = cls.get_instance()
        if r:
            try:
                r.setex(key, expire, value)
                return
            except Exception as e:
                cls._mark_failed(e)

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
                cls._mark_failed(e)
        
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
                cls._mark_failed(e)
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
                cls._mark_failed(e)

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
                cls._mark_failed(e)

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
