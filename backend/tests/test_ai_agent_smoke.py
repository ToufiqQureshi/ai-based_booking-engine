"""
Regression guard for the hotelier AI assistant.

Background: `app/core/agent.py` referenced a module-level `logger` (in the smart
tool selector and the integration-settings fetch) that was never defined, so any
non-empty hotelier query raised `NameError: name 'logger' is not defined` and the
assistant 500'd on *every* message. These tests pin that the logger exists and
that the tool-selection code path runs cleanly (it should fail only on the
expected missing-API-key `ValueError`, never on a `NameError`).
"""
import logging

import pytest
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.db.database import engine
from app.ai_engine.agent import create_agent_executor, logger as agent_logger
from app.guests.user import User


def test_agent_module_has_logger():
    """The module-level logger must exist (its absence broke every call)."""
    assert isinstance(agent_logger, logging.Logger)
    assert agent_logger.name == "app.ai_engine.agent"


@pytest.mark.asyncio
async def test_create_agent_executor_runs_tool_selector_without_nameerror(seeded_user: User):
    """
    A non-empty query exercises the smart tool selector (which logs). The original
    bug raised `NameError` on that exact path. We assert only that NameError never
    occurs — whether the call then succeeds (key present) or raises a well-defined
    config error (key absent) is environment-dependent and equally acceptable.
    """
    async with AsyncSession(engine) as session:
        res = await session.execute(
            select(User).where(User.id == seeded_user.id).options(selectinload(User.hotel))
        )
        user = res.scalar_one()

        try:
            await create_agent_executor(session, user, user_query="show me revenue trend")
        except NameError as exc:  # the exact regression we are guarding against
            pytest.fail(f"create_agent_executor raised NameError (logger regression): {exc}")
        except Exception:
            # ValueError (missing key) or any other well-defined failure is fine —
            # the point is the logger code path executed cleanly.
            pass


def _collect_member_tools(team):
    """Map every tool name → requires_confirmation across all team members."""
    flags = {}
    for member in getattr(team, "members", []) or []:
        for f in (getattr(member, "tools", None) or []):
            name = getattr(f, "name", None) or getattr(f, "__name__", "")
            flags[name] = getattr(f, "requires_confirmation", False)
    return flags


@pytest.mark.asyncio
async def test_cancel_booking_always_registered_and_confirmation_gated(seeded_user: User, monkeypatch):
    """Regression STAYBOOKERAI-3G: 'Function cancel_booking not found'.

    cancel_booking used to be registered only when the query contained the word
    'cancel'/'void'. A query without that exact word (e.g. the typo 'cancle', or a
    resume) dropped the tool from the toolset — so when the model still called it,
    agno raised 'Function cancel_booking not found' and the run failed. The tool
    must ALWAYS be registered, and must stay behind the requires_confirmation gate.
    """
    from app.core.utils.config import get_settings
    # Dummy key so the executor builds the full Team (OpenAILike construction is
    # offline). Set on the cached settings instance.
    monkeypatch.setattr(get_settings(), "GROQ_API_KEY", "gsk_dummy_key_for_construction_only")

    async with AsyncSession(engine) as session:
        res = await session.execute(
            select(User).where(User.id == seeded_user.id).options(selectinload(User.hotel))
        )
        user = res.scalar_one()

        # A query that does NOT contain 'cancel'/'void' — this is exactly what the
        # old keyword gate removed the tool for.
        team = await create_agent_executor(session, user, user_query="show me my bookings please")

    flags = _collect_member_tools(team)
    assert "cancel_booking" in flags, "cancel_booking must always be registered on the Booking Agent"
    assert flags["cancel_booking"] is True, "cancel_booking must stay behind requires_confirmation"
    # Other destructive tools stay confirmation-gated too.
    for t in ("update_room_price", "create_promo_code", "block_room_dates"):
        assert flags.get(t) is True, f"{t} must be confirmation-gated"
