from fastapi import APIRouter, HTTPException, Query, Request, status, Depends
from fastapi.responses import StreamingResponse
from typing import List, Literal
import asyncio
import json
from pydantic import BaseModel, Field
import logging

from app.core.auth.deps import CurrentUser, DbSession
from app.core.utils.time import utcnow
from app.core.utils.feature_flags import require_feature
# create_agent_executor is imported lazily inside the handler to avoid pulling in
# pandas + matplotlib (~150MB RSS) at worker boot when the agent is never called.
from app.core.utils.limiter import limiter
from app.ai_engine.ai_usage import enforce_ai_token_quota, record_ai_usage, persist_ai_usage_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Agent"])


# Module-level singleton so the session list/history/rename/delete endpoints do
# NOT create a fresh AsyncEngine (and therefore a fresh connection pool) on every
# request. Per-request engines leaked pools and, under Supabase's pgbouncer
# transaction pooling, surfaced as InvalidSQLStatementNameError ("prepared
# statement ... does not exist") on /agent/sessions (Sentry STAYBOOKERAI-3A).
_agent_db_singleton = None


def _make_agent_db():
    """Return a cached, lightweight AsyncPostgresDb without spinning up the full agent.

    The full create_agent_executor() initialises the LLM, all tool functions,
    and four sub-agents — unnecessary overhead for pure DB reads/writes on the
    sessions table.  This helper creates only the DB layer (once) so that session
    list, history, rename, and delete endpoints stay fast and connection-safe.
    """
    global _agent_db_singleton
    if _agent_db_singleton is not None:
        return _agent_db_singleton

    from agno.db.postgres import AsyncPostgresDb
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.core.utils.config import get_settings
    settings = get_settings()

    # Force the asyncpg driver. A bare postgres:// / postgresql:// URL can resolve
    # to the sync psycopg dialect, which rejects the asyncpg-only `ssl` /
    # `statement_cache_size` connect args (Sentry STAYBOOKERAI-32: invalid
    # connection option "ssl"; STAYBOOKERAI-30: No module named 'psycopg').
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = "postgresql+asyncpg://" + db_url[len("postgres://"):]
    elif db_url.startswith("postgresql://"):
        db_url = "postgresql+asyncpg://" + db_url[len("postgresql://"):]

    connect_args = {"statement_cache_size": 0} if "asyncpg" in db_url else {}

    # Pool sizing is env-driven (DB_POOL_SIZE/DB_MAX_OVERFLOW) so this — a SECOND,
    # dedicated pool for the agno session store, separate from the app ORM engine —
    # stays inside Supabase's limit: keep
    # (DB_POOL_SIZE + this) * WEB_CONCURRENCY * replicas <= connection limit.
    # SQLite (tests) uses its own pooling and rejects these kwargs, so skip them there.
    engine_kwargs = {"connect_args": connect_args, "pool_pre_ping": True}
    if "sqlite" not in db_url:
        engine_kwargs.update(
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_timeout=settings.DB_POOL_TIMEOUT,
        )
    engine = create_async_engine(db_url, **engine_kwargs)
    _agent_db_singleton = AsyncPostgresDb(db_engine=engine, session_table="agno_sessions")
    return _agent_db_singleton

# Rough average tokens per guest conversation — used only for the "estimated
# conversations" display metric shown to hoteliers. Not used in billing logic.
_AVG_TOKENS_PER_CONVERSATION = 800


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    history: List[List[str]] = []  # [[role, content], ...]


class ChatResponse(BaseModel):
    response: str
    session_id: str
    # Human-in-the-loop: when the AI wants to run a destructive tool (cancel
    # booking, price change, promo, block dates), agno PAUSES the run and we
    # surface a confirmation request instead of executing. The frontend renders
    # Proceed/Cancel and calls /agent/chat/confirm with run_id to resume.
    requires_confirmation: bool = False
    run_id: str | None = None


class ConfirmRequest(BaseModel):
    session_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    decision: Literal["proceed", "cancel"]


