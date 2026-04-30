import redis
import os
from typing import Optional

class RedisClient:
    _instance: Optional[redis.Redis] = None
    _is_disabled: bool = False

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
                print(f"Redis Connection Failed. Disabling Redis for this worker. Error: {e}")
                cls._instance = None
                cls._is_disabled = True
                
        return cls._instance

    @classmethod
    def set_value(cls, key: str, value: str, expire: int = 3600):
        r = cls.get_instance()
        if r:
            r.setex(key, expire, value)

    @classmethod
    def get_value(cls, key: str) -> Optional[str]:
        r = cls.get_instance()
        if r:
            return r.get(key)
        return None

# Global accessor
redis_client = RedisClient
