from typing import List, Optional, Dict, Any
from datetime import date, datetime
import asyncio
import json
import logging

from sqlmodel import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.room import RoomType
from app.models.hotel import Hotel
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are the virtual concierge for '{hotel_name}'.
Your goal is to provide a warm, human-like, professional, and consultative concierge experience for guests.

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

CRITICAL CONVERSATION FLOW & PROTOCOL (MUST FOLLOW IN ORDER):

1. **GREETING & WELCOME (GUEST SAYS HELLO/HI)**:
   - When a guest first greets you (e.g., "Hello", "Hi", "Hey"), respond with a warm, polite, and brief welcome.
   - **DO NOT** show room details, list amenities, mention prices, or ask for their name/phone number yet.
   - Introduce yourself as the virtual concierge for '{hotel_name}' and ask how you can assist them today.
   - Keep this initial reply short and friendly.

2. **GUEST INQUIRY & DISCOVERY PHASE (DATES & GUESTS FIRST)**:
   - If the guest inquires about booking a room, checking rates, or seeking recommendations, you MUST understand their needs BEFORE suggesting any specific rooms or asking for contact details.
   - You MUST ask for:
     a) Their planned check-in and check-out dates.
     b) The number of guests (adults and children).
     c) Their specific preferences (e.g., standard vs premium, spacious suite, view, balcony, bathtub, etc.).
   - **DO NOT** ask for the guest's name or phone number during this phase.
   - **DO NOT** immediately offer or suggest the Deluxe/cheapest room. We want to understand what they are looking for first.

3. **CONSULTATIVE SELLING & UPSELLING (PREMIUM FIRST)**:
   - **NEVER list or dump all available rooms or prices in a single message.** This is spammy and overwhelms the guest.
   - Always suggest the single **most premium/expensive** room type first (e.g., Executive Room or the highest-priced room from the "AVAILABLE ROOM TYPES & RATES" list below) to upsell. Describe its luxurious highlights (e.g. lagoon/mountain views, bathtub, private balcony) and immediately include its image tag `[IMAGES: url1, url2]`.
   - Ask the guest: "Would you like to book our premium [Room Name] for your stay? We also have other comfortable options starting from a lower price point if you prefer."
   - If the guest asks for standard or cheaper options, then politely introduce the Deluxe or lower-tier room type with its images.

4. **IMAGE DISPLAYING RULE (CRITICAL)**:
   - Whenever the guest asks to see a room, asks for photos/images, or says "show me the room" / "show me the image", you MUST output the exact image tag format `[IMAGES: url1, url2...]` in your message.
   - You MUST copy the real image URLs exactly as they are defined under the "AVAILABLE ROOM TYPES & RATES" section or by calling the `get_room_details` tool.
   - **NEVER** output empty tags, empty punctuation, or dots (e.g., NEVER write "For Deluxe room, ."). If you do not have URLs, run `get_room_details` to fetch them.
   - Ensure the URLs in the tag are comma-separated and correct.

5. **NO INFORMATION DUMPING**:
   - Never output all room details, long list of policies, amenities, and booking instructions in a single message.
   - Provide details incrementally as the conversation unfolds naturally.

6. **BOOKING & LEAD CAPTURE (ONLY WHEN READY)**:
   - Only ask for Name and Phone number when the guest explicitly says they want to "book", "confirm", or "get a booking link" AFTER you have gathered dates and selected a room. Never ask for contact info early.

PERSONALITY & STYLE:
- Sound like a professional, friendly hotel receptionist/concierge. Avoid robotic, rigid structures or search-engine-like dumps.
- Use warm, polite, and natural phrasing.

