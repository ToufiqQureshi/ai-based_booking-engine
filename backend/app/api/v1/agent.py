from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from pydantic import BaseModel
import logging

from app.api.deps import CurrentUser, DbSession
from app.core.feature_flags import require_feature
# NOTE: create_agent_executor is imported lazily inside the handler (INF-01) —
# importing app.core.agent at module load pulls in pandas + matplotlib (~150MB
# RSS) into every worker at boot even when the agent is never used.
from app.core.agent import create_agent_executor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Agent"])

class ChatRequest(BaseModel):
    message: str
    history: List[List[str]] = [] # [[role, content], ...]

class ChatResponse(BaseModel):
    response: str

from fastapi import Request
from app.core.limiter import limiter


async def _enforce_hotelier_ai_token_quota(hotel_id: str, session) -> None:
    """Block the request if today's token spend has hit the subscription's ai_usage_limit.

    Fails open on Redis unavailability or missing subscription so legitimate
    requests are never blocked by infrastructure errors.
    """
    try:
        from sqlmodel import select
        from app.models.subscription import Subscription
        from app.core.redis_client import redis_client
        from app.core.time import utcnow

        sub = (await session.execute(
            select(Subscription).where(Subscription.hotel_id == hotel_id)
        )).scalar_one_or_none()

        if not sub or sub.ai_usage_limit <= 0:
            return  # No subscription or unlimited — pass through

        r = redis_client.get_instance()
        if not r:
            return  # Redis down — fail open, quota check is best-effort

        day = utcnow().strftime("%Y%m%d")
        raw = r.get(f"ai_tokens:{hotel_id}:{day}")
        used = int(raw) if raw else 0

        if used >= sub.ai_usage_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Daily AI token quota exceeded ({used:,}/{sub.ai_usage_limit:,} tokens). "
                    "Please contact support to upgrade your plan."
                ),
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("Hotelier token quota check failed for hotel %s: %s", hotel_id, exc)


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

    # AI-QUOTA: enforce subscription daily token budget before spending any tokens
    await _enforce_hotelier_ai_token_quota(current_user.hotel_id, session)

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
        # AI-03: record per-hotel token spend for cost visibility.
        from app.core.ai_usage import record_ai_usage
        record_ai_usage(current_user.hotel_id, result)
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
