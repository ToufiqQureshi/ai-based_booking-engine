"""
Bookings Router
Booking CRUD aur guest management.
Bookings page ke liye.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Query, BackgroundTasks
from sqlmodel import select
import uuid

from app.api.deps import CurrentUser, DbSession
from app.models.timeline import BookingTimeline
from app.models.booking import (
    Booking, BookingCreate, BookingRead, BookingUpdate,
    Guest, GuestCreate, GuestRead, BookingStatus,
)
from app.models.room import RoomType
from app.core.tasks import log_timeline_task
from app.api.v1.availability import clear_availability_cache
from app.core.redis_client import redis_client

router = APIRouter(prefix="/bookings", tags=["Bookings"])

def clear_dashboard_cache(hotel_id: str):
    try:
        r = redis_client.get_instance()
        if r:
            keys = [
                f"dashboard_stats:{hotel_id}",
                f"dashboard_recent_bookings:{hotel_id}"
            ]
            r.delete(*keys)
    except Exception as e:
        print(f"Failed to clear dashboard cache: {e}")


def generate_booking_number() -> str:
    """Unique booking number generate karta hai"""
    timestamp = datetime.utcnow().strftime("%Y%m%d")
    unique_part = str(uuid.uuid4())[:6].upper()
    return f"BK{timestamp}{unique_part}"


@router.get("", response_model=List[BookingRead])
async def get_bookings(
    current_user: CurrentUser,
    session: DbSession,
    status_filter: Optional[BookingStatus] = Query(None, alias="status"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Hotel ki saari bookings get karo.
    Optional status filter ke saath.
    """
    query = select(Booking).where(Booking.hotel_id == current_user.hotel_id)
    
    if status_filter:
        query = query.where(Booking.status == status_filter)
    
    query = query.offset(offset).limit(limit).order_by(Booking.created_at.desc())
    
    result = await session.execute(query)
    bookings = result.scalars().all()
    
    # 1. Collect unique Guest IDs
    guest_ids = [b.guest_id for b in bookings if b.guest_id]
    guests_map = {}
    
    if guest_ids:
        # 2. Batch fetch all guests in one single query
        guest_query = select(Guest).where(Guest.id.in_(guest_ids))
        guest_res = await session.execute(guest_query)
        guests_map = {g.id: g for g in guest_res.scalars().all()}
    
    # 3. Attach guest data
    booking_responses = []
    for booking in bookings:
        guest = guests_map.get(booking.guest_id)
        booking_dict = booking.model_dump()
        booking_dict["guest"] = guest.model_dump() if guest else {}
        booking_responses.append(booking_dict)
    
    return booking_responses


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: CurrentUser,
    session: DbSession,
    background_tasks: BackgroundTasks
):
    """
    New booking create karo.
    Guest bhi saath mein create hota hai.
    """
    # Create or find guest
    guest_data = booking_data.guest
    
    # Check if guest exists by email
    result = await session.execute(
        select(Guest).where(
            Guest.email == guest_data.email,
            Guest.hotel_id == current_user.hotel_id
        )
    )
    guest = result.scalar_one_or_none()
    
    if not guest:
        guest = Guest(
            **guest_data.model_dump(),
            hotel_id=current_user.hotel_id
        )
        session.add(guest)
        await session.flush()
    
    # Create booking
    # --- CONCURRENCY SAFETY: Lock room inventory during transaction ---
    for room_req in booking_data.rooms:
        rt_id = room_req.get("room_type_id")
        # Lock this room type for the duration of this transaction
        rt_query = select(RoomType).where(RoomType.id == rt_id).with_for_update()
        rt_result = await session.execute(rt_query)
        room_type = rt_result.scalar_one_or_none()
        
        if not room_type:
             raise HTTPException(status_code=404, detail=f"Room type {rt_id} not found")
             
        # TODO: Advanced date-range availability check goes here.
        # For now, we ensure the room type exists and is locked.

    booking = Booking(
        hotel_id=current_user.hotel_id,
        guest_id=guest.id,
        booking_number=generate_booking_number(),
        check_in=booking_data.check_in,
        check_out=booking_data.check_out,
        rooms=booking_data.rooms,
        special_requests=booking_data.special_requests,
        promo_code=booking_data.promo_code,
        total_amount=sum(room.get("total_price", 0) for room in booking_data.rooms),
        status=BookingStatus.PENDING
    )
    session.add(booking)
    await session.flush() # Get booking ID
    
    # Log to Timeline in background
    background_tasks.add_task(
        log_timeline_task,
        booking_id=booking.id,
        event_type="booking_created",
        old_value=None,
        new_value=BookingStatus.PENDING,
        message=f"New booking created via {booking.source}",
        changed_by=str(current_user.id)
    )
    
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    clear_dashboard_cache(current_user.hotel_id)
    await session.refresh(booking)
    await session.refresh(guest)
    
    response = booking.model_dump()
    response["guest"] = guest.model_dump()
    return response



