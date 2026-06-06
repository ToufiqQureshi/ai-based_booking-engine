from typing import List, Optional, Any, Dict
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks
from sqlmodel import select, and_, or_
from pydantic import BaseModel, EmailStr
import uuid
import logging

from app.core.database import get_session
from app.api.deps import DbSession
from app.models.hotel import Hotel, HotelRead
from app.models.room import RoomType, RoomTypeRead, RoomBlock
from app.models.booking import Booking, BookingStatus, Guest
from app.models.rates import RatePlan, RoomRate
from app.models.promo import PromoCode
from app.core.redis_client import redis_client
import json
from app.services.email_service import get_email_service
from app.core.time import utcnow

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

# AI-01: hard daily cap on anonymous AI chat requests per hotel. The IP-based
# slowapi limit is spoofable via X-Forwarded-For, so this per-hotel budget is
# the real backstop against an attacker burning a hotel's LLM spend.
AI_CHAT_DAILY_CAP_PER_HOTEL = 1000


def _enforce_hotel_ai_quota(hotel_id: str) -> None:
    """Increment + check a per-hotel, per-day request counter in Redis.
    Fails open if Redis is unavailable so legitimate guests aren't blocked."""
    try:
        r = redis_client.get_instance()
        if not r:
            return
        day = utcnow().strftime("%Y%m%d")
        key = f"ai_chat_quota:{hotel_id}:{day}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 86400)
        if count > AI_CHAT_DAILY_CAP_PER_HOTEL:
            raise HTTPException(
                status_code=429,
                detail="Daily AI chat limit reached for this property. Please try again later.",
            )
    except HTTPException:
        raise
    except Exception:
        return

class RateOption(BaseModel):
    id: str # rate_plan_id
    name: str # rate_plan_name (e.g. "Room Only", "Breakfast Included")
    meal_plan_code: str
    price_per_night: float
    total_price: float
    inclusions: List[str]
    is_refundable: bool = True
    cancellation_policy: Optional[str] = None
    savings_text: Optional[str] = None # e.g. "Save INR 2,000"
    is_package: bool = False
    image_url: Optional[str] = None

class PublicRoomSearchResult(RoomTypeRead):
    """
    Extended room response for public search.
    Includes calculated price and availability.
    """
    available_rooms: int
    price_starting_at: float
    rate_options: List[RateOption]


async def resolve_hotel_id(identifier: str, session: DbSession) -> str:
    # Normalize identifier (convert spaces and %20 to hyphens, lowercase)
    normalized = identifier.strip().replace("%20", "-").replace(" ", "-").lower()
    
    cache_key = f"public:slug-to-id:{normalized}"
    try:
        cached = redis_client.get_value(cache_key)
        if cached:
            return cached
    except Exception as e:
        logger.error(f"Failed to get slug-to-id cache: {e}")

    # Query DB
    query = select(Hotel).where(or_(Hotel.slug == normalized, Hotel.id == identifier, Hotel.id == normalized))
    result = await session.execute(query)
    hotel = result.scalar_one_or_none()
    
    if hotel:
        # Cache mapping
        try:
            redis_client.set_value(f"public:slug-to-id:{hotel.slug}", hotel.id, expire=86400)
            redis_client.set_value(f"public:slug-to-id:{hotel.id}", hotel.id, expire=86400)
            if normalized != hotel.slug:
                redis_client.set_value(f"public:slug-to-id:{normalized}", hotel.id, expire=86400)
        except Exception as e:
            logger.error(f"Failed to set slug-to-id cache: {e}")
        return hotel.id
    return identifier


# --- Public Booking Schemas ---
class PublicGuestCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    nationality: str = "IN"
    id_type: str = "passport"
    id_number: str = "PENDING"

class PublicRoomBooking(BaseModel):
    room_type_id: str
    room_type_name: str
    price_per_night: float
    total_price: float
    guests: int = 1
    rate_plan_id: Optional[str] = None
    rate_plan_name: Optional[str] = None

class PublicAddOn(BaseModel):
    id: str
    name: str
    price: float

class PublicBookingCreate(BaseModel):
    check_in: date
    check_out: date
    guest: PublicGuestCreate
    rooms: List[PublicRoomBooking]
    addons: List[PublicAddOn] = []
    special_requests: Optional[str] = None
    promo_code: Optional[str] = None
    payment_method: Optional[str] = None

class PublicBookingResponse(BaseModel):
    id: str
    booking_number: str
    status: str
    check_in: date
    check_out: date
    total_amount: float
    guest: dict
    rooms: List[dict]



def generate_booking_number() -> str:
    """Unique booking number generate karta hai"""
    timestamp = utcnow().strftime("%Y%m%d")
    unique_part = str(uuid.uuid4())[:6].upper()
    return f"BK{timestamp}{unique_part}"


# --- Guest AI Chat ---

class GuestChatRequest(BaseModel):
    hotel_slug: str
    message: str
    history: List[Dict[str, str]] = [] # [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}]

class GuestChatResponse(BaseModel):
    response: str

from fastapi import Request
from fastapi.responses import StreamingResponse
from app.core.limiter import limiter


