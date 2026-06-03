from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from sqlmodel import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage
import logging

from app.models.booking import Booking, BookingStatus, BookingSource
from app.models.room import RoomType
from app.models.hotel import Hotel, HotelSettings
from app.models.amenity import Amenity
from app.models.lead import Lead
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Explicitly Read-Only System Prompt
SYSTEM_PROMPT = """You are the virtual concierge for '{hotel_name}'.
Your goal is to provide a warm, human-like, and helpful experience for guests.

PERSONALITY & TONE:
1. BE HUMAN: Use a natural, conversational tone. Avoid sounding like a rigid bot.
2. HOTEL IDENTITY: You represent '{hotel_name}'. Always speak on behalf of the hotel.
3. LEAD CAPTURING (CRITICAL): To "Prepare a Booking" or "Send a Booking Link", you MUST first collect the guest's Name and Mobile Number. If they don't provide a mobile number, you cannot prepare the booking.
4. NO OVER-BOOKING: Do not push "Confirm and Book" or "Prepare Booking" repeatedly.
5. EMPATHY: If a guest asks about amenities or features, describe them with enthusiasm (e.g., "You'll love our rooftop pool!" instead of "Pool is available.").

TOOL CALLING RULES (CRITICAL):
1. After calling check_availability, respond to the guest directly with the results. Do NOT automatically call get_room_details or any other tool unless the guest explicitly asks for more details about a specific room.
2. Only call get_room_details when the guest specifically asks: "tell me more about X room", "show me photos", "what's in the X room", etc.
3. Call ONE tool at a time. Never chain tool calls without a guest message in between.

RESPONSE STYLE:
1. CONCISE BUT WARM: Answer specifically but with a hospitable touch.
2. FORMATTING: Use clean bullet points for amenities and simple tables for price comparisons.
3. NO HALLUCINATION: Only use information provided by tools.

IMAGE FORMATTING (CRITICAL):
1. When providing room details or photos, you MUST wrap image URLs in the exact format: [IMAGES: url1, url2].
2. NEVER just list naked URLs. The frontend gallery depends on this [IMAGES: ...] tag.

SAFETY:
1. You have READ-ONLY access.
2. If unsure, say "I'd recommend checking with our front desk for the most precise details on that."

Current Date: {current_date}
"""

