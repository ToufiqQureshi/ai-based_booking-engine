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
Your goal is to provide a warm, human-like, consultative, and helpful experience for guests.

HOTEL INFORMATION & POLICIES:
- Hotel Name: {hotel_name}
- Address: {address}
- Contact Details: {contact}
- Check-in Time: {check_in_time}
- Check-out Time: {check_out_time}
- Cancellation & Other Policies: {policies}
- Hotel Amenities: {amenities}

AVAILABLE ROOM TYPES & RATES:
{rooms_info}

CONVERSATION FLOW & RULES (CRITICAL):
1. **GREETINGS & INTAKE**: If the guest greets you (e.g., "Hello", "Hi", "Hey"), respond with a warm, brief welcome. Do NOT list room details, amenities, rates, or ask for their booking details immediately. Keep it conversational: greet them and ask how you can assist with their stay today.
2. **DISCOVERY FIRST**: Before recommending specific rooms or pushing a booking link, try to understand their trip. Ask for their travel dates (check-in and check-out) and the number of guests if they haven't provided them yet.
3. **NO INFO DUMPING**: Never list all room types, description blocks, prices, amenities, and booking instructions in one message. It overwhelms the guest. Share details incrementally. For instance, ask if they prefer standard accommodations or something more premium/spacious.
4. **CONSULTATIVE SELLING**: Mention room types selectively. Highlight premium or expensive rooms naturally if the guest expresses interest in luxury, space, balcony views, or high-end amenities.
5. **LEAD CAPTURING TIMING**: Only ask for Name and Mobile number when the guest explicitly says they want to "book", "confirm", or "get a booking link". Never ask for lead info during initial greeting or early questions about general hotel rules.

PERSONALITY & TONE:
1. BE HUMAN: Use a natural, friendly, conversational tone. Avoid sounding like a rigid, structured robot.
2. HOTEL IDENTITY: You represent '{hotel_name}'. Always speak on behalf of the hotel.
3. EMPATHY: Describe hotel features with hospitality and enthusiasm (e.g., "You'll love our lagoon views!" instead of "Lagoon view is available.").

RESPONSE STYLE:
1. CONCISE & POLITE: Answer specifically but with a hospitable touch. Keep responses brief.
2. FORMATTING: Use clean bullet points for room highlights only when asked. Keep it easy to read on mobile.
3. NO HALLUCINATION: Only use information provided in this prompt or by tools.

IMAGE FORMATTING:
1. When describing room details or sharing photos, you MUST wrap image URLs in the exact format: [IMAGES: url1, url2].
2. NEVER just list naked URLs. The frontend gallery depends on this [IMAGES: ...] tag.

SAFETY:
1. You have READ-ONLY access.
2. If unsure about dynamic availability or info not listed above, use tool check_availability. If completely unknown, say "I'd recommend checking with our front desk for the most precise details on that."

