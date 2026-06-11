"""
Tests for the in-process AI-chat quota fallback (AI-08).

When Redis is unavailable the per-hotel daily cost cap must NOT silently fail
open. The in-process fallback enforces a conservative per-process floor instead.
"""
import pytest
from fastapi import HTTPException

import app.api.v1.public.chat as chat


def _reset_fallback():
    chat._fallback_day = None
    chat._fallback_counts.clear()


def test_inprocess_fallback_enforces_cap(monkeypatch):
    _reset_fallback()
    monkeypatch.setattr(chat, "AI_CHAT_DAILY_CAP_PER_HOTEL", 3)
    day = "20260610"

    # Up to the cap: no error.
    for _ in range(3):
        chat._enforce_inprocess_ai_quota("hotel-A", day)

    # Over the cap: 429.
    with pytest.raises(HTTPException) as exc:
        chat._enforce_inprocess_ai_quota("hotel-A", day)
    assert exc.value.status_code == 429


def test_inprocess_fallback_is_per_hotel(monkeypatch):
    _reset_fallback()
    monkeypatch.setattr(chat, "AI_CHAT_DAILY_CAP_PER_HOTEL", 2)
    day = "20260610"

    chat._enforce_inprocess_ai_quota("hotel-A", day)
    chat._enforce_inprocess_ai_quota("hotel-A", day)
    # A different hotel has its own independent counter.
    chat._enforce_inprocess_ai_quota("hotel-B", day)  # must not raise


def test_inprocess_fallback_resets_on_new_day(monkeypatch):
    _reset_fallback()
    monkeypatch.setattr(chat, "AI_CHAT_DAILY_CAP_PER_HOTEL", 1)

    chat._enforce_inprocess_ai_quota("hotel-A", "20260610")
    # New day -> counter resets, so this is allowed again.
    chat._enforce_inprocess_ai_quota("hotel-A", "20260611")