# ============== Guest Endpoints ==============

@router.get("/guests", response_model=List[GuestRead], tags=["Guests"])
async def get_guests(current_user: CurrentUser, session: DbSession):
    """Hotel ke saare guests get karo"""
    result = await session.execute(
        select(Guest).where(Guest.hotel_id == current_user.hotel_id)
    )
    return result.scalars().all()


@router.get("/guests/stats", response_model=dict, tags=["Guests"])
async def get_guest_stats(current_user: CurrentUser, session: DbSession):
    """
    Guest statistics calculation.
    Repeat guests = Guests with > 1 total bookings.
    """
    from sqlalchemy import func
    
    # Count bookings per guest for this hotel
    # Subquery to count bookings by guest
    # Using raw SQL or complex query building for simplicity:
    # Select guest_id, count(*) from bookings where hotel_id = X group by guest_id having count(*) > 1
    
    # Optimized approach:
    query = select(Booking.guest_id).where(Booking.hotel_id == current_user.hotel_id).group_by(Booking.guest_id).having(func.count(Booking.id) > 1)
    result = await session.execute(query)
    repeat_guests_count = len(result.all())
    
    return {
        "repeat_guests": repeat_guests_count,
        "total_guests": 0 # Frontend can calculate total from list, or we add here
    }


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(booking_id: str, current_user: CurrentUser, session: DbSession):
    """Single booking get karo"""
    result = await session.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.hotel_id == current_user.hotel_id
        )
    )
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    guest_result = await session.execute(select(Guest).where(Guest.id == booking.guest_id))
    guest = guest_result.scalar_one_or_none()
    
    response = booking.model_dump()
    response["guest"] = guest.model_dump() if guest else {}
    return response


@router.patch("/{booking_id}", response_model=BookingRead)
async def update_booking(
    booking_id: str,
    booking_update: BookingUpdate,
    current_user: CurrentUser,
    session: DbSession,
    background_tasks: BackgroundTasks
):
    """Booking status/details update karo"""
    result = await session.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.hotel_id == current_user.hotel_id
        )
    )
    booking = result.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    old_status = booking.status
    update_data = booking_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking, field, value)
    
    new_status = booking.status
    
    # Log to timeline in background if status changed
    if old_status != new_status:
        background_tasks.add_task(
            log_timeline_task,
            booking_id=booking.id,
            event_type="status_change",
            old_value=old_status,
            new_value=new_status,
            message=f"Booking status updated from {old_status} to {new_status}",
            changed_by=str(current_user.id)
        )
        
    booking.updated_at = datetime.utcnow()
    session.add(booking)
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    clear_dashboard_cache(current_user.hotel_id)
    await session.refresh(booking)
    
    guest_result = await session.execute(select(Guest).where(Guest.id == booking.guest_id))
    guest = guest_result.scalar_one_or_none()
    
    response = booking.model_dump()
    response["guest"] = guest.model_dump() if guest else {}
    return response



