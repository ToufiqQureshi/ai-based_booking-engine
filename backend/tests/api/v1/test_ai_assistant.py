"""
AI Agent Endpoint Tests
Covers:
  - GET    /agent/usage           — auth guard + shape
  - POST   /agent/chat            — auth guard (unauthenticated rejected)
  - GET    /agent/sessions        — chat history list (shape, auth)
  - GET    /agent/sessions/{id}   — chat history view + IDOR guard
  - DELETE /agent/sessions/{id}   — delete + IDOR guard (regression: STAYBOOKERAI-3C)
  - PATCH  /agent/sessions/{id}/rename — IDOR guard
  - logic_cancel_booking          — destructive-cancel safety (regression: AI cancelled pending bookings)
"""
import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


# ─── Fake agno session store ─────────────────────────────────────────────────
# The session endpoints talk to agno's AsyncPostgresDb, which can't run on the
# in-memory SQLite test DB. We stub ONLY that external store (like conftest stubs
# auth) and let the real endpoint code run — so the ownership delegation, the
# delete return-value handling, and the run→message mapping are all exercised.
# The fake mirrors agno's real `user_id` SQL filter semantics, which the fixes rely on.

class _FakeRunInput:
    def __init__(self, text):
        self.input_content = text


class _FakeRun:
    def __init__(self, user_text, ai_text):
        self.input = _FakeRunInput(user_text)
        self.content = ai_text


class _FakeSession:
    def __init__(self, session_id, user_id, name="Chat", runs=None):
        self.session_id = session_id
        self.user_id = user_id
        self.session_data = {"session_name": name}
        self.created_at = 1_700_000_000
        self.runs = runs or []


class _FakeAgnoDb:
    def __init__(self, sessions):
        self._sessions = {s.session_id: s for s in sessions}

    async def get_sessions(self, user_id=None, session_type=None, limit=50):
        return [s for s in self._sessions.values()
                if user_id is None or s.user_id == user_id][:limit]

    async def get_session(self, session_id, session_type=None, user_id=None):
        s = self._sessions.get(session_id)
        if s is None or (user_id is not None and s.user_id != user_id):
            return None
        return s

    async def delete_session(self, session_id, user_id=None):
        s = self._sessions.get(session_id)
        if s is None or (user_id is not None and s.user_id != user_id):
            return False
        del self._sessions[session_id]
        return True

    async def rename_session(self, session_id, session_type=None, session_name=None, user_id=None):
        s = self._sessions.get(session_id)
        if s is None or (user_id is not None and s.user_id != user_id):
            return None
        s.session_data["session_name"] = session_name
        return s


_OWNER_ID = "owner-user-aaaa"
_OTHER_ID = "other-user-bbbb"


@pytest_asyncio.fixture
async def sessions_client(monkeypatch):
    """Authenticated client for the chat-session endpoints.

    Overrides auth with an OWNER whose hotel has feature_ai_agent enabled (so
    require_feature passes), and patches the agno DB factory with an in-memory
    store seeded with one session owned by this user and one owned by someone else.
    """
    import app.ai_assistant.agent as agent_mod
    from app.core.auth.deps import get_current_active_user
    from main import app

    user = SimpleNamespace(
        id=_OWNER_ID,
        hotel_id="hotel-xyz",
        role="OWNER",
        hotel=SimpleNamespace(feature_ai_agent=True, feature_ai_assistant=True),
    )

    fake_db = _FakeAgnoDb([
        _FakeSession("sess-owned", _OWNER_ID, name="My Revenue Chat",
                     runs=[_FakeRun("show me revenue", "Here is your revenue.")]),
        _FakeSession("sess-foreign", _OTHER_ID, name="Someone Else"),
    ])

    monkeypatch.setattr(agent_mod, "_make_agent_db", lambda: fake_db)
    app.dependency_overrides[get_current_active_user] = lambda: user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, fake_db
    app.dependency_overrides.pop(get_current_active_user, None)


class TestAIAgentAuth:
    async def test_chat_requires_auth(self, client: AsyncClient):
        """Unauthenticated request to /agent/chat must be rejected."""
        r = await client.post("/api/v1/agent/chat", json={"message": "hello"})
        assert r.status_code == 401

    async def test_usage_requires_auth(self, client: AsyncClient):
        """Unauthenticated request to /agent/usage must be rejected."""
        r = await client.get("/api/v1/agent/usage")
        assert r.status_code == 401


