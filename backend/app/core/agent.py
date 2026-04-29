from typing import List, Optional, Dict, Any
from datetime import date, timedelta, datetime
from sqlmodel import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage

from app.core.config import get_settings
from app.models.timeline import BookingTimeline
from app.models.booking import Booking, BookingStatus, BookingSource, Guest
from app.models.room import RoomType
from app.models.user import User
from app.models.competitor import Competitor, CompetitorRate

# Import New Smart Tools
from app.core.tools.weather import get_weather_forecast
from app.core.tools.events import get_local_events
from app.core.tools.reporting import generate_pdf_report

from app.core.tools.actions import logic_update_room_price, logic_create_promo_code

# System Prompt specialized for Staybooker
SYSTEM_PROMPT = """You are 'Staybooker AI', a smart hotel assistant.
GOAL: Help the hotelier manage bookings, revenue, and tasks directly and professionally.

### COMMUNICATION STYLE 🗣️
- **Language**: Hinglish (Hindi+English mix) or English. Match the user's language.
- **Tone**: Concise, Professional, Direct. NO fluff.
- **Formatting**: Use Markdown (lists, bolding) for readability.

### CRITICAL RULES ⚡
3. **Direct Answers Only**: 
   - "How many pending bookings?" -> Use `get_pending_approvals`. IGNORE 'today' filter. Return ALL pending.
   - "Pending payments?" -> Use `get_pending_payments`.
4. **Safe Actions**: For modifications (price update, cancel), ALWAYS ask for explicit confirmation first.
5. **Smart Pricing**: Check Weather/Events/Web Search before suggesting price changes.
6. **Reasoning First**: ALWAYS explain 'WHY' before recommending an action. Cite data (e.g. "Because of Coldplay concert...").
7. **Use Web Search**: If you lack context (e.g. "Is it a holiday?"), use `search_web`.

### CURRENT CONTEXT
- Date: {current_date}
- Hotel Location: {city}
"""

