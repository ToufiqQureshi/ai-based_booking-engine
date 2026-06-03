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
from langchain_core.messages import HumanMessage, AIMessage

class GuestChatRequest(BaseModel):
    hotel_slug: str
    message: str
    history: List[Dict[str, str]] = [] # [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello"}]

class GuestChatResponse(BaseModel):
    response: str

from fastapi import Request
from app.core.limiter import limiter

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

        # Fetch integration settings for dynamic AI provider/keys
        from app.models.integration import IntegrationSettings
        int_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel.id)
        int_res = await session.execute(int_query)
        integration_settings = int_res.scalar_one_or_none()

        # 2. Prepare History
        messages = []
        for msg in payload.history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        
        # Add current message
        messages.append(HumanMessage(content=payload.message))

        # 3. Initialize Agent
        from app.core.guest_agent import create_guest_agent_graph
        agent = await create_guest_agent_graph(
            session, 
            hotel.id, 
            getattr(integration_settings, 'ai_provider', None) if integration_settings else getattr(hotel, 'ai_provider', None), 
            getattr(integration_settings, 'ai_api_key', None) if integration_settings else getattr(hotel, 'ai_api_key', None),
            getattr(integration_settings, 'ai_model', None) if integration_settings else None,
            getattr(integration_settings, 'ai_base_url', None) if integration_settings else None,
            hotel.name
        )
        if not agent:
            return GuestChatResponse(response="AI Concierge is currently offline for this hotel. Please contact the front desk directly.")

        # 4. Invoke Agent
        # LangGraph inputs: {"messages": [...]}
        try:
            response = await agent.ainvoke({"messages": messages})
            ai_msg = response["messages"][-1]
            return GuestChatResponse(response=ai_msg.content)
        except Exception as invoke_err:
            err_str = str(invoke_err)
            # Groq/Llama tool_use_failed: model generated malformed function call syntax.
            # Retry once without tools so the guest still gets a helpful reply.
            if "tool_use_failed" in err_str or "failed_generation" in err_str or "400" in err_str:
                logger.warning(f"Tool use failed for hotel {hotel.id}, retrying without tools: {invoke_err}")
                try:
                    from langchain_openai import ChatOpenAI
                    from langchain_core.messages import SystemMessage
                    from app.core.guest_agent import SYSTEM_PROMPT
                    from datetime import date as _date

                    effective_provider = getattr(integration_settings, 'ai_provider', None) if integration_settings else getattr(hotel, 'ai_provider', None)
                    target_api_key = getattr(integration_settings, 'ai_api_key', None) if integration_settings else getattr(hotel, 'ai_api_key', None)
                    ai_model_name = getattr(integration_settings, 'ai_model', None) if integration_settings else getattr(hotel, 'ai_model', None)
                    ai_base_url_val = getattr(integration_settings, 'ai_base_url', None) if integration_settings else None

                    if not effective_provider and target_api_key and target_api_key.startswith("gsk_"):
                        effective_provider = "groq"
                    default_base = "https://api.groq.com/openai/v1" if effective_provider == "groq" else None

                    plain_llm = ChatOpenAI(
                        model=ai_model_name,
                        temperature=0.7,
                        openai_api_key=target_api_key,
                        base_url=ai_base_url_val or default_base
                    )
                    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(
                        hotel_name=hotel.name,
                        current_date=_date.today().isoformat()
                    ))
                    fallback_resp = await plain_llm.ainvoke([system_msg] + messages)
                    return GuestChatResponse(response=fallback_resp.content)
                except Exception as fallback_err:
                    logger.error(f"Fallback also failed: {fallback_err}")
                    return GuestChatResponse(response="I'm having a moment of confusion. Could you rephrase your question? I'm happy to help!")
            raise

    except Exception as e:
        import traceback
        logger.error(f"Guest AI Error: {traceback.format_exc()}")
        return GuestChatResponse(response="I'm having trouble connecting. Please try again or reach out directly!")