def create_guest_agent_graph(
    session: AsyncSession, 
    hotel_id: str, 
    ai_provider: str = None, 
    ai_api_key: str = None,
    ai_model: str = None,
    ai_base_url: str = None,
    hotel_name: str = "the hotel"
):
    """
    Creates a Guest-Facing Agent Graph with dynamic LLM provider injection.
    """
    settings = get_settings()
    
    # --- READ-ONLY TOOLS ---

    @tool
    async def get_hotel_info() -> str:
        """
        Get general hotel information (Address, Contact, Check-in/out times, Policies).
        Use this to answer questions like "Where are you located?" or "What is check-in time?".
        """
        query = select(Hotel).where(Hotel.id == hotel_id)
        result = await session.execute(query)
        hotel = result.scalar_one_or_none()
        if not hotel: return "Hotel information not found."
        
        import json
        return json.dumps({
            "name": hotel.name,
            "description": hotel.description,
            "address": hotel.address,
            "contact": hotel.contact,
            "policies": hotel.settings,
            "star_rating": hotel.star_rating
        })

    @tool
    async def get_hotel_amenities() -> str:
        """
        Get list of amenities available at the hotel (e.g. WiFi, Pool, Parking).
        """
        from app.models.amenity import Amenity, RoomAmenityLink
        from app.models.room import RoomType
        
        # Get all room types for this hotel
        rt_stmt = select(RoomType).where(RoomType.hotel_id == hotel_id)
        rt_res = await session.execute(rt_stmt)
        room_ids = [r.id for r in rt_res.scalars().all()]

        if not room_ids:
            return "No specific amenities configured."

        # Get linked amenities
        link_stmt = select(RoomAmenityLink).where(RoomAmenityLink.room_id.in_(room_ids))
        link_res = await session.execute(link_stmt)
        amenity_ids = {link.amenity_id for link in link_res.scalars().all()}

        if not amenity_ids:
            return "No specific amenities configured."

        am_stmt = select(Amenity).where(Amenity.id.in_(amenity_ids))
        am_res = await session.execute(am_stmt)
        names = list(set([a.name for a in am_res.scalars().all()]))
        
        if not names:
            return "No specific amenities configured."
        return ", ".join(names)

    @tool
    async def check_availability(check_in_date: str, check_out_date: str, guests: str = "2") -> str:
        """
        Check room availability and prices for specific dates.
        Dates must be in YYYY-MM-DD format.
        Returns a list of available rooms and their prices.
        """
        try:
            c_in = date.fromisoformat(check_in_date)
            c_out = date.fromisoformat(check_out_date)
        except ValueError:
            return "Please provide dates in YYYY-MM-DD format."

        rt_query = select(RoomType).where(RoomType.hotel_id == hotel_id)
        rt_res = await session.execute(rt_query)
        room_types = rt_res.scalars().all()
        
        available_options = []
        for rt in room_types:
            available_options.append(f"- {rt.name}: Base Price {rt.base_price} INR/night")

        if not available_options: return "No rooms available."
        return "Available Rooms:\n" + "\n".join(available_options)

    @tool
    async def prepare_booking(
        check_in: str, 
        check_out: str, 
        room_type_name: str, 
        adults: str, 
        children: str,
        first_name: str,
        last_name: str,
        phone: str,
        email: str = "",
        inquiry_summary: str = ""
    ) -> str:
        """
        PREPARES a booking for the guest. 
        You MUST provide the guest's Name and Phone number.
        The inquiry_summary should be a 1-sentence summary of the guest's main request.
        """
        # Safely cast adults/children to int (Groq LLMs sometimes send strings)
        try:
            adults = int(adults)
        except (ValueError, TypeError):
            adults = 1
        try:
            children = int(children)
        except (ValueError, TypeError):
            children = 0
        
        # Validate Phone (Mandatory)
        if not phone or len(phone.strip()) < 8:
            return "I need a valid mobile number to prepare your booking link. Could you please provide it?"
        # 1. Resolve Room Type
        query = select(RoomType).where(
            RoomType.hotel_id == hotel_id,
            RoomType.name.ilike(f"%{room_type_name}%")
        )
        res = await session.execute(query)
        room = res.scalars().first()
        
        if not room:
            return f"Sorry, room type '{room_type_name}' not found."

        # 2. Prepare Metadata for Frontend Redirection
        # We simulate what location.state needs
        booking_data = {
            "checkInDate": check_in,
            "checkOutDate": check_out,
            "guests": adults + children,
            "adults": adults,
            "children": children,
            "rooms": [{
                "id": room.id,
                "name": room.name,
                "base_price": room.base_price,
                "rate_options": [{
                    "id": "standard", # Using first/standard rate plan
                    "name": "Standard Rate",
                    "price_per_night": room.base_price,
                    "total_price": room.base_price * max(1, (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days)
                }]
            }],
            "totalRoomPrice": room.base_price * max(1, (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days),
            "guest_info": {
                "firstName": first_name,
                "lastName": last_name,
                "email": email,
                "phone": phone
            }
        }

        # 3. Save Lead to Database
        from app.models.lead import Lead
        lead = Lead(
            hotel_id=hotel_id,
            guest_name=f"{first_name} {last_name}".strip(),
            guest_email=email,
            guest_phone=phone,
            room_type_preference=room.name,
            check_in=check_in,
            check_out=check_out,
            num_adults=adults,
            num_children=children,
            ai_conversation_summary=inquiry_summary or f"Interested in {room.name}"
        )
        session.add(lead)
        await session.commit()

        # 4. Sync to Google Sheets (if configured)
        from app.models.integration import IntegrationSettings
        int_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
        int_res = await session.execute(int_query)
        int_settings = int_res.scalar_one_or_none()

        if int_settings and int_settings.google_sheet_url:
            from app.core.external_sync import sync_to_google_sheet
            sync_data = {
                "hotel_id": hotel_id,
                "guest_name": lead.guest_name,
                "guest_email": lead.guest_email,
                "guest_phone": lead.guest_phone,
                "room_type": lead.room_type_preference,
                "check_in": lead.check_in,
                "check_out": lead.check_out,
                "adults": lead.num_adults,
                "children": lead.num_children,
                "status": lead.status,
                "timestamp": lead.created_at.isoformat()
            }
            # Run async sync
            import asyncio
            asyncio.create_task(sync_to_google_sheet(int_settings.google_sheet_url, sync_data))
        
        import json
        return f"ACTION:BOOKING_LINK|{json.dumps(booking_data)}"

    @tool
    async def get_room_details(room_name: str) -> str:
        """
        Get detailed description and amenities for a specific room type (e.g., "Deluxe", "Suite").
        Useful when a guest asks "What is in the Deluxe Room?" or "Show me room photos".
        """
        query = select(RoomType).where(RoomType.hotel_id == hotel_id, RoomType.name.ilike(f"%{room_name}%"))
        result = await session.execute(query)
        room = result.scalars().first()
        if not room: return "Room not found."
        
        details = f"**{room.name}**\n- **Description**: {room.description}\n- **Base Price**: {room.base_price} INR"
        if hasattr(room, 'amenities') and room.amenities:
             details += f"\n- **Amenities**: {room.amenities}"
        
        # Add Images Tag
        if hasattr(room, 'photos') and room.photos:
            photo_urls = [p['url'] for p in room.photos if 'url' in p]
            if photo_urls:
                details += f"\n\n[IMAGES: {', '.join(photo_urls)}]"
                
        return details

    tools = [get_hotel_info, get_hotel_amenities, check_availability, get_room_details, prepare_booking]
    
    try:

        # Resolve dynamic provider/keys - NO FALLBACK to platform key to save costs
        target_api_key = ai_api_key
        
        if not target_api_key:
            # Return a "dummy" graph or None to signal that AI is disabled for this hotel
            return None
            
        from langchain_openai import ChatOpenAI
        
        # Determine Base URL based on provider if not explicitly provided
        # Auto-detect Groq if key starts with gsk_ but provider is missing
        effective_provider = ai_provider
        if not effective_provider and target_api_key.startswith("gsk_"):
            effective_provider = "groq"

        default_base_url = None
        if effective_provider == "groq":
            default_base_url = "https://api.groq.com/openai/v1"
        elif effective_provider == "openai":
            default_base_url = None # Use default OpenAI URL
        
        # If no model is provided, we CANNOT initialize (Zero hardcoding)
        if not ai_model:
            return None

        # Hotel name is now passed as parameter, so we just use it directly


        llm = ChatOpenAI(
            model=ai_model,
            temperature=0.7,
            openai_api_key=target_api_key,
            base_url=ai_base_url or default_base_url
        )

        formatted_prompt = SYSTEM_PROMPT.format(
            hotel_name=hotel_name,
            current_date=date.today().isoformat()
        )

        # Create Graph
        graph = create_react_agent(
            model=llm,
            tools=tools,
            prompt=formatted_prompt
        )
        return graph
        
    except Exception as e:
        logger.error(f"Guest agent error: {e}")
        raise