# ---------------------------------------------------------------------------
# Pre-warm: populate hotel data cache before first guest message
# ---------------------------------------------------------------------------

@router.post("/chat/warm/{hotel_slug}", status_code=204)
async def prewarm_guest_agent_cache(hotel_slug: str, session: DbSession):
    """
    Pre-warm the hotel data cache for a given slug.
    Call this on widget load so the first guest message hits cache, not DB.
    """
    hotel_id = await resolve_hotel_id(hotel_slug, session)
    from app.core.guest_agent import _fetch_hotel_data
    await _fetch_hotel_data(session, hotel_id)


@router.post("/chat/guest", response_model=GuestChatResponse)
@limiter.limit("5/minute")
async def chat_with_guest_ai(
    request: Request,
    payload: GuestChatRequest,
    session: DbSession
):
    """
    Chat endpoint for hotel guests.
    Uses LLM with tools to answer guest questions.
    """
    try:
        import uuid
        is_uuid = False
        try:
            uuid.UUID(payload.hotel_slug)
            is_uuid = True
        except ValueError:
            pass
            
        if is_uuid:
            query = select(Hotel).where(or_(Hotel.slug == payload.hotel_slug, Hotel.id == payload.hotel_slug))
        else:
            query = select(Hotel).where(Hotel.slug == payload.hotel_slug)
            
        result = await session.execute(query)
        hotel = result.scalar_one_or_none()
        
        if not hotel:
            # Fallback: Check if it's a valid ID but passed as slug
            # (This logic is now covered by the OR condition above)
            raise HTTPException(status_code=404, detail="Hotel not found")

        # Enforce SaaS feature flag guard
        if not getattr(hotel, "feature_guest_bot", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest chatbot feature is not enabled for this hotel"
            )

        # AI-01: per-hotel daily budget backstop (IP limit is spoofable).
        _enforce_hotel_ai_quota(hotel.id)

        # Fetch integration settings for dynamic AI provider/keys
        from app.models.integration import IntegrationSettings
        int_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
        int_res = await session.execute(int_query)
        integration_settings = int_res.scalar_one_or_none()

        # 2. Prepare History (limit to last 20 messages to prevent context blowup)
        from agno.agent import Message
        chat_history = []
        for msg in payload.history[-20:]:
            if msg["role"] == "user":
                chat_history.append(Message(role="user", content=msg["content"]))
            elif msg["role"] == "assistant":
                chat_history.append(Message(role="assistant", content=msg["content"]))

        # Add current message
        messages = chat_history + [Message(role="user", content=payload.message)]

        # 3. Initialize Agent
        from app.core.guest_agent import create_guest_agent_graph
        _max_tokens = (
            getattr(integration_settings, 'ai_max_tokens', None) or getattr(hotel, 'ai_max_tokens', None)
        )
        agent = await create_guest_agent_graph(
            session,
            hotel.id,
            (getattr(integration_settings, 'ai_provider', None) or getattr(hotel, 'ai_provider', None)),
            (getattr(integration_settings, 'ai_api_key', None) or getattr(hotel, 'ai_api_key', None)),
            (getattr(integration_settings, 'ai_model', None) or getattr(hotel, 'ai_model', None)),
            (getattr(integration_settings, 'ai_base_url', None) or getattr(hotel, 'ai_base_url', None)),
            hotel.name,
            _max_tokens,
        )
        if not agent:
            return GuestChatResponse(response="AI Concierge is currently offline for this hotel. Please contact the front desk directly.")

        # 4. Invoke Agent
        try:
            result = await agent.arun(messages)
            # AI-03: record per-hotel token spend for cost visibility.
            from app.core.ai_usage import record_ai_usage
            record_ai_usage(hotel.id, result)
            ai_response = result.content or ""
            return GuestChatResponse(response=ai_response)
        except Exception as invoke_err:
            # Always retry without tools on any agent error (tool failures, model errors, etc.)
            logger.warning(f"Guest agent failed for hotel {hotel.id}, retrying without tools: {invoke_err}")
            try:
                from agno.agent import Agent
                from app.core.guest_agent import get_guest_system_prompt_content

                effective_provider = (getattr(integration_settings, 'ai_provider', None) or getattr(hotel, 'ai_provider', None) or "")
                target_api_key = (getattr(integration_settings, 'ai_api_key', None) or getattr(hotel, 'ai_api_key', None))
                ai_model_name = (getattr(integration_settings, 'ai_model', None) or getattr(hotel, 'ai_model', None))
                ai_base_url_val = (getattr(integration_settings, 'ai_base_url', None) or getattr(hotel, 'ai_base_url', None))
                fallback_max_tokens = _max_tokens or 1024

                effective_provider = (effective_provider or "").lower().strip()
                if not effective_provider:
                    if target_api_key.startswith("gsk_"):
                        effective_provider = "groq"
                    elif target_api_key.startswith("sk-"):
                        effective_provider = "openai"
                    elif target_api_key.startswith("AIza"):
                        effective_provider = "gemini"

                if effective_provider in ("gemini", "google"):
                    from agno.models.google import Gemini
                    fallback_llm = Gemini(
                        id=ai_model_name or "gemini-1.5-flash",
                        api_key=target_api_key,
                        max_output_tokens=fallback_max_tokens or 1024,
                    )
                elif effective_provider == "deepseek":
                    from agno.models.deepseek import DeepSeek
                    fallback_llm = DeepSeek(
                        id=ai_model_name or "deepseek-chat",
                        api_key=target_api_key,
                        max_tokens=fallback_max_tokens or 1024,
                    )
                else:
                    from agno.models.openai import OpenAILike
                    default_base = "https://api.groq.com/openai/v1" if effective_provider == "groq" else None
                    fallback_llm = OpenAILike(
                        id=ai_model_name or ("llama-3.3-70b-versatile" if effective_provider == "groq" else "gpt-4o-mini"),
                        api_key=target_api_key,
                        base_url=ai_base_url_val or default_base,
                        max_tokens=fallback_max_tokens,
                    )

                system_prompt_str = await get_guest_system_prompt_content(session, hotel.id, hotel.name)
                fallback_agent = Agent(model=fallback_llm, instructions=system_prompt_str)
                # Pass full conversation so context isn't lost
                fallback_result = await fallback_agent.arun(messages)
                ai_response = fallback_result.content or ""
                return GuestChatResponse(response=ai_response)
            except Exception as fallback_err:
                logger.error(f"Fallback also failed: {fallback_err}")
                return GuestChatResponse(response="I'm having a moment of confusion. Could you rephrase your question? I'm happy to help!")

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Guest AI Error: {traceback.format_exc()}")
        return GuestChatResponse(response="I'm having trouble connecting. Please try again or reach out directly!")


