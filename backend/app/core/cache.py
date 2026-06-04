import functools
import json
import logging
from typing import Any, Callable, Optional
from fastapi import Request, Response
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)

def cache_response(
    expire: int = 300,
    key_prefix: str = "cache",
    include_user: bool = True
):
    """
    A decorator for FastAPI endpoints to cache responses in Redis.

    Args:
        expire: Cache expiration time in seconds (default 5 minutes).
        key_prefix: Prefix for the cache key.
        include_user: If True, appends the user's hotel_id to the cache key to prevent cross-tenant data leakage.
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # 1. Build the Cache Key
            request: Optional[Request] = kwargs.get("request") or next((arg for arg in args if isinstance(arg, Request)), None)

            # Identify the tenant (hotel_id) if required
            tenant_id = ""
            if include_user:
                current_user = kwargs.get("current_user")
                if current_user and hasattr(current_user, "hotel_id"):
                    tenant_id = f":{current_user.hotel_id}"
                else:
                    # If we can't find the user but need it, skip cache (safety first)
                    return await func(*args, **kwargs)

            # Combine path + sorted query params → consistent cache key regardless of param order
            path = request.url.path if request else func.__name__
            if request and request.url.query:
                params = sorted(request.url.query.split("&"))
                query = "&".join(params)
            else:
                query = ""

            cache_key = f"{key_prefix}{tenant_id}:{path}:{query}"

            # 2. Try to get from Cache
            try:
                cached_data = redis_client.get_value(cache_key)
                if cached_data:
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"Cache read failed for {cache_key}: {e}")

            # 3. Execute the actual function
            response_data = await func(*args, **kwargs)

            # 4. Save to Cache
            try:
                # If the response is a Pydantic model or list of models, dump them
                if isinstance(response_data, list):
                    serializable_data = [item.model_dump(mode='json') if hasattr(item, 'model_dump') else item for item in response_data]
                elif hasattr(response_data, 'model_dump'):
                    serializable_data = response_data.model_dump(mode='json')
                else:
                    serializable_data = response_data

                redis_client.set_value(cache_key, json.dumps(serializable_data), expire=expire)
            except Exception as e:
                logger.warning(f"Cache write failed for {cache_key}: {e}")

            return response_data

        return wrapper
    return decorator

def invalidate_cache(pattern: str):
    """
    Utility to invalidate cache by pattern.
    Example: invalidate_cache("cache:tenant_id:/*")
    """
    try:
        redis_client.delete_pattern(pattern)
    except Exception as e:
        logger.warning(f"Cache invalidation failed for pattern {pattern}: {e}")