def create_agent_executor(session: AsyncSession, user: User):
    """
    Creates an Agent Graph instance with tools bound to the current user and database session.
    """
    settings = get_settings()
    # Note: OpenAI Key check removed as we are using Ollama now
    # if not settings.OPENAI_API_KEY:
    #     raise ValueError("OPENAI_API_KEY is not set in configuration.")

    # --- TOOLS ---

    @tool
    async def get_dashboard_stats(days: int = 30) -> Dict[str, Any]:
        """
        Get consolidated dashboard stats (Revenue, Occupancy, Bookings) for the last N days.
        Useful for growth analysis and performance review.
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        # 1. Fetch relevant bookings
        query = select(Booking).where(
            Booking.hotel_id == user.hotel_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
            Booking.check_in >= start_date,
            Booking.check_in <= end_date
        )
        result = await session.execute(query)
        bookings = result.scalars().all()

        total_revenue = sum(b.total_amount for b in bookings)
        total_bookings = len(bookings)

        # Inventory for occupancy
        inventory_result = await session.execute(
            select(func.sum(RoomType.total_inventory)).where(RoomType.hotel_id == user.hotel_id)
        )
        total_inventory = inventory_result.scalar() or 0

        # Calculate approximate occupancy
        occupancy_rate = 0
        if total_inventory > 0 and days > 0:
            total_capacity = total_inventory * days
            occupied_nights = 0
            for b in bookings:
                nights = (min(b.check_out, end_date) - max(b.check_in, start_date)).days
                if nights > 0:
                    occupied_nights += nights * len(b.rooms)

            occupancy_rate = int((occupied_nights / total_capacity) * 100)

        # 2. Get breakdown by status (including PENDING)
        status_query = select(Booking.status, func.count(Booking.id)).where(
            Booking.hotel_id == user.hotel_id,
            Booking.check_in >= start_date
        ).group_by(Booking.status)
        
        status_res = await session.execute(status_query)
        status_counts = {s: c for s, c in status_res.all()}

        return {
            "period": f"Last {days} days",
            "total_revenue": total_revenue,
            "total_bookings": total_bookings,
            "occupancy_rate": f"{occupancy_rate}%",
            "net_profit_est": total_revenue * 0.7,
            "bookings_by_status": status_counts # Includes pending, confirmed, etc.
        }

    @tool
    async def search_bookings(query_str: str) -> List[Dict[str, Any]]:
        """
        Search for bookings by Guest Name (first or last) or Booking Number.
        Returns a list of matching bookings with details.
        """
        from app.models.booking import Guest

        results = []

        # 1. Search by Booking Number
        q_num = select(Booking).where(
            Booking.hotel_id == user.hotel_id,
            Booking.booking_number.ilike(f"%{query_str}%")
        )
        res_num = await session.execute(q_num)
        bookings_num = res_num.scalars().all()
        results.extend(bookings_num)

        # 2. Search by Guest Name
        q_name = select(Booking).join(Guest).where(
            Booking.hotel_id == user.hotel_id,
            (Guest.first_name.ilike(f"%{query_str}%")) | (Guest.last_name.ilike(f"%{query_str}%"))
        )
        res_name = await session.execute(q_name)
        bookings_name = res_name.scalars().all()

        # Deduplicate
        seen = set()
        unique_results = []
        for b in results + bookings_name:
            if b.id not in seen:
                seen.add(b.id)
                unique_results.append(b)

        formatted = []
        for b in unique_results:
            formatted.append({
                "booking_number": b.booking_number,
                "status": b.status,
                "check_in": b.check_in.isoformat(),
                "check_out": b.check_out.isoformat(),
                "amount": b.total_amount,
                "guest_id": b.guest_id
            })
        return formatted

    @tool
    async def get_booking_details(booking_number: str) -> str:
        """
        Get full details of a specific booking including guest info.
        """
        query = select(Booking).where(
            Booking.hotel_id == user.hotel_id,
            Booking.booking_number == booking_number
        )
        result = await session.execute(query)
        booking = result.scalar_one_or_none()
        if not booking:
            return "Booking not found."

        from app.models.booking import Guest
        guest_res = await session.execute(select(Guest).where(Guest.id == booking.guest_id))
        guest = guest_res.scalar_one_or_none()

        details = f"""
        Booking: {booking.booking_number}
        Guest: {guest.first_name if guest else 'Unknown'} {guest.last_name if guest else ''}
        Status: {booking.status}
        Dates: {booking.check_in} to {booking.check_out}
        Amount: {booking.total_amount}
        Rooms: {booking.rooms}
        """
        return details

    @tool
    async def cancel_booking(booking_number: str) -> str:
        """
        Cancels a booking with the given booking number.
        WARNING: This action cannot be undone easily.
        """
        query = select(Booking).where(
            Booking.hotel_id == user.hotel_id,
            Booking.booking_number == booking_number
        )
        result = await session.execute(query)
        booking = result.scalar_one_or_none()

        if not booking:
            return f"Booking {booking_number} not found."

        if booking.status == BookingStatus.CANCELLED:
            return f"Booking {booking_number} is already cancelled."

        booking.status = BookingStatus.CANCELLED
        session.add(booking)
        await session.commit()
        await session.refresh(booking)

        return f"Booking {booking_number} has been successfully cancelled."

    @tool
    async def analyze_rate_competitiveness(days: int = 7) -> str:
        """
        Analyzes the hotel's rates against competitors for the next few days.
        Returns a summary of market position (Premium/Budget) and price suggestions.
        """
        today = date.today()
        end_date = today + timedelta(days=days)

        # 1. My Price (Base)
        rt_query = select(RoomType).where(RoomType.hotel_id == user.hotel_id)
        rt_res = await session.execute(rt_query)
        room_type = rt_res.scalars().first()
        if not room_type:
            return "No room types defined for this hotel."
        my_price = room_type.base_price

        # 2. Competitor Rates
        comp_subquery = select(Competitor.id).where(Competitor.hotel_id == user.hotel_id)
        rate_query = select(CompetitorRate).where(
            CompetitorRate.competitor_id.in_(comp_subquery),
            CompetitorRate.check_in_date >= today,
            CompetitorRate.check_in_date < end_date
        )
        rates_res = await session.execute(rate_query)
        all_rates = rates_res.scalars().all()

        if not all_rates:
            return "No competitor data found. Please ask user to ingest rates via Chrome Extension."

        # Analysis
        prices = [r.price for r in all_rates]
        avg_price = sum(prices) / len(prices)
        min_price = min(prices)
        max_price = max(prices)

        analysis = f"""
        Market Analysis for next {days} days:
        - My Base Price: {my_price}
        - Market Average: {int(avg_price)}
        - Market Range: {min_price} - {max_price}
        """

        if my_price > avg_price * 1.15:
             analysis += "\nYour rates are significantly HIGHER (>15%) than market average. Strategy: Premium positioning."
        elif my_price < avg_price * 0.85:
             analysis += "\nYour rates are significantly LOWER (>15%) than market average. Strategy: Budget/Volume driver."
        else:
             analysis += "\nYour rates are COMPETITIVE (within 15% of market average)."

        return analysis
    
    @tool
    async def update_room_price(room_name: str, new_price: float) -> str:
        """
        Updates the base price of a room type in the database.
        USE THIS ONLY AFTER EXPLICIT USER CONFIRMATION.
        """
        return await logic_update_room_price(session, user, room_name, new_price)

    @tool
    async def create_promo_code(code: str, discount_percent: int) -> str:
        """
        Creates a new discount promo code in the database.
        USE THIS ONLY AFTER EXPLICIT USER CONFIRMATION.
        """
        return await logic_create_promo_code(session, user, code, discount_percent)

    @tool
    async def get_room_inventory() -> str:
        """
        Get the current inventory AND BASE RATES of the hotel.
        Returns a list of Room Types, their total count, and current price.
        Useful for answering "How many rooms?" or "What is the price of Superior Room?".
        """
        query = select(RoomType).where(RoomType.hotel_id == user.hotel_id)
        result = await session.execute(query)
        room_types = result.scalars().all()
        
        if not room_types:
            return "No room inventory found in the system."
            
        summary = "🏨 **Current Room Rates & Inventory:**\n"
        total_rooms = 0
        
        for rt in room_types:
            summary += f"- **{rt.name}**: {rt.total_inventory} rooms. Base Price: **₹{rt.base_price}**\n"
            total_rooms += rt.total_inventory
            
        summary += f"\n**Grand Total: {total_rooms} Rooms**"
        return summary

    @tool
    async def get_pending_payments() -> str:
        """
        List all bookings that have pending payments (Money yet to be collected).
        Useful for "Who owes money?" or "Payment follow-up".
        """
        from app.core.tools.finance import logic_get_pending_payments
        pending = await logic_get_pending_payments(session, user.id)
        
        if not pending:
            return "Great news! No pending payments. All confirmed bookings are fully paid."
            
        summary = "💰 **Pending Payments List:**\n"
        total_due = 0
        for p in pending:
            summary += f"- Booking `{p['booking_number']}`: Due **₹{p['due']}** (Status: {p['status']})\n"
            total_due += p['due']
            
        summary += f"\n**Total Outstanding Amount: ₹{total_due}**"
        return summary

    @tool
    async def get_daily_revenue(target_date_str: str = None) -> str:
        """
        Get the specific revenue for a given date (default: today).
        Format date as YYYY-MM-DD.
        Calculates revenue based on occupied rooms for that night.
        """
        from app.core.tools.finance import logic_get_daily_revenue
        
        if not target_date_str:
            target_date = date.today()
        else:
            try:
                target_date = date.fromisoformat(target_date_str)
            except ValueError:
                return "Invalid date format. Please use YYYY-MM-DD."
                
        rev = await logic_get_daily_revenue(session, user.id, target_date)
        return f"📅 Revenue for **{target_date.isoformat()}**: **₹{rev}**"

    @tool
    async def get_todays_arrivals() -> str:
        """
        Get a list of guests arriving TODAY.
        Useful for reception: "Who is checking in?"
        """
        from app.core.tools.operations import logic_get_todays_arrivals
        arrivals = await logic_get_todays_arrivals(session, user.id)
        
        if not arrivals:
            return "No arrivals scheduled for today."
            
        summary = "🛬 **Today's Arrivals:**\n"
        for a in arrivals:
            summary += f"- **{a['guest_name']}** ({a['room_count']} rooms). Req: {a['special_requests']}\n"
        return summary

    @tool
    async def get_todays_departures() -> str:
        """
        Get a list of guests checking out TODAY.
        Useful for billing: "Who is leaving?"
        """
        from app.core.tools.operations import logic_get_todays_departures
        departures = await logic_get_todays_departures(session, user.id)
        
        if not departures:
            return "No departures scheduled for today."
            
        summary = "🛫 **Today's Departures:**\n"
        for d in departures:
            due_msg = f"Due: ₹{d['due_amount']}" if d['due_amount'] > 0 else "Fully Paid ✅"
            summary += f"- **{d['guest_name']}**. {due_msg}\n"
        return summary

    @tool
    async def find_guest(query_str: str) -> str:
        """
        Find a guest by Name, Phone, or Email.
        Returns their VIP status, total spend, and visit history.
        """
        from app.core.tools.guest_inventory import logic_find_guest
        guests = await logic_find_guest(session, user.id, query_str)
        
        if not guests:
            return "No guest found matching that query."
            
        summary = "👤 **Guest Found:**\n"
        for g in guests:
            summary += f"- **{g['name']}** ({g['vip_status']})\n"
            summary += f"  - Phone: {g['phone']}\n"
            summary += f"  - Total Spent: ₹{g['total_spent']} ({g['visits']} visits)\n"
            summary += f"  - Last Search: {g['last_visit']}\n"
        return summary

    @tool
    async def block_room_dates(room_type_name: str, start_date_str: str, end_date_str: str, reason: str = "Maintenance") -> str:
        """
        Block a room for a specific date range (e.g. for maintenance).
        Format dates as YYYY-MM-DD.
        USE THIS ONLY AFTER EXPLICIT USER CONFIRMATION.
        """
        from app.core.tools.guest_inventory import logic_block_room
        from datetime import date
        
        try:
            s_date = date.fromisoformat(start_date_str)
            e_date = date.fromisoformat(end_date_str)
        except ValueError:
             return "Invalid date format. Use YYYY-MM-DD."
             
        return await logic_block_room(session, user.id, room_type_name, s_date, e_date, reason)


    @tool
    async def get_pending_approvals() -> str:
        """
        List bookings that are waiting for YOUR confirmation (Status = Pending).
        Action Required: Confirm or Cancel these.
        """
        from app.core.tools.operations import logic_get_pending_bookings
        pending = await logic_get_pending_bookings(session, user.id)
        
        if not pending:
            return "No bookings are waiting for confirmation."
            
        summary = "⏳ **Bookings Waiting for Confirmation:**\n"
        for p in pending:
            summary += f"- **{p['guest_name']}** ({p['dates']}). Amt: ₹{p['amount']}. Src: {p['source']}\n"
        return summary

    @tool
    async def create_quick_booking(guest_name: str, guest_email: str, room_type_name: str, check_in_str: str, nights: int = 1) -> str:
        """
        Creates a quick booking for a guest.
        Format dates as YYYY-MM-DD.
        Example: "Book a Deluxe room for Amit (amit@email.com) for 2 nights starting 2026-05-10"
        """
        try:
            from datetime import date, timedelta, datetime
            import uuid
            start_date = date.fromisoformat(check_in_str)
            end_date = start_date + timedelta(days=nights)
            
            # 1. Find Room Type
            rt_res = await session.execute(select(RoomType).where(
                RoomType.hotel_id == user.hotel_id,
                RoomType.name.ilike(f"%{room_type_name}%")
            ))
            room_type = rt_res.scalars().first()
            if not room_type:
                return f"Error: Room type '{room_type_name}' not found."
            
            # 2. Find/Create Guest
            guest_res = await session.execute(select(Guest).where(
                Guest.email == guest_email,
                Guest.hotel_id == user.hotel_id
            ))
            guest = guest_res.scalar_one_or_none()
            if not guest:
                names = guest_name.split(" ")
                guest = Guest(
                    first_name=names[0],
                    last_name=names[1] if len(names) > 1 else "",
                    email=guest_email,
                    hotel_id=user.hotel_id
                )
                session.add(guest)
                await session.flush()
            
            # 3. Create Booking
            booking_num = f"AI{datetime.utcnow().strftime('%y%m%d')}{str(uuid.uuid4())[:4].upper()}"
            new_booking = Booking(
                hotel_id=user.hotel_id,
                guest_id=guest.id,
                booking_number=booking_num,
                check_in=start_date,
                check_out=end_date,
                rooms=[{
                    "room_type_id": room_type.id,
                    "room_type_name": room_type.name,
                    "price_per_night": room_type.base_price,
                    "total_price": room_type.base_price * nights
                }],
                total_amount=room_type.base_price * nights,
                status=BookingStatus.PENDING,
                source=BookingSource.BOOKING_ENGINE
            )
            session.add(new_booking)
            await session.flush()
            
            # 4. Log to BookingTimeline
            timeline = BookingTimeline(
                booking_id=new_booking.id,
                event_type="booking_created",
                message=f"Autonomous booking created by AI Agent for {guest_name}",
                changed_by="ai_agent"
            )
            session.add(timeline)
            
            await session.commit()
            return f"✅ Booking Created Successfully! Number: **{booking_num}**. Status: Pending Approval."
            
        except Exception as e:
            return f"❌ Failed to create booking: {str(e)}"

    @tool
    async def check_availability_matrix(start_date_str: str, end_date_str: str) -> str:
        """
        Check which room types are available for a date range.
        Shows Total Inventory vs Booked count for each room type.
        """
        try:
            from datetime import date
            s_date = date.fromisoformat(start_date_str)
            e_date = date.fromisoformat(end_date_str)
            
            # Get all room types
            rt_res = await session.execute(select(RoomType).where(RoomType.hotel_id == user.hotel_id))
            room_types = rt_res.scalars().all()
            
            # Get all active bookings in range
            b_res = await session.execute(select(Booking).where(
                Booking.hotel_id == user.hotel_id,
                Booking.status != BookingStatus.CANCELLED,
                and_(
                    Booking.check_in < e_date,
                    Booking.check_out > s_date
                )
            ))
            bookings = b_res.scalars().all()
            
            summary = f"📅 **Availability Matrix ({start_date_str} to {end_date_str}):**\n"
            for rt in room_types:
                # Calculate occupied
                occupied = 0
                for b in bookings:
                    for r in b.rooms:
                        if r.get("room_type_id") == rt.id:
                            occupied += 1
                
                avail = rt.total_inventory - occupied
                status = "✅ Available" if avail > 0 else "❌ Sold Out"
                summary += f"- **{rt.name}**: {avail}/{rt.total_inventory} left. {status}\n"
                
            return summary
        except Exception as e:
            return f"Error checking availability: {str(e)}"


    @tool
    async def search_web(query: str) -> str:
        """
        Search the web for real-time information (Events, Weather, Trends).
        Use this when you need external context to explain 'WHY' (e.g. "Is there a concert in Mumbai today?").
        """
        try:
            from duckduckgo_search import DDGS
            results = DDGS().text(query, max_results=3)
            if not results:
                return "No web results found."
            summary = "🌐 **Web Search Results:**\n"
            for r in results:
                summary += f"- {r['title']}: {r['body']}\n"
            return summary
        except Exception as e:
            return f"Web search failed: {str(e)}"

    # --- AGENT SETUP ---

    tools = [
        get_dashboard_stats,
        search_bookings,
        get_booking_details,
        cancel_booking,
        analyze_rate_competitiveness,
        get_weather_forecast,
        get_local_events,
        generate_pdf_report,
        update_room_price,
        create_promo_code,
        get_room_inventory,
        get_pending_payments,
        get_daily_revenue,
        get_todays_arrivals,
        get_todays_departures,
        find_guest,
        block_room_dates,
        get_pending_approvals,
        search_web,
        create_quick_booking,
        check_availability_matrix
    ]

    if settings.OPENAI_API_KEY:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            openai_api_key=settings.OPENAI_API_KEY
        )
    else:
        # Fallback to local Ollama (only works if running locally)
        llm = ChatOllama(
            model="gpt-oss:120b-cloud",
            temperature=0
        )

    # Fetch Hotel City for Context - Handle NoneType safety
    hotel_city = "Unknown City"
    if user.hotel and user.hotel.address:
        hotel_city = user.hotel.address.get("city", "Unknown City")

    # Create Agent Graph (LangGraph)
    graph = create_react_agent(
        model=llm,
        tools=tools,
        prompt=SYSTEM_PROMPT.format(
            current_date=date.today().isoformat(),
            city=hotel_city
        )
    )

    return graph
