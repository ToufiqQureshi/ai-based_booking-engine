from typing import List, Optional, Any, Dict
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status, BackgroundTasks
from sqlmodel import select, and_, or_
from pydantic import BaseModel, EmailStr
import uuid
import logging
from app.core.database import get_session
from app.core.deps import DbSession
from app.core.ai_usage import (
    enforce_ai_token_quota,
    record_ai_usage as _record_ai_usage,
    persist_ai_usage_db as _persist_ai_usage_db,
)
from app.brand_console.hotel import Hotel, HotelRead
from app.rooms.room import RoomType, RoomTypeRead, RoomBlock
from app.bookings.booking import Booking, BookingStatus, Guest
from app.rate_plans.rates_model import RatePlan, RoomRate
from app.rate_plans.promo import PromoCode
from app.core.redis_client import redis_client
import json
from app.services.email_service import get_email_service
from app.core.time import utcnow

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

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
    guest_email: Optional[str] = None

class GuestChatResponse(BaseModel):
    response: str

from fastapi import Request
from fastapi.responses import StreamingResponse
from app.core.limiter import limiter, get_real_ip


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

        # AI-01: enforce per-agent daily token budget from subscription (IP limit is spoofable).
        await enforce_ai_token_quota("guest", hotel.id, session)

        # Fetch integration settings for dynamic AI provider/keys
        from app.integration.integration import IntegrationSettings
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
        from app.core.vault import get_hotel_ai_key
        _ai_key = await get_hotel_ai_key(session, integration_settings, hotel)
        agent = await create_guest_agent_graph(
            session,
            hotel.id,
            (getattr(integration_settings, 'ai_provider', None) or getattr(hotel, 'ai_provider', None)),
            _ai_key,
            (getattr(integration_settings, 'ai_model', None) or getattr(hotel, 'ai_model', None)),
            (getattr(integration_settings, 'ai_base_url', None) or getattr(hotel, 'ai_base_url', None)),
            hotel.name,
            _max_tokens,
            payload.guest_email,
        )
        if not agent:
            return GuestChatResponse(response="AI Concierge is currently offline for this hotel. Please contact the front desk directly.")

        # 4. Invoke Agent
        try:
            result = await agent.arun(messages)
            # Identify the guest by email if shared, else by client IP, so we
            # can report real distinct-visitor counts (not token estimates).
            _guest_id = payload.guest_email or get_real_ip(request)
            _record_ai_usage(hotel.id, result, agent_type="guest", user_identifier=_guest_id)
            await _persist_ai_usage_db(hotel.id, result, agent_type="guest", user_identifier=_guest_id)
            ai_response = result.content or ""
            return GuestChatResponse(response=ai_response)
        except Exception as invoke_err:
            # Always retry without tools on any agent error (tool failures, model errors, etc.)
            logger.warning(f"Guest agent failed for hotel {hotel.id}, retrying without tools: {invoke_err}")
            try:
                from agno.agent import Agent
                from app.core.guest_agent import get_guest_system_prompt_content

                effective_provider = (getattr(integration_settings, 'ai_provider', None) or getattr(hotel, 'ai_provider', None) or "")
                target_api_key = _ai_key  # already resolved from Vault above
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
                        # AI-FIX: the no-tools fallback runs AFTER a failed paid
                        # call, so it must stay on the CHEAP 8B model. It used to
                        # default to the ~10x pricier 70B model, which meant every
                        # transient error doubled spend AND jumped to a costlier
                        # model — exactly the wrong direction during an error storm.
                        id=ai_model_name or ("llama-3.1-8b-instant" if effective_provider == "groq" else "gpt-4o-mini"),
                        api_key=target_api_key,
                        base_url=ai_base_url_val or default_base,
                        max_tokens=fallback_max_tokens,
                    )

                system_prompt_str = await get_guest_system_prompt_content(session, hotel.id, hotel.name, payload.guest_email)
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

        # AI-01: enforce per-agent daily token budget from subscription (IP limit is spoofable).
        await enforce_ai_token_quota("guest", hotel.id, session)

        from app.integration.integration import IntegrationSettings
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
        from app.core.vault import get_hotel_ai_key
        _stream_max_tokens = (
            getattr(integration_settings, "ai_max_tokens", None) or getattr(hotel, "ai_max_tokens", None)
        )
        _stream_ai_key = await get_hotel_ai_key(session, integration_settings, hotel)
        agent = await create_guest_agent_graph(
            session,
            hotel.id,
            (getattr(integration_settings, "ai_provider", None) or getattr(hotel, "ai_provider", None)),
            _stream_ai_key,
            (getattr(integration_settings, "ai_model", None) or getattr(hotel, "ai_model", None)),
            (getattr(integration_settings, "ai_base_url", None) or getattr(hotel, "ai_base_url", None)),
            hotel.name,
            _stream_max_tokens,
            payload.guest_email,
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

    # Capture the guest identity for usage accounting before entering the
    # generator (request object is still in scope here).
    _stream_guest_id = payload.guest_email or get_real_ip(request)

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
            # Record usage once the stream finishes. Agno stores the completed
            # run (with token metrics) on the agent after streaming.
            try:
                _final = getattr(agent, "run_response", None)
                _record_ai_usage(hotel.id, _final, agent_type="guest", user_identifier=_stream_guest_id)
                await _persist_ai_usage_db(hotel.id, _final, agent_type="guest", user_identifier=_stream_guest_id)
            except Exception:
                pass
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



