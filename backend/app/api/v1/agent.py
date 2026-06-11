from fastapi import APIRouter, HTTPException, Query, Request, status, Depends
from typing import List
from datetime import timedelta
from pydantic import BaseModel
import logging

from app.api.deps import CurrentUser, DbSession
from app.core.feature_flags import require_feature
# NOTE: create_agent_executor is imported lazily inside the handler (INF-01) —
# importing app.core.agent at module load pulls in pandas + matplotlib (~150MB
# RSS) into every worker at boot even when the agent is never used.
from app.core.agent import create_agent_executor
from app.core.limiter import limiter
from app.core.ai_usage import enforce_ai_token_quota, record_ai_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Agent"])

# Rough average tokens per guest conversation — used only for the "estimated
# conversations" display metric shown to hoteliers. Not used in billing logic.
_AVG_TOKENS_PER_CONVERSATION = 800


class ChatRequest(BaseModel):
    message: str
    history: List[List[str]] = []  # [[role, content], ...]


class ChatResponse(BaseModel):
    response: str


@router.get("/usage")
async def get_ai_usage(
    current_user: CurrentUser,
    session: DbSession,
    days: int = Query(default=7, ge=1, le=30),
):
    """Return this hotel's AI usage breakdown for the last N days (max 30).

    Shows per-agent token spend, daily limits, % used today, and estimated
    number of guest conversations so hoteliers understand their AI bill.
    """
    from app.core.redis_client import redis_client
    from app.core.time import utcnow
    from sqlmodel import select
    from app.models.subscription import Subscription

    hotel_id = current_user.hotel_id

    sub = (await session.execute(
        select(Subscription).where(Subscription.hotel_id == hotel_id)
    )).scalar_one_or_none()

    limits = {
        "hotelier": sub.ai_hotelier_daily_limit if sub else 0,
        "guest":    sub.ai_guest_chat_daily_limit if sub else 0,
        "whatsapp": sub.ai_whatsapp_daily_limit if sub else 0,
    }

    r = redis_client.get_instance()
    today = utcnow().date()
    today_iso = today.isoformat()

    agents = {
        "hotelier": {"label": "Dashboard AI (you)", "daily_history": {}, "today_tokens": 0},
        "guest":    {"label": "Guest Chat Widget",   "daily_history": {}, "today_tokens": 0},
        "whatsapp": {"label": "WhatsApp Bot",        "daily_history": {}, "today_tokens": 0},
    }

    for agent_type, info in agents.items():
        for i in range(days):
            day = today - timedelta(days=i)
            day_str = day.strftime("%Y%m%d")
            tokens = 0
            if r:
                raw = r.get(f"ai_tokens:{agent_type}:{hotel_id}:{day_str}")
                tokens = int(raw) if raw else 0
            info["daily_history"][day.isoformat()] = tokens
        info["today_tokens"] = info["daily_history"].get(today_iso, 0)

    def _build_agent_summary(agent_type: str, info: dict) -> dict:
        today_tokens = info["today_tokens"]
        limit = limits[agent_type]
        pct = round((today_tokens / limit * 100), 1) if limit > 0 else None
        est_conversations = round(today_tokens / _AVG_TOKENS_PER_CONVERSATION)
        period_total = sum(info["daily_history"].values())
        return {
            "label": info["label"],
            "today_tokens": today_tokens,
            "daily_limit": limit,
            "pct_of_limit_used_today": pct,
            "estimated_conversations_today": est_conversations,
            "period_total_tokens": period_total,
            "daily_history": info["daily_history"],
        }

    return {
        "hotel_id": hotel_id,
        "period_days": days,
        "data_available": r is not None,
        "agents": {
            agent_type: _build_agent_summary(agent_type, info)
            for agent_type, info in agents.items()
        },
    }


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(require_feature("feature_ai_agent"))])
@limiter.limit("15/minute")
async def chat_with_agent(
    request: Request,
    payload: ChatRequest,
    current_user: CurrentUser,
    session: DbSession
):
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
        from app.core.agent import create_agent_executor
        agent = await create_agent_executor(session, current_user, user_query=payload.message)

        # 2. Build history as Agno Messages (limit last 20)
        from agno.agent import Message
        chat_history = []
        for item in payload.history[-20:]:
            if len(item) == 2:
                role, content = item
                if role.lower() in ["human", "user"]:
                    chat_history.append(Message(role="user", content=content))
                elif role.lower() in ["ai", "assistant", "model"]:
                    chat_history.append(Message(role="assistant", content=content))

        # 3. Build input: history messages + new user message
        input_messages = chat_history + [Message(role="user", content=payload.message)]

        # 4. Run agent
        result = await agent.arun(input_messages)
        record_ai_usage(current_user.hotel_id, result, agent_type="hotelier")
        return ChatResponse(response=result.content or "")

    except ValueError as e:
        # Config-level problems (e.g. missing AI key) — safe, actionable message.
        logger.warning(f"Agent config error: {e}")
        raise HTTPException(status_code=503, detail="AI Assistant is not configured. Please contact support.")
    except Exception as e:
        # AI-FIX: don't leak internal exception text (stack/library detail) to the
        # client. Log the detail server-side, return a generic message.
        logger.error(f"Agent Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="The AI Assistant hit a temporary error. Please try again.")