class TestAIAgentAccess:
    async def test_owner_can_access_usage(self, auth_client: AsyncClient):
        """Authenticated owner should be able to fetch agent usage stats."""
        r = await auth_client.get("/api/v1/agent/usage")
        assert r.status_code == 200
        data = r.json()
        assert "hotel_id" in data
        assert "period_days" in data
        assert "agents" in data
        assert isinstance(data["agents"], dict)
        for agent_type in ("hotelier", "guest", "whatsapp"):
            assert agent_type in data["agents"]
            agent = data["agents"][agent_type]
            assert "label" in agent
            assert "today_tokens" in agent
            assert "daily_limit" in agent

    async def test_staff_can_access_usage(self, staff_client: AsyncClient):
        """STAFF role should also be able to check agent usage."""
        r = await staff_client.get("/api/v1/agent/usage")
        assert r.status_code == 200
        data = r.json()
        assert "hotel_id" in data
        assert "period_days" in data
        assert "agents" in data

    async def test_cannot_access_other_hotel_data(self, auth_client: AsyncClient):
        """The endpoint must use the hotel_id from the JWT, not a query param override."""
        fake_hotel_id = "00000000-0000-0000-0000-000000000000"
        r = await auth_client.get(f"/api/v1/agent/usage?hotel_id={fake_hotel_id}")
        assert r.status_code in (200, 403, 404)
        if r.status_code == 200:
            data = r.json()
            assert data.get("hotel_id") != fake_hotel_id

    async def test_empty_state_returns_shape(self, auth_client: AsyncClient):
        """Fresh hotel with no AI usage returns the expected shape — not a crash."""
        r = await auth_client.get("/api/v1/agent/usage")
        assert r.status_code == 200
        data = r.json()
        assert "hotel_id" in data
        assert "period_days" in data
        assert "agents" in data
        assert isinstance(data["agents"], dict)
        for agent_stats in data["agents"].values():
            assert agent_stats.get("calls", 0) >= 0


# ─── Chat session history: list / view / rename / delete ─────────────────────

class TestChatSessionAuth:
    async def test_sessions_list_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/agent/sessions")
        assert r.status_code == 401

    async def test_session_history_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/agent/sessions/sess-owned")
        assert r.status_code == 401

    async def test_session_delete_requires_auth(self, client: AsyncClient):
        r = await client.delete("/api/v1/agent/sessions/sess-owned")
        assert r.status_code == 401


class TestChatSessionHistory:
    async def test_list_returns_only_my_sessions(self, sessions_client):
        client, _ = sessions_client
        r = await client.get("/api/v1/agent/sessions")
        assert r.status_code == 200
        data = r.json()
        ids = {s["session_id"] for s in data}
        assert "sess-owned" in ids
        assert "sess-foreign" not in ids  # tenant/user isolation
        mine = next(s for s in data if s["session_id"] == "sess-owned")
        assert mine["session_name"] == "My Revenue Chat"
        assert "created_at" in mine

    async def test_view_history_returns_mapped_messages(self, sessions_client):
        """Regression: the hotelier could not see chat history. Opening an owned
        session must return its human/ai messages, not an empty list."""
        client, _ = sessions_client
        r = await client.get("/api/v1/agent/sessions/sess-owned")
        assert r.status_code == 200
        messages = r.json()["messages"]
        assert messages == [
            {"role": "human", "content": "show me revenue"},
            {"role": "ai", "content": "Here is your revenue."},
        ]

    async def test_view_history_other_user_is_404(self, sessions_client):
        """IDOR guard — cannot read another user's session."""
        client, _ = sessions_client
        r = await client.get("/api/v1/agent/sessions/sess-foreign")
        assert r.status_code == 404

    async def test_view_history_unknown_is_404(self, sessions_client):
        client, _ = sessions_client
        r = await client.get("/api/v1/agent/sessions/does-not-exist")
        assert r.status_code == 404


class TestChatSessionDelete:
    async def test_delete_owned_session_succeeds(self, sessions_client):
        """Regression STAYBOOKERAI-3C/3B: delete must actually remove the row and
        report it, instead of erroring on a bad `session_type` kwarg."""
        client, fake_db = sessions_client
        r = await client.delete("/api/v1/agent/sessions/sess-owned")
        assert r.status_code == 200
        assert r.json() == {"deleted": True}
        assert "sess-owned" not in fake_db._sessions  # genuinely gone

    async def test_delete_other_user_is_404(self, sessions_client):
        """IDOR guard — cannot delete another user's session, and it stays put."""
        client, fake_db = sessions_client
        r = await client.delete("/api/v1/agent/sessions/sess-foreign")
        assert r.status_code == 404
        assert "sess-foreign" in fake_db._sessions

    async def test_delete_unknown_is_404(self, sessions_client):
        client, _ = sessions_client
        r = await client.delete("/api/v1/agent/sessions/does-not-exist")
        assert r.status_code == 404


class TestChatSessionRename:
    async def test_rename_owned_session(self, sessions_client):
        client, fake_db = sessions_client
        r = await client.patch("/api/v1/agent/sessions/sess-owned/rename",
                               json={"session_name": "Q3 Revenue"})
        assert r.status_code == 200
        assert r.json()["session_name"] == "Q3 Revenue"
        assert fake_db._sessions["sess-owned"].session_data["session_name"] == "Q3 Revenue"

    async def test_rename_other_user_is_404(self, sessions_client):
        client, _ = sessions_client
        r = await client.patch("/api/v1/agent/sessions/sess-foreign/rename",
                               json={"session_name": "hijack"})
        assert r.status_code == 404


# ─── Destructive cancel safety (Bug #1: AI cancelled pending bookings) ────────

