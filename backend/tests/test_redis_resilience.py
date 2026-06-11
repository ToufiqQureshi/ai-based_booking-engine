"""
Tests for Redis client resilience (self-healing reconnect).

The old client set a permanent `_is_disabled` flag on the first connection
failure, so a single blip at worker boot left that worker degraded to
per-process memory for its entire lifetime — silently breaking shared rate
limits, distributed locks (scheduler) and payment idempotency across workers.

The client now backs off for a cooldown window and then transparently retries,
so a worker recovers on its own once Redis returns. These tests pin that
behavior down.
"""
import time
from types import SimpleNamespace

import pytest

import app.core.redis_client as rc_mod
from app.core.redis_client import RedisClient


@pytest.fixture(autouse=True)
def _reset_client_state():
    """Each test starts from a clean singleton state."""
    RedisClient._instance = None
    RedisClient._retry_after = 0.0
    RedisClient._local_memory_cache = {}
    yield
    RedisClient._instance = None
    RedisClient._retry_after = 0.0
    RedisClient._local_memory_cache = {}


class _FakeRedis:
    """Minimal stand-in that can be told to start failing."""
    def __init__(self):
        self.alive = True
        self.store = {}

    def ping(self):
        if not self.alive:
            raise ConnectionError("redis down")
        return True

    def setex(self, key, expire, value):
        if not self.alive:
            raise ConnectionError("redis down")
        self.store[key] = value

    def get(self, key):
        if not self.alive:
            raise ConnectionError("redis down")
        return self.store.get(key)


def _patch_connect(monkeypatch, factory):
    """Make get_instance build its client from `factory()` (no real network)."""
    fake_module = SimpleNamespace(
        Redis=SimpleNamespace(from_url=lambda *a, **k: factory()),
    )
    # REDIS_URL set -> from_url path is used
    monkeypatch.setattr(rc_mod, "redis", fake_module)
    monkeypatch.setattr(
        rc_mod, "get_settings", lambda: SimpleNamespace(REDIS_URL="redis://x"), raising=False
    )
    # get_settings is imported inside the function; patch at its source too.
    import app.core.config as cfg
    monkeypatch.setattr(cfg, "get_settings", lambda: SimpleNamespace(REDIS_URL="redis://x"))


def test_connect_failure_sets_cooldown_not_permanent(monkeypatch):
    # Connection always fails.
    def boom():
        raise ConnectionError("cannot connect")

    _patch_connect(monkeypatch, boom)

    assert RedisClient.get_instance() is None
    # Back-off armed into the future, but NOT permanent.
    assert RedisClient._retry_after > time.time()


def test_skips_redis_during_cooldown(monkeypatch):
    calls = {"n": 0}

    def boom():
        calls["n"] += 1
        raise ConnectionError("cannot connect")

    _patch_connect(monkeypatch, boom)

    assert RedisClient.get_instance() is None
    assert calls["n"] == 1
    # Second call within the cooldown must NOT attempt another connection.
    assert RedisClient.get_instance() is None
    assert calls["n"] == 1, "should not retry Redis during the back-off window"


def test_retries_and_recovers_after_cooldown(monkeypatch):
    fake = _FakeRedis()
    fake.alive = False  # first attempt fails

    _patch_connect(monkeypatch, lambda: fake)

    assert RedisClient.get_instance() is None
    assert RedisClient._retry_after > time.time()

    # Simulate cooldown elapsing and Redis coming back.
    RedisClient._retry_after = time.time() - 1
    fake.alive = True

    inst = RedisClient.get_instance()
    assert inst is fake, "worker should reconnect on its own after the cooldown"
    assert RedisClient._retry_after == 0.0, "back-off cleared on recovery"


def test_midflight_failure_falls_back_and_arms_cooldown(monkeypatch):
    fake = _FakeRedis()
    _patch_connect(monkeypatch, lambda: fake)

    # Healthy: value lands in Redis.
    RedisClient.set_value("k", "v1", expire=60)
    assert RedisClient.get_instance() is fake

    # Redis dies mid-traffic.
    fake.alive = False
    RedisClient.set_value("k", "v2", expire=60)  # should not raise

    # Connection dropped + cooldown armed; value preserved in memory fallback.
    assert RedisClient._instance is None
    assert RedisClient._retry_after > time.time()
    assert RedisClient.get_value("k") == "v2"
