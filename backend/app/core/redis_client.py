import redis
import os
import json
import time
import fnmatch
from typing import Optional, Any

class RedisClient:
    _instance: Optional[redis.Redis] = None
    _is_disabled: bool = False
    _local_memory_cache = {} # Format: {key: (value, expire_at)}

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
                        socket_timeout=1
                    )
                else:
                    # Fallback to discrete parameters
                    cls._instance = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        password=settings.REDIS_PASSWORD,
                        db=0,
                        decode_responses=True,
                        socket_timeout=1,
                        socket_connect_timeout=1
                    )
                # Ping test to verify connection
                cls._instance.ping()
            except Exception as e:
                print(f"Redis Connection Failed. Disabling Redis for this worker. Using Local Memory. Error: {e}")
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
                print(f"Redis set failed, falling back to local memory: {e}")
        
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
                print(f"Redis get failed, falling back to local memory: {e}")
        
        # Memory Fallback
        if key in cls._local_memory_cache:
            val, expire_at = cls._local_memory_cache[key]
            if time.time() < expire_at:
                return val
            else:
                del cls._local_memory_cache[key]
        return None

    @classmethod
    def delete_value(cls, key: str):
        r = cls.get_instance()
        if r:
            try:
                r.delete(key)
            except Exception as e:
                print(f"Redis delete failed: {e}")
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
                print(f"Redis delete pattern failed: {e}")
        
        # Local Memory Pattern Delete
        keys_to_del = [k for k in cls._local_memory_cache.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_del:
            try:
                del cls._local_memory_cache[k]
            except KeyError:
                pass

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
