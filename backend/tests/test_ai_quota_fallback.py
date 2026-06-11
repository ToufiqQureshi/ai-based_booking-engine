"""
Tests for the in-process AI quota fallback (AI-08).

When Redis is unavailable the per-agent daily cost cap must NOT silently fail
open. The in-process fallback in ai_usage.py enforces a conservative per-process
floor instead, keyed by agent_type + hotel_id.
"""
import pytest
from fastapi import HTTPException

import app.core.ai_usage as ai_usage


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
