from fastapi import APIRouter, HTTPException, status
from typing import List
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
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
        # 1. Initialize Agent (returns Graph)
        graph = create_agent_executor(session, current_user)

        # 2. Format History (limit to last 20 messages to prevent context blowup)
        chat_history = []
        for item in payload.history:
            if len(item) == 2:
                role, content = item
                if role.lower() in ["human", "user"]:
                    chat_history.append(HumanMessage(content=content))
                elif role.lower() in ["ai", "assistant", "model"]:
                    chat_history.append(AIMessage(content=content))
        chat_history = chat_history[-20:]

        # 3. Invoke Agent
        # Prepare input messages
        input_messages = chat_history + [HumanMessage(content=payload.message)]

        # Invoke graph
        result = await graph.ainvoke({
            "messages": input_messages
        })

        # Result is state. 'messages' contains the full conversation.
        # The last message should be AIMessage.
        last_message = result["messages"][-1]

        return ChatResponse(response=last_message.content)

    except ValueError as e:
        # Likely missing API Key
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Agent Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Agent Error: {str(e)}")
