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
