from fastapi import APIRouter, HTTPException, status
from typing import List
from pydantic import BaseModel
import logging

from app.api.deps import CurrentUser, DbSession
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

@router.post("/chat", response_model=ChatResponse)
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

    try:
        # 1. Initialize Agent
        agent = create_agent_executor(session, current_user)

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
        return ChatResponse(response=result.content or "")

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Agent Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Agent Error: {str(e)}")
