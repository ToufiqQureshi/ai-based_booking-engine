from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from sqlmodel import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage

from app.models.booking import Booking, BookingStatus, BookingSource
from app.models.room import RoomType
from app.models.hotel import Hotel, HotelSettings
from app.models.amenity import Amenity
from app.core.config import get_settings

# Explicitly Read-Only System Prompt
SYSTEM_PROMPT = """You are 'Saaraa AI', a helpful and polite concierge for the hotel.
Your role is to assist prospective guests with information about the hotel, rooms, and availability.

BOOKING ASSISTANCE (NEW):
1. You can now help guests PREPARE a booking.
2. If a guest wants to book, first ask for their:
   - Check-in & Check-out dates (if not provided)
   - Number of Adults & Children
   - Their Full Name, Email, and Phone Number (to pre-fill the form)
3. Once you have these details, use the 'prepare_booking' tool. 
4. CRITICAL: You MUST include the EXACT STRING returned by 'prepare_booking' in your message. This string contains the 'ACTION:BOOKING_LINK|' marker and is necessary for the guest to continue to payment.
5. You CANNOT finalize a booking or take payment yourself.

SAFETY RULES (CRITICAL):
1. You have READ-ONLY access to the database. You cannot create actual booking records.
2. If a guest asks for something you can't do, stay polite.
3. NEVER fake or hallucinate prices. Only use 'check_availability' or 'prepare_booking' to get real rates.
4. If you don't know an answer, say "I am not sure, please contact the hotel reception."

DATE HANDLING (IMPORTANT):
- Convert dates to 'YYYY-MM-DD' before calling tools.

Current Date: {current_date}
"""

def create_guest_agent_graph(session: AsyncSession, hotel_id: str):
    """
    Creates a Guest-Facing Agent Graph using local Ollama model.
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
    async def check_availability(check_in_date: str, check_out_date: str, guests: int = 2) -> str:
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
        adults: int, 
        children: int,
        first_name: str = "",
        last_name: str = "",
        email: str = "",
        phone: str = ""
    ) -> str:
        """
        PREPARES a booking for the guest. 
        Call this when you have specific dates, room type, and guest details.
        Returns a special action marker for the frontend.
        """
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
        return details

    tools = [get_hotel_info, get_hotel_amenities, check_availability, get_room_details, prepare_booking]
    
    try:

        if settings.GROQ_API_KEY:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model="openai/gpt-oss-120b",
                temperature=1,
                openai_api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
        else:
            raise ValueError("GROQ_API_KEY is not configured in backend environment.")

        formatted_prompt = SYSTEM_PROMPT.format(current_date=date.today().isoformat())

        # Create Graph
        graph = create_react_agent(
            model=llm,
            tools=tools,
            prompt=formatted_prompt
        )
        return graph
        
    except Exception as e:
        print(f"DEBUG ERROR: {e}")
        raise