# ---------------------------------------------------------------------------
# Streaming chat endpoint (SSE)
# ---------------------------------------------------------------------------

@router.post("/chat/guest/stream")
@limiter.limit("5/minute")
async def stream_guest_ai(
    request: Request,
    payload: GuestChatRequest,
    session: DbSession,
):
    """
    Streaming SSE version of the guest chat endpoint.
    Returns tokens as they are generated so the UI can display them progressively.

    SSE format: each event is  data: {"token": "..."}\n\n
    Final event:               data: [DONE]\n\n
    """
    # --- Setup (mirrors regular endpoint) ---
    try:
        import uuid as _uuid

        is_uuid = False
        try:
            _uuid.UUID(payload.hotel_slug)
            is_uuid = True
        except ValueError:
            pass

        query = (
            select(Hotel).where(or_(Hotel.slug == payload.hotel_slug, Hotel.id == payload.hotel_slug))
            if is_uuid
            else select(Hotel).where(Hotel.slug == payload.hotel_slug)
        )
        result = await session.execute(query)
        hotel = result.scalar_one_or_none()
        if not hotel:
            raise HTTPException(status_code=404, detail="Hotel not found")

        if not getattr(hotel, "feature_guest_bot", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest chatbot feature is not enabled for this hotel",
            )

        # AI-01: per-hotel daily budget backstop (IP limit is spoofable).
        _enforce_hotel_ai_quota(hotel.id)

        from app.models.integration import IntegrationSettings
        int_res = await session.execute(
            select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
        )
        integration_settings = int_res.scalar_one_or_none()

        from agno.agent import Message as AgnoMessage
        chat_history_stream = []
        for msg in payload.history[-20:]:
            if msg["role"] == "user":
                chat_history_stream.append(AgnoMessage(role="user", content=msg["content"]))
            elif msg["role"] == "assistant":
                chat_history_stream.append(AgnoMessage(role="assistant", content=msg["content"]))
        messages = chat_history_stream + [AgnoMessage(role="user", content=payload.message)]

        from app.core.guest_agent import create_guest_agent_graph
        _stream_max_tokens = (
            getattr(integration_settings, "ai_max_tokens", None) or getattr(hotel, "ai_max_tokens", None)
        )
        agent = await create_guest_agent_graph(
            session,
            hotel.id,
            (getattr(integration_settings, "ai_provider", None) or getattr(hotel, "ai_provider", None)),
            (getattr(integration_settings, "ai_api_key", None) or getattr(hotel, "ai_api_key", None)),
            (getattr(integration_settings, "ai_model", None) or getattr(hotel, "ai_model", None)),
            (getattr(integration_settings, "ai_base_url", None) or getattr(hotel, "ai_base_url", None)),
            hotel.name,
            _stream_max_tokens,
        )
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        logger.error("Stream setup error: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to initialize AI agent")

    if not agent:
        import json as _json

        async def _offline():
            yield f"data: {_json.dumps({'token': 'AI Concierge is currently offline. Please contact the front desk directly.'})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(_offline(), media_type="text/event-stream")

    import json as _json

    async def _event_gen():
        try:
            from agno.agent import RunContentEvent
            async for event in await agent.arun(messages, stream=True, stream_events=True):
                if isinstance(event, RunContentEvent) and event.content:
                    yield f"data: {_json.dumps({'token': event.content})}\n\n"
        except Exception as exc:
            logger.error("Stream event error: %s", exc)
            yield f"data: {_json.dumps({'error': 'Stream interrupted'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        _event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