Current Date: {current_date}
"""

async def create_guest_agent_graph(
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
    
    # Prefetch hotel static info
    query = select(Hotel).where(Hotel.id == hotel_id)
    result = await session.execute(query)
    hotel = result.scalar_one_or_none()
    if not hotel: 
        return None

    # Prefetch room types
    rt_query = select(RoomType).where(RoomType.hotel_id == hotel_id)
    rt_res = await session.execute(rt_query)
    room_types = rt_res.scalars().all()

    # Prefetch amenities
    from app.models.amenity import Amenity, RoomAmenityLink
    amenity_names_str = "No specific amenities configured."
    if room_types:
        room_ids = [r.id for r in room_types]
        link_stmt = select(RoomAmenityLink).where(RoomAmenityLink.room_id.in_(room_ids))
        link_res = await session.execute(link_stmt)
        amenity_ids = {link.amenity_id for link in link_res.scalars().all()}
        if amenity_ids:
            am_stmt = select(Amenity).where(Amenity.id.in_(amenity_ids))
            am_res = await session.execute(am_stmt)
            names = list(set([a.name for a in am_res.scalars().all()]))
            if names:
                amenity_names_str = ", ".join(names)

    # Format room info context with image tags directly
    rooms_context = []
    for rt in room_types:
        photos_str = ""
        if hasattr(rt, 'photos') and rt.photos:
            photo_urls = [p['url'] for p in rt.photos if 'url' in p]
            if photo_urls:
                photos_str = f" | [IMAGES: {', '.join(photo_urls)}]"
        rooms_context.append(
            f"- **{rt.name}**: {rt.description or 'No description available.'} | Base Price: {rt.base_price} INR/night{photos_str}"
        )
    rooms_info = "\n".join(rooms_context) if rooms_context else "No rooms configured."

    hotel_settings = hotel.settings if isinstance(hotel.settings, dict) else {}
    check_in_time = hotel_settings.get("check_in_time", "14:00")
    check_out_time = hotel_settings.get("check_out_time", "11:00")
    
    # Construct policies text
    policies = []
    if hotel_settings.get("cancellation_policy"):
        policies.append(f"Cancellation Policy: {hotel_settings['cancellation_policy']}")
    if hotel_settings.get("child_policy"):
        policies.append(f"Child Policy: {hotel_settings['child_policy']}")
    if hotel_settings.get("payment_policy"):
        policies.append(f"Payment Policy: {hotel_settings['payment_policy']}")
    policies_str = "; ".join(policies) if policies else "Standard hotel policies apply."

    # --- READ-ONLY TOOLS ---

    @tool
    async def get_hotel_info() -> str:
        """
        Get general hotel information (Address, Contact, Check-in/out times, Policies).
        """
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
        return amenity_names_str

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
        try:
            adults = int(adults)
        except (ValueError, TypeError):
            adults = 1
        try:
            children = int(children)
        except (ValueError, TypeError):
            children = 0
        
        if not phone or len(phone.strip()) < 8:
            return "I need a valid mobile number to prepare your booking link. Could you please provide it?"
        
        # Resolve Room Type
        room = None
        for rt in room_types:
            if room_type_name.lower() in rt.name.lower():
                room = rt
                break
        
        if not room and room_types:
            room = room_types[0] # Fallback to first room type if mismatch
        
        if not room:
            return f"Sorry, room type '{room_type_name}' not found."

        # Prepare Metadata for Frontend Redirection
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
                    "id": "standard",
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

        # Save Lead to Database
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

        # Sync to Google Sheets
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
            import asyncio
            asyncio.create_task(sync_to_google_sheet(int_settings.google_sheet_url, sync_data))
        
        import json
        return f"ACTION:BOOKING_LINK|{json.dumps(booking_data)}"

    @tool
    async def get_room_details(room_name: str) -> str:
        """
        Get detailed description and amenities for a specific room type (e.g., "Deluxe", "Suite").
        """
        for rt in room_types:
            if room_name.lower() in rt.name.lower():
                details = f"**{rt.name}**\n- **Description**: {rt.description}\n- **Base Price**: {rt.base_price} INR"
                if hasattr(rt, 'amenities') and rt.amenities:
                     details += f"\n- **Amenities**: {rt.amenities}"
                if hasattr(rt, 'photos') and rt.photos:
                    photo_urls = [p['url'] for p in rt.photos if 'url' in p]
                    if photo_urls:
                        details += f"\n\n[IMAGES: {', '.join(photo_urls)}]"
                return details
        return "Room not found."

    tools = [get_hotel_info, get_hotel_amenities, check_availability, get_room_details, prepare_booking]
    
    try:
        target_api_key = ai_api_key
        if not target_api_key:
            return None
            
        from langchain_openai import ChatOpenAI
        
        effective_provider = ai_provider
        if not effective_provider and target_api_key.startswith("gsk_"):
            effective_provider = "groq"

        default_base_url = None
        if effective_provider == "groq":
            default_base_url = "https://api.groq.com/openai/v1"
        elif effective_provider == "openai":
            default_base_url = None
        
        if not ai_model:
            return None

        llm = ChatOpenAI(
            model=ai_model,
            temperature=0.7,
            openai_api_key=target_api_key,
            base_url=ai_base_url or default_base_url
        )

        # Inject check-in/checkout details and room configurations directly into formatted system prompt
        formatted_prompt = SYSTEM_PROMPT.format(
            hotel_name=hotel_name,
            address=f"{hotel.address.get('street', '')}, {hotel.address.get('city', '')}, {hotel.address.get('country', '')}",
            contact=f"Phone: {hotel.contact.get('phone', '')}, Email: {hotel.contact.get('email', '')}",
            check_in_time=check_in_time,
            check_out_time=check_out_time,
            policies=policies_str,
            amenities=amenity_names_str,
            rooms_info=rooms_info,
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