# Friendly descriptions of what each destructive tool is about to do, built from
# the paused run's tool args so the hotelier sees exactly what they're approving.
def _describe_pending_action(tool_name: str, args: dict) -> str:
    args = args or {}
    if tool_name == "cancel_booking":
        return f"Cancel booking **{args.get('booking_number', '?')}**"
    if tool_name == "update_room_price":
        return f"Change **{args.get('room_name', '?')}** base price to **₹{args.get('new_price', '?')}**"
    if tool_name == "create_promo_code":
        return f"Create promo code **{args.get('code', '?')}** ({args.get('discount_percent', '?')}% off)"
    if tool_name == "block_room_dates":
        return (
            f"Block **{args.get('room_type_name', '?')}** from "
            f"{args.get('start_date_str', '?')} to {args.get('end_date_str', '?')} "
            f"({args.get('reason', 'Maintenance')})"
        )
    return f"Run `{tool_name}`"


def _build_confirmation_prompt(run_output) -> str:
    """Turn a paused run's active requirements into a hotelier-facing prompt."""
    actions = []
    for req in getattr(run_output, "active_requirements", []) or []:
        te = getattr(req, "tool_execution", None)
        if te is None:
            continue
        actions.append(_describe_pending_action(getattr(te, "tool_name", ""), getattr(te, "tool_args", {})))
    if not actions:
        return "The assistant wants to perform an action. Proceed?"
    bullet = "\n".join(f"- {a}" for a in actions)
    return (
        "⚠️ **Confirmation required** — I'm about to:\n"
        f"{bullet}\n\nThis won't happen until you choose **Proceed**."
    )


