"""
Durable AI-usage accounting tests (AI-10).

Redis flaps on production deploys, so Postgres (SQLite in tests) is the
source of truth for the hotelier usage dashboard. These tests verify the
dual-write path: per-day aggregates, message counts, exact unique-user
counting, and PII hashing.
"""
import pytest

from app.core import ai_usage
from app.brand_console.models import Hotel

pytestmark = pytest.mark.asyncio


class _FakeResult:
    def __init__(self, total_tokens):
        self.metrics = {"total_tokens": total_tokens}


async def test_persist_and_read_roundtrip(seeded_hotel: Hotel):
    hotel_id = seeded_hotel.id

    # Same guest twice + one new guest on the whatsapp agent.
    await ai_usage.persist_ai_usage_db(hotel_id, _FakeResult(300), agent_type="whatsapp", user_identifier="+919999")
    await ai_usage.persist_ai_usage_db(hotel_id, _FakeResult(200), agent_type="whatsapp", user_identifier="+919999")
    await ai_usage.persist_ai_usage_db(hotel_id, _FakeResult(100), agent_type="whatsapp", user_identifier="+918888")

    usage = await ai_usage.read_ai_usage_db(hotel_id, days=7)
    wa = usage["whatsapp"]
    assert wa["messages_today"] == 3
    assert wa["unique_users_today"] == 2  # exact, not estimated
    assert sum(wa["daily_tokens"].values()) == 600

    # Other agents untouched.
    assert usage["guest"]["messages_today"] == 0
    assert usage["hotelier"]["messages_today"] == 0


async def test_persist_without_identifier_counts_messages_only(seeded_hotel: Hotel):
    hotel_id = seeded_hotel.id
    before = await ai_usage.read_ai_usage_db(hotel_id, days=1)

    await ai_usage.persist_ai_usage_db(hotel_id, _FakeResult(50), agent_type="guest", user_identifier=None)

    after = await ai_usage.read_ai_usage_db(hotel_id, days=1)
    assert after["guest"]["messages_today"] == before["guest"]["messages_today"] + 1
    assert after["guest"]["unique_users_today"] == before["guest"]["unique_users_today"]


async def test_participant_rows_store_hash_not_pii(seeded_hotel: Hotel):
    from sqlmodel import select
    from app.core.database import async_session
    from app.ai_assistant.models import AIUsageParticipant

    hotel_id = seeded_hotel.id
    await ai_usage.persist_ai_usage_db(hotel_id, _FakeResult(10), agent_type="guest", user_identifier="pii@example.com")

    async with async_session() as s:
        rows = (await s.execute(
            select(AIUsageParticipant).where(AIUsageParticipant.hotel_id == hotel_id)
        )).scalars().all()

    hashes = {r.user_hash for r in rows}
    assert "pii@example.com" not in hashes
    assert ai_usage._hash_id("pii@example.com") in hashes


async def test_persist_never_raises_on_bad_input():
    # Bad hotel_id / broken result must not raise — telemetry is best-effort.
    await ai_usage.persist_ai_usage_db("", _FakeResult(10), agent_type="guest")
    await ai_usage.persist_ai_usage_db(None, object(), agent_type="guest")
