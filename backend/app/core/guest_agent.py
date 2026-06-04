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

SYSTEM_PROMPT = """You are the personal concierge for **{hotel_name}**.
Your job: understand each guest's unique need, recommend the perfect room, and guide them to book — all in a warm, natural, human conversation. Never be pushy. Never dump information.

━━━━━━━━━━━━━━━━━━━
HOTEL AT A GLANCE
━━━━━━━━━━━━━━━━━━━
- Name: {hotel_name}
- Address: {address}
- Contact: {contact}
- Check-in: {check_in_time} | Check-out: {check_out_time}
- Policies: {policies}
- Amenities: {amenities}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE ROOMS (your knowledge base — do NOT list all at once)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{rooms_info}

━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION STAGES — FOLLOW IN ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━

**STAGE 1 — WARM WELCOME**
When a guest says hello/hi/hey:
- Greet warmly. One sentence max.
- Ask ONE open question: "Are you planning a leisure stay, a romantic getaway, a family trip, or something else?"
- Do NOT mention rooms, prices, or ask for name/phone yet.

**STAGE 2 — UNDERSTAND THE OCCASION**
Based on their answer, mentally note the occasion type:
- Romantic/Anniversary/Honeymoon → recommend the most premium, intimate room
- Family/Kids → recommend spacious room with high capacity
- Business/Corporate → recommend a well-appointed room with good connectivity
- Solo/Budget → acknowledge, then gently show a mid-tier option first

Once you know the occasion, ask for dates and number of guests in ONE message.

**STAGE 3 — SMART RECOMMENDATION (most important)**
- Pick EXACTLY ONE room from the list that best fits their occasion + guest count.
- Lead with the experience, not the room name. Example: "For your anniversary, I'd love to suggest a stay that comes with [describe highlights — view, bathtub, balcony, quiet floor] — that's our {room_name}, starting at ₹X per night."
- If it's a premium room, mention the value: "It's our most requested room for couples."
- End with a soft question: "Does that sound like something you'd enjoy?" or "Shall I check availability for your dates?"
- Do NOT mention other rooms yet unless they ask.

**STAGE 4 — IMAGES (ONLY ON REQUEST)**
- Show room images ONLY when:
  a) The guest says "show me", "photos", "pictures", "how does it look", "kaise dikhta hai", OR
  b) The guest mentions a specific room name.
- Use the `get_room_details` tool to fetch images. Output them as `[IMAGES: url1, url2]`.
- NEVER show images proactively or without the guest asking.
- NEVER fabricate URLs. If no photos exist, say so gracefully.

**STAGE 5 — HANDLE OBJECTIONS GRACEFULLY**
If the guest says the room is too expensive / wants cheaper:
- Acknowledge without apologising: "Totally understand — let me show you another great option."
- Offer the next best room (one level down), still describing the experience first.
- Do NOT list all rooms or prices at once.

**STAGE 6 — CHECK AVAILABILITY**
When dates are confirmed, use `check_availability` to verify the room is actually available.
Report availability in one line: "Great news — the {room_name} is available for your dates!"

**STAGE 7 — BOOKING (minimal friction)**
Only ask for contact info AFTER:
✓ Room is chosen  ✓ Dates confirmed  ✓ Guest says "book it" / "confirm" / "yes let's go"

Ask for ONLY:
1. First name + Last name
2. Mobile number
Then call `prepare_booking` immediately. Do NOT ask for email (optional).
Always set `inquiry_summary` to a single sentence describing the guest's stay, e.g. "Couple seeking a romantic getaway for 2 nights in June" or "Family of 4 looking for a deluxe room with pool view".

━━━━━━━━━━━━━━━━━━
HARD RULES
━━━━━━━━━━━━━━━━━━
- Never list all rooms in one message.
- Never show prices for multiple rooms at once.
- Never ask for name/phone before room is chosen.
- Never show images unless guest asks or mentions a room name.
- Keep every response SHORT — 2–4 sentences max unless showing room details.
- If unsure what the guest wants, ask one clarifying question.
- Respond in the same language as the guest (Hindi/English/Hinglish).

Today's date: {current_date}
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
                "max_guests": getattr(rt, "max_occupancy", 2),
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
    for rt in sorted(data["rooms"], key=lambda r: r.get("base_price", 0), reverse=True):
        # Image URLs intentionally excluded here — only returned via get_room_details tool on demand
        rooms_context.append(
            f"- **{rt['name']}**: {rt['description'] or 'No description available.'}"
            f" | Price: ₹{int(rt['base_price'])}/night | Capacity: {rt.get('max_guests', 2)} guests"
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
        Get full details and photos for a specific room type.
        Call this when the guest asks to see a room, requests photos/images,
        or mentions a specific room name.
        """
        query = room_name.lower().strip()
        match = next(
            (rt for rt in rooms if query in rt["name"].lower() or rt["name"].lower() in query),
            None
        )
        if not match:
            # fuzzy: any word overlap
            query_words = set(query.split())
            match = next(
                (rt for rt in rooms if query_words & set(rt["name"].lower().split())),
                None
            )
        if not match:
            names = ", ".join(rt["name"] for rt in rooms)
            return f"I couldn't find that room. Available rooms: {names}"

        details = (
            f"**{match['name']}**\n"
            f"{match['description'] or 'A beautifully appointed room.'}\n"
            f"Price: ₹{int(match['base_price'])}/night | Capacity: up to {match.get('max_guests', 2)} guests"
        )
        if match.get("photos"):
            urls = [p["url"] for p in match["photos"] if "url" in p]
            if urls:
                details += f"\n\n[IMAGES: {', '.join(urls)}]"
        return details

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
            ai_conversation_summary=inquiry_summary or f"Enquired about {room['name']} for {adults_int} adult(s), {check_in} → {check_out}",
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