@router.get("/usage")
async def get_ai_usage(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=7, ge=1, le=30),
):
    """Return this hotel's AI usage breakdown for the last N days (max 30).

    Reads from the durable Postgres usage tables (source of truth) so the
    numbers always show even when Redis is down. Shows per-agent token spend,
    daily limits, % used today, real message + unique-guest counts.
    """
    from sqlmodel import select
    from app.superadmin.subscriptions.subscription import Subscription
    from app.ai_engine.ai_usage import read_ai_usage_db

    hotel_id = current_user.hotel_id

    sub = (await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel_id)
    )).scalar_one_or_none()

    limits = {
        "hotelier": sub.ai_hotelier_daily_limit if sub else 0,
        "guest":    sub.ai_guest_chat_daily_limit if sub else 0,
        "whatsapp": sub.ai_whatsapp_daily_limit if sub else 0,
    }

    labels = {
        "hotelier": "Dashboard AI (you)",
        "guest":    "Guest Chat Widget",
        "whatsapp": "WhatsApp Bot",
    }

    # Durable read is the source of truth, but a transient DB hiccup (or the
    # usage tables not yet existing in the seconds after a fresh deploy) must
    # not 500 the dashboard — that left the frontend spinning "Loading usage…"
    # forever. Degrade to an empty, clearly-flagged payload instead.
    try:
        usage = await read_ai_usage_db(hotel_id, days)
    except Exception:
        logger.warning("read_ai_usage_db failed for hotel %s; returning empty usage", hotel_id, exc_info=True)
        return {
            "hotel_id": hotel_id,
            "period_days": days,
            "data_available": False,
            "agents": {
                a: {
                    "label": labels[a], "today_tokens": 0, "daily_limit": limits[a],
                    "pct_of_limit_used_today": None, "messages_today": 0,
                    "unique_users_today": 0, "estimated_conversations_today": 0,
                    "period_total_tokens": 0, "daily_history": {},
                }
                for a in ("hotelier", "guest", "whatsapp")
            },
        }
    today_iso = utcnow().date().isoformat()

    def _build_agent_summary(agent_type: str) -> dict:
        u = usage[agent_type]
        daily_history = u["daily_tokens"]
        today_tokens = daily_history.get(today_iso, 0)
        limit = limits[agent_type]
        pct = round((today_tokens / limit * 100), 1) if limit > 0 else None
        period_total = sum(daily_history.values())
        unique_users = u["unique_users_today"]
        return {
            "label": labels[agent_type],
            "today_tokens": today_tokens,
            "daily_limit": limit,
            "pct_of_limit_used_today": pct,
            # Real durable counts — not token-based estimates.
            "messages_today": u["messages_today"],
            "unique_users_today": unique_users,
            "estimated_conversations_today": unique_users or round(today_tokens / _AVG_TOKENS_PER_CONVERSATION),
            "period_total_tokens": period_total,
            "daily_history": daily_history,
        }

    return {
        "hotel_id": hotel_id,
        "period_days": days,
        # DB-backed: always available, no longer gated on Redis.
        "data_available": True,
        "agents": {a: _build_agent_summary(a) for a in ("hotelier", "guest", "whatsapp")},
    }


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(require_feature("feature_ai_agent"))])
@limiter.limit("15/minute")
async def chat_with_agent(
    request: Request,
    payload: ChatRequest,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Handle user chat interactions with the AI Assistant.
    
    ARCHITECTURE OVERVIEW:
    - **API Gateway**: This is the primary REST endpoint for frontend chat communication.
    - **Rate Limiting (GEMINI.md Rule 5)**: Protected by Redis-backed sliding window limiter (15 req/min).
    - **Usage Quotas (GEMINI.md Rule 4)**: Uses `enforce_ai_token_quota` to protect against token exhaustion.
    - **Session Isolation (GEMINI.md Rule 1 & ChatGPT-style Memory)**: By passing `payload.session_id`, 
      Agno loads only the messages specific to this chat thread from `PostgresDb`. This limits token 
      bloat and prevents cross-contamination of contexts between different user topics.
    - **Usage Logging**: Every request persistently records actual LLM tokens used to Postgres via `record_ai_usage`.
    """
    # Enforce SaaS feature flag guard
    if not current_user.hotel or not getattr(current_user.hotel, "feature_ai_assistant", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Assistant feature is not enabled for your subscription plan"
        )

    # AI-QUOTA: enforce per-agent subscription daily token budget before spending any tokens
    await enforce_ai_token_quota("hotelier", current_user.hotel_id, session)

    try:
        # 1. Initialize Agent (lazy import — see INF-01 note at top of file)
        from app.ai_engine.agent import create_agent_executor
        agent = await create_agent_executor(session, current_user, user_query=payload.message)

        # 2. Run agent with persistent session tracking
        # agno Team.arun() requires 'input' as first positional argument
        result = await agent.arun(
            payload.message,
            user_id=str(current_user.id),
            session_id=payload.session_id  # If None, Agno auto-generates a UUID
        )
        record_ai_usage(current_user.hotel_id, result, agent_type="hotelier", user_identifier=current_user.id)
        await persist_ai_usage_db(current_user.hotel_id, result, agent_type="hotelier", user_identifier=current_user.id)

        # Set session name from first message so sidebar shows meaningful names
        if not payload.session_id and agent.session_id:
            try:
                from agno.db.base import SessionType
                session_name = payload.message[:60].strip()
                await agent.db.rename_session(
                    session_id=agent.session_id,
                    session_type=SessionType.TEAM,
                    session_name=session_name,
                )
            except Exception:
                pass  # non-critical — sidebar falls back to "New Chat"

        # Human-in-the-loop: the AI asked to run a destructive tool. agno paused
        # the run instead of executing it — surface a confirmation request so the
        # hotelier explicitly approves before anything changes.
        if getattr(result, "is_paused", False):
            return ChatResponse(
                response=_build_confirmation_prompt(result),
                session_id=agent.session_id,
                requires_confirmation=True,
                run_id=result.run_id,
            )

        return ChatResponse(response=result.content or "", session_id=agent.session_id)

    except ValueError as e:
        # Config-level problems (e.g. missing AI key) — safe, actionable message.
        logger.warning(f"Agent config error: {e}")
        raise HTTPException(status_code=503, detail="AI Assistant is not configured. Please contact support.")
    except Exception as e:
        # AI-FIX: don't leak internal exception text (stack/library detail) to the
        # client. Log the detail server-side, return a generic message.
        logger.error(f"Agent Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="The AI Assistant hit a temporary error. Please try again.")


@router.post("/chat/stream", dependencies=[Depends(require_feature("feature_ai_agent"))])
@limiter.limit("15/minute")
async def chat_stream(
    request: Request,
    payload: ChatRequest,
    current_user: CurrentUser,
    session: DbSession,
):
    """Streaming chat — returns Server-Sent Events so the frontend can render
    tokens as they arrive instead of waiting for the full response."""
    if not current_user.hotel or not getattr(current_user.hotel, "feature_ai_assistant", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="AI Assistant feature is not enabled")

    await enforce_ai_token_quota("hotelier", current_user.hotel_id, session)

    # Agno emits events at two layers:
    # - Team-level:  TeamRunContent, TeamToolCallStarted, TeamRunCompleted, TeamRunError
    # - Member-level: RunContent, ToolCallStarted (no session_id on RunCompleted)
    # We intentionally DO NOT stream RunContent/TeamRunContent events because they contain
    # intermediate LLM narration ("Let me check...", "Let me fetch...") that pollutes the UI.
    # TeamRunCompleted.content is the single clean final response — we send only that.
    _TOOL_EVENTS = {"TeamToolCallStarted", "ToolCallStarted"}

    async def generate():
        try:
            from app.ai_engine.agent import create_agent_executor
            agent = await create_agent_executor(session, current_user, user_query=payload.message)

            # Capture session_id from the first event that carries it (TeamRunStarted arrives
            # before TeamRunCompleted and reliably has session_id set by Agno).
            captured_session_id: str | None = None

            async for evt in agent.arun(
                payload.message,
                user_id=str(current_user.id),
                session_id=payload.session_id,
                stream=True,
                stream_events=True,
            ):
                ev = getattr(evt, "event", "")

                # Grab session_id from any event that carries it
                if not captured_session_id:
                    captured_session_id = getattr(evt, "session_id", None) or None

                if ev in _TOOL_EVENTS:
                    tool_name = ""
                    if getattr(evt, "tool", None):
                        tool_name = getattr(evt.tool, "tool_name", "") or ""
                    yield f"data: {json.dumps({'type': 'tool', 'name': tool_name})}\n\n"

                elif ev == "TeamRunCompleted":
                    sid = (
                        getattr(evt, "session_id", None)
                        or captured_session_id
                        or getattr(agent, "session_id", None)
                    )
                    # Always use TeamRunCompleted.content — it's the clean, final response
                    # with no intermediate "Let me check..." narration.
                    full_text = getattr(evt, "content", None)
                    if full_text:
                        yield f"data: {json.dumps({'type': 'content', 'delta': str(full_text)})}\n\n"
                    record_ai_usage(current_user.hotel_id, evt, agent_type="hotelier", user_identifier=str(current_user.id))
                    await persist_ai_usage_db(current_user.hotel_id, evt, agent_type="hotelier", user_identifier=str(current_user.id))
                    if not payload.session_id and sid:
                        try:
                            from agno.db.base import SessionType
                            await agent.db.rename_session(
                                session_id=sid,
                                session_type=SessionType.TEAM,
                                session_name=payload.message[:60].strip(),
                            )
                        except Exception:
                            pass
                    yield f"data: {json.dumps({'type': 'done', 'session_id': sid or ''})}\n\n"

                elif ev == "TeamRunPaused":
                    # Human-in-the-loop: the AI wants to run a destructive tool.
                    # Emit a confirmation request (with run_id) instead of a result;
                    # the frontend shows Proceed/Cancel and calls /agent/chat/confirm.
                    sid = (
                        getattr(evt, "session_id", None)
                        or captured_session_id
                        or getattr(agent, "session_id", None)
                    )
                    run_id = getattr(evt, "run_id", None) or getattr(agent, "run_id", None)
                    yield f"data: {json.dumps({'type': 'confirmation', 'prompt': _build_confirmation_prompt(evt), 'run_id': run_id or '', 'session_id': sid or ''})}\n\n"

                elif ev in ("TeamRunError", "RunError"):
                    yield f"data: {json.dumps({'type': 'error', 'message': 'AI error occurred'})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI Assistant hit a temporary error. Please try again.'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat/confirm", response_model=ChatResponse, dependencies=[Depends(require_feature("feature_ai_agent"))])
@limiter.limit("15/minute")
async def confirm_pending_action(
    request: Request,
    payload: ConfirmRequest,
    current_user: CurrentUser,
    session: DbSession,
):
    """Resume a paused human-in-the-loop run after the hotelier decides.

    The destructive tool (cancel booking, price change, promo, block dates) was
    NOT executed when the run paused. Here we either confirm the pending
    requirement(s) — letting agno run the tool — or reject them, then continue the
    run so the assistant produces a closing message. The destructive write itself
    still goes through the server-side guards in the tool (role, status, tenant).
    """
    if not current_user.hotel or not getattr(current_user.hotel, "feature_ai_assistant", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="AI Assistant feature is not enabled")

    proceed = payload.decision == "proceed"
    await enforce_ai_token_quota("hotelier", current_user.hotel_id, session)

    # Hard timeout: aget_run_output + acontinue_run hit the DB and the LLM, so a
    # stuck provider must not hold the request open indefinitely (CLAUDE.md §5).
    from app.core.utils.config import get_settings
    timeout = get_settings().AI_CONFIRM_TIMEOUT_SECONDS

    try:
        from app.ai_engine.agent import create_agent_executor
        agent = await create_agent_executor(session, current_user)

        paused = await asyncio.wait_for(
            agent.aget_run_output(payload.run_id, payload.session_id, user_id=str(current_user.id)),
            timeout=timeout,
        )
        if paused is None or not getattr(paused, "is_paused", False):
            raise HTTPException(status_code=404, detail="No pending action to confirm — it may have already been handled or expired.")

        for req in (getattr(paused, "active_requirements", []) or []):
            if not req.needs_confirmation:
                continue
            if proceed:
                req.confirm()
            else:
                req.reject(note="Hotelier declined the action.")

        result = await asyncio.wait_for(
            agent.acontinue_run(
                run_response=paused,
                session_id=payload.session_id,
                user_id=str(current_user.id),
            ),
            timeout=timeout,
        )
        record_ai_usage(current_user.hotel_id, result, agent_type="hotelier", user_identifier=current_user.id)
        await persist_ai_usage_db(current_user.hotel_id, result, agent_type="hotelier", user_identifier=current_user.id)

        # The continued run could itself pause on a further destructive tool.
        if getattr(result, "is_paused", False):
            return ChatResponse(
                response=_build_confirmation_prompt(result),
                session_id=payload.session_id,
                requires_confirmation=True,
                run_id=result.run_id,
            )

        fallback = "Done." if proceed else "Okay — cancelled. No changes were made."
        return ChatResponse(response=(result.content or fallback), session_id=payload.session_id)

    except HTTPException:
        raise
    except asyncio.TimeoutError as e:
        logger.error(f"Confirm timed out after {timeout}s for run {payload.run_id}")
        raise HTTPException(status_code=504, detail="The action timed out. Please try again.") from e
    except ValueError as e:
        logger.warning(f"Confirm config error: {e}")
        raise HTTPException(status_code=503, detail="AI Assistant is not configured. Please contact support.") from e
    except Exception as e:
        logger.error(f"Confirm error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not complete the action. Please try again.") from e


class RenameSessionRequest(BaseModel):
    session_name: str


@router.get("/sessions", dependencies=[Depends(require_feature("feature_ai_agent"))])
async def get_chat_sessions(current_user: CurrentUser):
    """Fetch past chat sessions for the hotelier."""
    from agno.db.base import SessionType
    db = _make_agent_db()
    try:
        sessions = await db.get_sessions(
            user_id=str(current_user.id),
            session_type=SessionType.TEAM,
            limit=50,
        )
        return [
            {
                "session_id": s.session_id,
                "session_name": (s.session_data or {}).get("session_name") or "New Chat",
                "created_at": s.created_at,
            }
            for s in sessions
            if s is not None
        ]
    except Exception as e:
        logger.warning(f"Failed to fetch sessions: {e}")
        return []


@router.get("/sessions/{session_id}", dependencies=[Depends(require_feature("feature_ai_agent"))])
async def get_chat_session_history(session_id: str, current_user: CurrentUser):
    """Fetch messages of a specific chat session."""
    from agno.db.base import SessionType
    db = _make_agent_db()
    # Ownership (IDOR guard) is delegated to agno: passing user_id filters the
    # row in SQL, so a session belonging to another user simply isn't returned.
    # The previous manual `sess.user_id != str(current_user.id)` check 404'd even
    # for the legitimate owner whenever the deserialized user_id didn't string-match.
    try:
        sess = await db.get_session(
            session_id, session_type=SessionType.TEAM, user_id=str(current_user.id)
        )
    except Exception as e:
        # Don't silently return an empty history — that hid real DB errors and
        # showed the hotelier a blank, "working" chat. Log and surface 503 so the
        # frontend shows a real "could not load" toast instead of fake-empty data.
        logger.error(f"Failed to fetch session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Could not load chat history. Please try again.") from e

    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = []
    for run in (getattr(sess, "runs", None) or []):
        if run is None:
            continue
        try:
            raw_input = getattr(run, "input", None)
            ai_text = getattr(run, "content", None)
            # run.input is a TeamRunInput dataclass — extract plain text from input_content.
            if raw_input is not None:
                user_text = getattr(raw_input, "input_content", None)
                if user_text is None and isinstance(raw_input, dict):
                    user_text = raw_input.get("input_content")
                user_text = user_text or (str(raw_input) if not isinstance(raw_input, dict) else None)
                if user_text:
                    messages.append({"role": "human", "content": str(user_text)})
            if ai_text:
                messages.append({"role": "ai", "content": str(ai_text)})
        except Exception as e:
            # One malformed run must not blank the whole conversation.
            logger.warning(f"Skipping unreadable run in session {session_id}: {e}")
            continue
    return {"messages": messages}


@router.patch("/sessions/{session_id}/rename", dependencies=[Depends(require_feature("feature_ai_agent"))])
async def rename_chat_session(
    session_id: str,
    payload: RenameSessionRequest,
    current_user: CurrentUser,
):
    """Rename a chat session."""
    from agno.db.base import SessionType
    db = _make_agent_db()
    name = payload.session_name.strip()[:80] or "New Chat"
    try:
        # user_id scopes the rename to the owner — returns None for someone
        # else's session, which we map to 404 (IDOR guard).
        result = await db.rename_session(
            session_id=session_id,
            session_type=SessionType.TEAM,
            session_name=name,
            user_id=str(current_user.id),
        )
    except Exception as e:
        logger.error(f"Failed to rename session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not rename session") from e
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "session_name": name}


@router.delete("/sessions/{session_id}", dependencies=[Depends(require_feature("feature_ai_agent"))])
async def delete_chat_session(session_id: str, current_user: CurrentUser):
    """Delete a chat session."""
    db = _make_agent_db()
    # agno's delete_session takes (session_id, user_id) — NOT session_type. The
    # old code passed session_type to a pre-fetch and then deleted; in production
    # the delete call was raising "unexpected keyword argument 'session_type'"
    # (Sentry STAYBOOKERAI-3C → surfaced as STAYBOOKERAI-3B "Could not delete").
    # Passing user_id scopes deletion to the owner (IDOR guard); the boolean
    # return tells us whether a row was actually removed instead of always
    # claiming success.
    try:
        deleted = await db.delete_session(session_id=session_id, user_id=str(current_user.id))
    except Exception as e:
        logger.error(f"Failed to delete session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Could not delete session") from e
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True}

