"""
Tests for the in-process AI quota fallback (AI-08).

When Redis is unavailable the per-agent daily cost cap must NOT silently fail
open. The in-process fallback in ai_usage.py enforces a conservative per-process
floor instead, keyed by agent_type + hotel_id.
"""
import pytest
from fastapi import HTTPException

import app.ai_engine.ai_usage as ai_usage


def _reset_fallback():
    ai_usage._fb_day = None
    ai_usage._fb_counts.clear()


def test_inprocess_fallback_enforces_cap(monkeypatch):
    _reset_fallback()
    # Override token estimate so per_process_cap = max(5, limit // 10)
    # With limit=60: cap = max(5, 6) = 6
    monkeypatch.setattr(ai_usage, "_APPROX_TOKENS_PER_REQ", 1)
    day = "20260610"
    limit = 60  # per_process_cap = max(5, 60 // 10) = 6

    for _ in range(6):
        ai_usage._enforce_inprocess_fallback("guest", "hotel-A", day, limit)

    with pytest.raises(HTTPException) as exc:
        ai_usage._enforce_inprocess_fallback("guest", "hotel-A", day, limit)
    assert exc.value.status_code == 429


def test_inprocess_fallback_is_per_hotel(monkeypatch):
    _reset_fallback()
    monkeypatch.setattr(ai_usage, "_APPROX_TOKENS_PER_REQ", 1)
    day = "20260610"
    limit = 50  # per_process_cap = max(5, 5) = 5

    for _ in range(5):
        ai_usage._enforce_inprocess_fallback("guest", "hotel-A", day, limit)
    # Different hotel has its own independent counter — must not raise.
    ai_usage._enforce_inprocess_fallback("guest", "hotel-B", day, limit)


def test_inprocess_fallback_resets_on_new_day(monkeypatch):
    _reset_fallback()
    monkeypatch.setattr(ai_usage, "_APPROX_TOKENS_PER_REQ", 1)
    limit = 50  # per_process_cap = 5

    for _ in range(5):
        ai_usage._enforce_inprocess_fallback("guest", "hotel-A", "20260610", limit)
    with pytest.raises(HTTPException):
        ai_usage._enforce_inprocess_fallback("guest", "hotel-A", "20260610", limit)

    # New day -> counter resets, must not raise.
    ai_usage._enforce_inprocess_fallback("guest", "hotel-A", "20260611", limit)


def test_inprocess_fallback_is_per_agent_type(monkeypatch):
    _reset_fallback()
    monkeypatch.setattr(ai_usage, "_APPROX_TOKENS_PER_REQ", 1)
    day = "20260610"
    limit = 50  # per_process_cap = 5

    for _ in range(5):
        ai_usage._enforce_inprocess_fallback("guest", "hotel-A", day, limit)
    # Same hotel but different agent type has its own counter — must not raise.
    ai_usage._enforce_inprocess_fallback("whatsapp", "hotel-A", day, limit)


# ─── Real message / unique-user accounting (AI-09) ──────────────────────────────

class _FakePipeline:
    """Minimal Redis pipeline that applies ops on execute()."""
    def __init__(self, store, sets):
        self._store, self._sets, self._ops = store, sets, []

    def incr(self, key):
        self._ops.append(("incr", key)); return self

    def incrby(self, key, amount):
        self._ops.append(("incrby", key, amount)); return self

    def sadd(self, key, member):
        self._ops.append(("sadd", key, member)); return self

    def expire(self, key, ttl):
        return self  # TTL is a no-op in the fake

    def execute(self):
        for op in self._ops:
            if op[0] == "incr":
                self._store[op[1]] = self._store.get(op[1], 0) + 1
            elif op[0] == "incrby":
                self._store[op[1]] = self._store.get(op[1], 0) + op[2]
            elif op[0] == "sadd":
                self._sets.setdefault(op[1], set()).add(op[2])
        self._ops.clear()


class _FakeRedis:
    def __init__(self):
        self.store, self.sets = {}, {}

    def pipeline(self):
        return _FakePipeline(self.store, self.sets)

    def get(self, key):
        v = self.store.get(key)
        return str(v) if v is not None else None

    def scard(self, key):
        return len(self.sets.get(key, set()))


class _FakeResult:
    def __init__(self, total_tokens):
        self.metrics = {"total_tokens": total_tokens}


def test_record_ai_usage_tracks_messages_and_unique_users(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(ai_usage.redis_client, "get_instance", lambda: fake)
    monkeypatch.setattr(ai_usage, "utcnow", lambda: __import__("datetime").datetime(2026, 6, 11))

    day = "20260611"
    # Two messages from the same guest "+91999" -> 2 messages, 1 unique user.
    ai_usage.record_ai_usage("hotel-X", _FakeResult(300), agent_type="whatsapp", user_identifier="+91999")
    ai_usage.record_ai_usage("hotel-X", _FakeResult(200), agent_type="whatsapp", user_identifier="+91999")
    # A different guest -> unique users becomes 2.
    ai_usage.record_ai_usage("hotel-X", _FakeResult(100), agent_type="whatsapp", user_identifier="+91888")

    assert fake.store[f"ai_runs:whatsapp:hotel-X:{day}"] == 3
    assert fake.store[f"ai_tokens:whatsapp:hotel-X:{day}"] == 600
    assert fake.scard(f"ai_users:whatsapp:hotel-X:{day}") == 2


def test_record_ai_usage_hashes_identifier(monkeypatch):
    """Raw PII (phone/email) must never be stored — only its hash."""
    fake = _FakeRedis()
    monkeypatch.setattr(ai_usage.redis_client, "get_instance", lambda: fake)
    monkeypatch.setattr(ai_usage, "utcnow", lambda: __import__("datetime").datetime(2026, 6, 11))

    ai_usage.record_ai_usage("hotel-X", _FakeResult(50), agent_type="guest", user_identifier="guest@example.com")
    members = fake.sets[f"ai_users:guest:hotel-X:20260611"]
    assert "guest@example.com" not in members
    assert ai_usage._hash_id("guest@example.com") in members
