import json
from typing import List, Optional, Dict, Any
from datetime import date
from sqlmodel import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hotel import Hotel
from app.core.config import get_settings

SYSTEM_PROMPT = """You are the Staybooker Global Concierge.
Your sole purpose is to help guests connect to the correct hotel AI agent.

PERSONALITY:
1. Warm, professional, and concise.
2. DO NOT pretend to be a specific hotel until the guest has chosen one.

WORKFLOW:
1. Greet the guest and ask them which hotel they are interested in.
2. If the guest mentions a hotel name, use the 'search_hotels' tool to find it.
3. If 'search_hotels' finds exactly ONE matching hotel, you MUST use the 'route_to_hotel' tool to connect the guest to that hotel.
4. If multiple hotels match, list them and ask the guest to clarify.
5. Do NOT answer questions about room availability or prices yourself. You MUST route the guest to the specific hotel first.

Current Date: {current_date}
"""

def create_global_concierge_graph(
    session: AsyncSession,
    ai_provider: str,
    ai_api_key: str,
    ai_model: str,
    ai_base_url: str = None
):
    """
    Creates the Tier 1 Global Concierge Agent.
    """

    async def search_hotels(hotel_name: str) -> str:
        """
        Search for a hotel by name in the Staybooker platform.
        Returns a list of matching hotels and their internal IDs.
        """
        query = select(Hotel).where(Hotel.name.ilike(f"%{hotel_name}%")).limit(5)
        res = await session.execute(query)
        hotels = res.scalars().all()

        if not hotels:
            return f"No hotels found matching '{hotel_name}'."

        result = "Matching Hotels:\n"
        for h in hotels:
            result += f"- Name: '{h.name}', ID: {h.id}\n"
        return result

    def route_to_hotel(hotel_id: str, hotel_name: str) -> str:
        """
        Call this tool ONLY when you have positively identified the specific hotel the guest wants.
        This will instantly transfer the chat session to the hotel's AI.
        """
        # We output a magic string that the webhook will intercept
        action_data = {
            "hotel_id": str(hotel_id),
            "hotel_name": hotel_name
        }
        return f"ACTION:ROUTE_TO_HOTEL|{json.dumps(action_data)}"

    tools = [search_hotels, route_to_hotel]

    if not ai_api_key or not ai_model:
        return None

    from agno.agent import Agent

    effective_provider = (ai_provider or "").lower().strip()
    if not effective_provider:
        if ai_api_key.startswith("gsk_"):
            effective_provider = "groq"
        elif ai_api_key.startswith("sk-"):
            effective_provider = "openai"
        elif ai_api_key.startswith("AIza"):
            effective_provider = "gemini"

    if effective_provider in ("gemini", "google"):
        from agno.models.google import Gemini
        llm_model = Gemini(
            id=ai_model or "gemini-1.5-flash",
            api_key=ai_api_key,
            max_output_tokens=1024,
            cache_response=True,
            cache_ttl=300,
        )
    elif effective_provider == "deepseek":
        from agno.models.deepseek import DeepSeek
        llm_model = DeepSeek(
            id=ai_model or "deepseek-chat",
            api_key=ai_api_key,
            max_tokens=1024,
            cache_response=True,
            cache_ttl=300,
        )
    else:
        from agno.models.openai import OpenAILike
        default_base_url = "https://api.groq.com/openai/v1" if effective_provider == "groq" else None
        llm_model = OpenAILike(
            # AI-04: cheap 8B model is sufficient for the routing/concierge flow.
            id=ai_model or ("llama-3.1-8b-instant" if effective_provider == "groq" else "gpt-4o-mini"),
            api_key=ai_api_key,
            base_url=ai_base_url or default_base_url,
            # AI-07: cap output tokens so a runaway response can't balloon cost.
            max_tokens=1024,
            cache_response=True,
            cache_ttl=300,
        )

    formatted_prompt = SYSTEM_PROMPT.format(current_date=date.today().isoformat())

    agent = Agent(
        model=llm_model,
        tools=tools,
        instructions=formatted_prompt,
        markdown=True,
        # AI-02: bound tool-call iterations to prevent unbounded LLM spend.
        tool_call_limit=4,
        max_tool_calls_from_history=2,  # less history tool context = fewer tokens
        compress_tool_results=True,     # compress tool outputs to save tokens
    )
    return agent
