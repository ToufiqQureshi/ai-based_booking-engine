from fastapi import APIRouter, HTTPException, Query, Request, status, Depends
from typing import List
from pydantic import BaseModel
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


@router.get("/sessions", dependencies=[Depends(require_feature("feature_ai_agent"))])
async def get_chat_sessions(
    current_user: CurrentUser,
    session: DbSession
):
    """Fetch past chat sessions for the hotelier."""
    from app.ai_engine.agent import create_agent_executor
    from agno.db.base import SessionType
    agent = await create_agent_executor(session, current_user, user_query="")

    try:
        sessions = await agent.db.get_sessions(
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
async def get_chat_session_history(
    session_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """Fetch messages of a specific chat session."""
    from app.ai_engine.agent import create_agent_executor
    from agno.db.base import SessionType
    agent = await create_agent_executor(session, current_user, user_query="")

    try:
        sess = await agent.db.get_session(session_id, session_type=SessionType.TEAM)
        if not sess or sess.user_id != str(current_user.id):
            raise HTTPException(status_code=404, detail="Session not found")

        messages = []
        for run in (sess.runs or []):
            if run is None:
                continue
            raw_input = getattr(run, "input", None)
            ai_text = getattr(run, "content", None)
            # run.input is a TeamRunInput dataclass — extract plain text from input_content
            if raw_input is not None:
                user_text = getattr(raw_input, "input_content", None) or str(raw_input)
                if user_text:
                    messages.append({"role": "human", "content": str(user_text)})
            if ai_text:
                messages.append({"role": "ai", "content": str(ai_text)})
        return {"messages": messages}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch session messages: {e}")
        return {"messages": []}

