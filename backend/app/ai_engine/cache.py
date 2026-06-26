import json
import logging
import asyncio
from functools import wraps
from typing import Callable, Any

from app.core.cache.redis_client import redis_client

logger = logging.getLogger(__name__)

def cached_tool(ttl: int = 300):
    """
    A robust caching decorator for AI tools.
    Uses the existing RedisClient which has an in-memory fallback.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a deterministic cache key based on the function name and arguments
            try:
                # We stringify args and kwargs. Since SQLAlchemy objects (like session)
                # might be in the closure, they aren't in args.
                # This works well for tools where parameters are strings/ints.
                key_args = [str(a) for a in args]
                key_kwargs = [f"{k}={v}" for k, v in kwargs.items()]
                
                # Combine them
                key_str = f"tool:{func.__name__}:{'-'.join(key_args)}:{'-'.join(key_kwargs)}"
                
                # Hash it to keep it clean
                import hashlib
                key_hash = hashlib.md5(key_str.encode()).hexdigest()
                cache_key = f"agno:cache:{func.__name__}:{key_hash}"
                
                cached_val = redis_client.get_value(cache_key)
                if cached_val:
                    logger.info(f"Tool Cache HIT: {func.__name__}")
                    return cached_val
            except Exception as e:
                logger.warning(f"Failed to generate cache key or read cache for {func.__name__}: {e}")
                cache_key = None
            
            logger.info(f"Tool Cache MISS: {func.__name__}")
            result = await func(*args, **kwargs)
            
            if cache_key and isinstance(result, str):
                # We only cache strings (which all our tools currently return)
                try:
                    redis_client.set_value(cache_key, result, expire=ttl)
                except Exception as e:
                    logger.warning(f"Failed to set cache for {func.__name__}: {e}")
                    
            return result
        return wrapper
    return decorator