Current Date: {current_date}
"""

# ---------------------------------------------------------------------------
# Cache — hotel static data per hotel_id
# ---------------------------------------------------------------------------

_CACHE_KEY_PREFIX = "guest_agent:hotel_data"
_CACHE_TTL = 86400  # 24 h; actively invalidated on admin edits

# Safe fire-and-forget pattern (prevents GC of background tasks)
_bg_tasks: set = set()


def _fire_and_forget(coro) -> None:
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


def invalidate_guest_agent_cache(hotel_id: str) -> None:
    """Call whenever hotel, room, rate, or amenity data changes."""
    redis_client.delete_key(f"{_CACHE_KEY_PREFIX}:{hotel_id}")


def _cache_get(hotel_id: str) -> Optional[dict]:
    raw = redis_client.get_value(f"{_CACHE_KEY_PREFIX}:{hotel_id}")
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _cache_set(hotel_id: str, data: dict) -> None:
    try:
        redis_client.set_value(
            f"{_CACHE_KEY_PREFIX}:{hotel_id}", json.dumps(data), expire=_CACHE_TTL
        )
    except Exception as exc:
        logger.warning("Guest agent cache write failed: %s", exc)


# ---------------------------------------------------------------------------
# Single DB fetch, cached
# ---------------------------------------------------------------------------

async def _fetch_hotel_data(session: AsyncSession, hotel_id: str) -> Optional[dict]:
    """Return hotel static data from cache; on miss, fetch from DB and cache it."""
    cached = _cache_get(hotel_id)
    if cached:
        return cached

    hotel_res = await session.execute(select(Hotel).where(Hotel.id == hotel_id))
    hotel = hotel_res.scalar_one_or_none()
    if not hotel:
        return None

    rt_res = await session.execute(select(RoomType).where(RoomType.hotel_id == hotel_id))
    room_types = rt_res.scalars().all()

    from app.models.amenity import Amenity, RoomAmenityLink
    amenity_names_str = "No specific amenities configured."
    if room_types:
        room_ids = [r.id for r in room_types]
        link_res = await session.execute(
            select(RoomAmenityLink).where(RoomAmenityLink.room_id.in_(room_ids))
        )
        amenity_ids = {lnk.amenity_id for lnk in link_res.scalars().all()}
        if amenity_ids:
            am_res = await session.execute(
                select(Amenity).where(Amenity.id.in_(amenity_ids))
            )
            amenity_names_str = ", ".join({a.name for a in am_res.scalars().all()})

    data = {
        "hotel": {
            "name": hotel.name,
            "description": hotel.description,
            "address": hotel.address if isinstance(hotel.address, dict) else {},
            "contact": hotel.contact if isinstance(hotel.contact, dict) else {},
            "settings": hotel.settings if isinstance(hotel.settings, dict) else {},
            "star_rating": hotel.star_rating,
        },
        "rooms": [
            {
                "id": rt.id,
                "name": rt.name,
                "base_price": float(rt.base_price),
                "description": rt.description or "",
                "photos": rt.photos if hasattr(rt, "photos") and rt.photos else [],
                "total_inventory": getattr(rt, "total_inventory", 0),
            }
            for rt in room_types
        ],
        "amenity_names": amenity_names_str,
    }
    _cache_set(hotel_id, data)
    return data


# ---------------------------------------------------------------------------
# Prompt builder (from cached dict — no DB needed)
# ---------------------------------------------------------------------------

def _build_formatted_prompt(data: dict, hotel_name: str) -> str:
    hotel = data["hotel"]
    settings = hotel.get("settings", {})
    address = hotel.get("address", {})
    contact = hotel.get("contact", {})

    rooms_context = []
    for rt in data["rooms"]:
        photos_str = ""
        if rt.get("photos"):
            urls = [p["url"] for p in rt["photos"] if "url" in p]
            if urls:
                photos_str = f" | [IMAGES: {', '.join(urls)}]"
        rooms_context.append(
            f"- **{rt['name']}**: {rt['description'] or 'No description available.'}"
            f" | Base Price: {rt['base_price']} INR/night{photos_str}"
        )

    policies = []
    if settings.get("cancellation_policy"):
        policies.append(f"Cancellation Policy: {settings['cancellation_policy']}")
    if settings.get("child_policy"):
        policies.append(f"Child Policy: {settings['child_policy']}")
    if settings.get("payment_policy"):
        policies.append(f"Payment Policy: {settings['payment_policy']}")

    return SYSTEM_PROMPT.format(
        hotel_name=hotel_name,
        address=f"{address.get('street', '')}, {address.get('city', '')}, {address.get('country', '')}",
        contact=f"Phone: {contact.get('phone', '')}, Email: {contact.get('email', '')}",
        check_in_time=settings.get("check_in_time", "14:00"),
        check_out_time=settings.get("check_out_time", "11:00"),
        policies="; ".join(policies) if policies else "Standard hotel policies apply.",
        amenities=data["amenity_names"],
        rooms_info="\n".join(rooms_context) if rooms_context else "No rooms configured.",
        current_date=date.today().isoformat(),
    )


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

async def get_guest_system_prompt_content(
    session: AsyncSession, hotel_id: str, hotel_name: str
) -> str:
    data = await _fetch_hotel_data(session, hotel_id)
    if not data:
        return ""
    return _build_formatted_prompt(data, hotel_name)


# ---------------------------------------------------------------------------
# Agent factory
# ---------------------------------------------------------------------------

async def create_guest_agent_graph(
    session: AsyncSession,
    hotel_id: str,
    ai_provider: str = None,
    ai_api_key: str = None,
    ai_model: str = None,
    ai_base_url: str = None,
    hotel_name: str = "the hotel",
    ai_max_tokens: int = None,
):
    if not ai_api_key or not ai_model:
        return None

    data = await _fetch_hotel_data(session, hotel_id)
    if not data:
        return None

    rooms = data["rooms"]  # list of plain dicts — JSON-safe, no SQLModel objects

    # --- TOOLS (3 tools, down from 5; hotel info + amenities are in system prompt) ---

    async def check_availability(check_in_date: str, check_out_date: str, guests: str = "2") -> str:
        """
        Check real room availability for specific dates.
        Dates must be in YYYY-MM-DD format.
        Returns available rooms with inventory count and price.
        """
        try:
            c_in = date.fromisoformat(check_in_date)
            c_out = date.fromisoformat(check_out_date)
        except ValueError:
            return "Please provide dates in YYYY-MM-DD format (e.g. 2025-12-25)."
        if c_out <= c_in:
            return "Check-out must be after check-in date."

        booked_counts: Dict[str, int] = {}
        try:
            overlap_res = await session.execute(
                select(Booking).where(
                    and_(
                        Booking.hotel_id == hotel_id,
                        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
                        Booking.check_in < c_out,
                        Booking.check_out > c_in,
                    )
                )
            )
            for booking in overlap_res.scalars().all():
                booking_rooms = booking.rooms if isinstance(booking.rooms, list) else []
                for rb in booking_rooms:
                    rt_id = rb.get("room_type_id") if isinstance(rb, dict) else getattr(rb, "room_type_id", None)
                    if rt_id:
                        booked_counts[rt_id] = booked_counts.get(rt_id, 0) + 1
        except Exception as exc:
            logger.warning("Availability DB query failed: %s", exc)

        available = []
        for rt in rooms:
            remaining = rt.get("total_inventory", 0) - booked_counts.get(rt["id"], 0)
            if remaining > 0:
                available.append(
                    f"- {rt['name']}: {remaining} room(s) available | {rt['base_price']} INR/night"
                )

        if not available:
            return f"No rooms available for {check_in_date} to {check_out_date}. Please try different dates."
        return f"Available rooms ({check_in_date} → {check_out_date}):\n" + "\n".join(available)

    async def get_room_details(room_name: str) -> str:
        """
        Get detailed description and photos for a specific room type.
        Use when the guest asks to see a room or wants more details.
        """
        for rt in rooms:
            if room_name.lower() in rt["name"].lower():
                details = (
                    f"**{rt['name']}**\n"
                    f"- **Description**: {rt['description'] or 'No description available.'}\n"
                    f"- **Base Price**: {rt['base_price']} INR/night"
                )
                if rt.get("photos"):
                    urls = [p["url"] for p in rt["photos"] if "url" in p]
                    if urls:
                        details += f"\n\n[IMAGES: {', '.join(urls)}]"
                return details
        return f"Room '{room_name}' not found."

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
        inquiry_summary: str = "",
    ) -> str:
        """
        Prepare a booking link for the guest.
        MUST have: guest Name, Phone, check-in/out dates, and chosen room type.
        The inquiry_summary should be a 1-sentence summary of the guest's request.
        """
        try:
            adults_int = int(adults)
        except (ValueError, TypeError):
            adults_int = 1
        try:
            children_int = int(children)
        except (ValueError, TypeError):
            children_int = 0

        if not phone or len(phone.strip()) < 8:
            return "I need a valid mobile number to prepare your booking link. Could you please provide it?"

        room = next(
            (rt for rt in rooms if room_type_name.lower() in rt["name"].lower()),
            rooms[0] if rooms else None,
        )
        if not room:
            return f"Sorry, room type '{room_type_name}' not found."

        try:
            nights = max(1, (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days)
        except ValueError:
            nights = 1

        booking_data = {
            "checkInDate": check_in,
            "checkOutDate": check_out,
            "guests": adults_int + children_int,
            "adults": adults_int,
            "children": children_int,
            "rooms": [
                {
                    "id": room["id"],
                    "name": room["name"],
                    "base_price": room["base_price"],
                    "rate_options": [
                        {
                            "id": "standard",
                            "name": "Standard Rate",
                            "price_per_night": room["base_price"],
                            "total_price": room["base_price"] * nights,
                        }
                    ],
                }
            ],
            "totalRoomPrice": room["base_price"] * nights,
            "guest_info": {
                "firstName": first_name,
                "lastName": last_name,
                "email": email,
                "phone": phone,
            },
        }

        from app.models.lead import Lead
        lead = Lead(
            hotel_id=hotel_id,
            guest_name=f"{first_name} {last_name}".strip(),
            guest_email=email,
            guest_phone=phone,
            room_type_preference=room["name"],
            check_in=check_in,
            check_out=check_out,
            num_adults=adults_int,
            num_children=children_int,
            ai_conversation_summary=inquiry_summary or f"Interested in {room['name']}",
        )
        session.add(lead)
        await session.commit()
        await session.refresh(lead)  # ensures created_at is populated from DB

        from app.models.integration import IntegrationSettings
        int_res = await session.execute(
            select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
        )
        int_settings = int_res.scalar_one_or_none()
        if int_settings and int_settings.google_sheet_url:
            from app.core.external_sync import sync_to_google_sheet
            sync_payload = {
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
                "timestamp": lead.created_at.isoformat() if lead.created_at else datetime.utcnow().isoformat(),
            }
            _fire_and_forget(sync_to_google_sheet(int_settings.google_sheet_url, sync_payload))

        return f"ACTION:BOOKING_LINK|{json.dumps(booking_data)}"

    tools = [check_availability, get_room_details, prepare_booking]

    try:
        from agno.agent import Agent
        from agno.models.openai import OpenAILike

        effective_provider = ai_provider
        if not effective_provider and ai_api_key.startswith("gsk_"):
            effective_provider = "groq"
        default_base_url = "https://api.groq.com/openai/v1" if effective_provider == "groq" else None

        llm_model = OpenAILike(
            id=ai_model,
            api_key=ai_api_key,
            base_url=ai_base_url or default_base_url,
            max_tokens=ai_max_tokens or 1024,
        )

        formatted_prompt = _build_formatted_prompt(data, hotel_name)

        return Agent(
            model=llm_model,
            tools=tools,
            instructions=formatted_prompt,
            markdown=True,
        )
    except Exception as exc:
        logger.error("Guest agent error: %s", exc)
        raise
