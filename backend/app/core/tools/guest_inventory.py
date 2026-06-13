from typing import List, Dict, Any, Optional
from datetime import date
from sqlmodel import select, or_
from app.rooms.room import RoomBlock, RoomType
from app.bookings.booking import Guest, Booking, BookingStatus

async def logic_find_guest(session, user_id, query_str: str) -> List[Dict[str, Any]]:
    """
    Logic to find a guest by phone or email.
    """
    query = select(Guest).where(
        Guest.hotel_id == user_id,
        or_(
            Guest.email.ilike(f"%{query_str}%"),
            Guest.phone.ilike(f"%{query_str}%"),
            (Guest.first_name + " " + Guest.last_name).ilike(f"%{query_str}%")
        )
    )
    result = await session.execute(query)
    guests = result.scalars().all()
    
    found = []
    for g in guests:
        # Get stats
        stats_query = select(Booking).where(Booking.guest_id == g.id)
        stats_res = await session.execute(stats_query)
        bookings = stats_res.scalars().all()
        
        total_spent = sum(b.total_amount for b in bookings)
        visit_count = len(bookings)
        last_visit = max([b.check_out for b in bookings]) if bookings else "Never"
        
        found.append({
            "name": f"{g.first_name} {g.last_name}",
            "email": g.email,
            "phone": g.phone,
            "vip_status": "VIP" if total_spent > 50000 else "Regular",
            "total_spent": total_spent,
            "visits": visit_count,
            "last_visit": str(last_visit)
        })
    return found

async def logic_block_room(session, user_id, room_type_name: str, start_date: date, end_date: date, reason: str) -> str:
    """
    Logic to block a room type for maintenance.
    """
    # 1. Find Room Type ID
    rt_res = await session.execute(select(RoomType).where(RoomType.hotel_id == user_id, RoomType.name.ilike(f"%{room_type_name}%")))
    room_type = rt_res.scalars().first()
    
    if not room_type:
        return f"Error: Room Type '{room_type_name}' not found."
        
    # 2. Create Block
    block = RoomBlock(
        hotel_id=user_id,
        room_type_id=room_type.id,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        blocked_count=1 
    )
    session.add(block)
    await session.commit()
    
    return f"Success: Blocked 1 '{room_type.name}' from {start_date} to {end_date} for '{reason}'."