async def _seed_booking(hotel_id: str, status):
    """Create a guest + booking in the given status; return its booking_number."""
    from datetime import date, timedelta
    from app.core.db.database import engine
    from app.bookings.booking import Booking, Guest, BookingStatus  # noqa: F401

    booking_number = f"BK{uuid.uuid4().hex[:8].upper()}"
    async with AsyncSession(engine) as s:
        guest = Guest(id=str(uuid.uuid4()), hotel_id=hotel_id,
                      first_name="Test", last_name="Guest",
                      email=f"g-{uuid.uuid4().hex[:6]}@example.com")
        s.add(guest)
        await s.flush()
        b = Booking(
            id=str(uuid.uuid4()), hotel_id=hotel_id, guest_id=guest.id,
            booking_number=booking_number, status=status,
            check_in=date.today() + timedelta(days=3),
            check_out=date.today() + timedelta(days=5),
            total_amount=5000.0,
        )
        s.add(b)
        await s.commit()
    return booking_number


async def _get_status(booking_number: str):
    from sqlmodel import select
    from app.core.db.database import engine
    from app.bookings.booking import Booking
    async with AsyncSession(engine) as s:
        b = (await s.execute(
            select(Booking).where(Booking.booking_number == booking_number)
        )).scalar_one()
        return b.status


class TestCancelBookingSafety:
    async def test_preview_does_not_cancel_pending_booking(self, seeded_hotel):
        """THE regression: a confirm=False (default) call must NOT change a pending
        booking. This is exactly what 'AI cancelled pending bookings' was."""
        from app.ai_engine.tools.actions import logic_cancel_booking
        from app.core.db.database import engine
        from app.bookings.booking import BookingStatus

        bn = await _seed_booking(seeded_hotel.id, BookingStatus.PENDING)
        user = SimpleNamespace(id="u-owner", hotel_id=seeded_hotel.id, role="OWNER")
        async with AsyncSession(engine) as s:
            msg = await logic_cancel_booking(s, user, bn, confirm=False)
        assert "CONFIRMATION REQUIRED" in msg
        assert await _get_status(bn) == BookingStatus.PENDING  # untouched

    async def test_staff_cannot_cancel(self, seeded_hotel):
        """RBAC: STAFF must be refused even with confirm=True, and nothing changes."""
        from app.ai_engine.tools.actions import logic_cancel_booking
        from app.core.db.database import engine
        from app.bookings.booking import BookingStatus

        bn = await _seed_booking(seeded_hotel.id, BookingStatus.PENDING)
        staff = SimpleNamespace(id="u-staff", hotel_id=seeded_hotel.id, role="STAFF")
        async with AsyncSession(engine) as s:
            msg = await logic_cancel_booking(s, staff, bn, confirm=True)
        assert "permission" in msg.lower()
        assert await _get_status(bn) == BookingStatus.PENDING

    async def test_confirmed_cancel_updates_status_and_writes_audit(self, seeded_hotel):
        """Happy path: explicit confirm=True cancels and leaves an audit trail."""
        from sqlmodel import select
        from app.ai_engine.tools.actions import logic_cancel_booking
        from app.core.db.database import engine
        from app.bookings.booking import BookingStatus
        from app.bookings.timeline import BookingTimeline

        bn = await _seed_booking(seeded_hotel.id, BookingStatus.CONFIRMED)
        user = SimpleNamespace(id="u-owner", hotel_id=seeded_hotel.id, role="OWNER")
        async with AsyncSession(engine) as s:
            msg = await logic_cancel_booking(s, user, bn, confirm=True)
        assert "SUCCESS" in msg
        assert await _get_status(bn) == BookingStatus.CANCELLED
        # Audit trail attributing the change to the AI agent must exist.
        async with AsyncSession(engine) as s:
            rows = (await s.execute(
                select(BookingTimeline).where(BookingTimeline.changed_by == "ai_agent")
            )).scalars().all()
        assert any(r.new_value == "cancelled" for r in rows)

    async def test_checked_in_booking_cannot_be_cancelled(self, seeded_hotel):
        from app.ai_engine.tools.actions import logic_cancel_booking
        from app.core.db.database import engine
        from app.bookings.booking import BookingStatus

        bn = await _seed_booking(seeded_hotel.id, BookingStatus.CHECKED_IN)
        user = SimpleNamespace(id="u-owner", hotel_id=seeded_hotel.id, role="OWNER")
        async with AsyncSession(engine) as s:
            msg = await logic_cancel_booking(s, user, bn, confirm=True)
        assert "front desk" in msg.lower()
        assert await _get_status(bn) == BookingStatus.CHECKED_IN

    async def test_cancel_isolates_by_hotel(self, seeded_hotel):
        """A booking number from another hotel is invisible (tenant isolation)."""
        from app.ai_engine.tools.actions import logic_cancel_booking
        from app.core.db.database import engine
        from app.bookings.booking import BookingStatus

        bn = await _seed_booking(seeded_hotel.id, BookingStatus.PENDING)
        other = SimpleNamespace(id="u-x", hotel_id="some-other-hotel", role="OWNER")
        async with AsyncSession(engine) as s:
            msg = await logic_cancel_booking(s, other, bn, confirm=True)
        assert "not found" in msg.lower()
        assert await _get_status(bn) == BookingStatus.PENDING
