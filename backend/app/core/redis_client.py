import redis
import os
from typing import Optional

class RedisClient:
    _instance: Optional[redis.Redis] = None

    @classmethod
    def get_instance(cls) -> redis.Redis:
        if cls._instance is None:
            cls._instance = redis.Redis(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", 6379)),
                password=os.getenv("REDIS_PASSWORD", None),
                db=0,
                decode_responses=True,
                socket_timeout=1,
                socket_connect_timeout=1
            )
        return cls._instance

    @classmethod
    def set_value(cls, key: str, value: str, expire: int = 3600):
        r = cls.get_instance()
        r.setex(key, expire, value)

    @classmethod
    def get_value(cls, key: str) -> Optional[str]:
        r = cls.get_instance()
        return r.get(key)

# Global accessor
redis_client = RedisClient
