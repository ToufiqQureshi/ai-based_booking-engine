"""
Rooms Router
Room types CRUD operations.
Rooms page ke liye endpoints.
"""
from typing import List
from datetime import datetime
from fastapi import Depends, APIRouter, HTTPException, status
from sqlmodel import select

from app.core.auth.deps import CurrentUser, DbSession, require_hotel_role
from app.rooms.room import RoomType, RoomTypeCreate, RoomTypeRead, RoomTypeUpdate, RoomBlock
from app.rooms.amenity import Amenity, RoomAmenityLink
from app.rate_plans.rates_model import RoomRate
from sqlmodel import delete
from app.calendar import clear_availability_cache
from app.core.cache.cache import cache_response, invalidate_cache
from app.ai_engine.guest_agent import invalidate_guest_agent_cache
from fastapi import Request
from app.revenue.rate_signals import bump_rate_version

router = APIRouter(prefix="/rooms", tags=["Rooms"])


@router.get("", response_model=List[RoomTypeRead])
@cache_response(expire=300, key_prefix="rooms")
async def get_rooms(request: Request, current_user: CurrentUser, session: DbSession):
    """
    Hotel ke saare room types get karo.
    Rooms page mein list display ke liye.
    """
    result = await session.execute(
        select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    )
    rooms = result.scalars().all()
    return rooms


@router.post("", response_model=RoomTypeRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_room(
    room_data: RoomTypeCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    New room type create karo.
    Add Room form submit hone par.
    """
    # 1. Prepare Room Object
    room_dict = room_data.model_dump(exclude={"amenity_ids"})
    room = RoomType(
        **room_dict,
        hotel_id=current_user.hotel_id
    )
    
    # 2. Handle Amenities if provided
    if room_data.amenity_ids:
        # Verify amenities exist and belong to hotel
        stmt = select(Amenity).where(
            Amenity.id.in_(room_data.amenity_ids),
            Amenity.hotel_id == current_user.hotel_id
        )
        result = await session.execute(stmt)
        valid_amenities = result.scalars().all()
        
        # Populate JSON column (for simple frontend display)
        room.amenities = [
            {"id": a.id, "name": a.name, "icon": a.icon_slug, "category": a.category} 
            for a in valid_amenities
        ]
        
    session.add(room)
    await session.commit()
    await session.refresh(room)
    
    # 3. Create Links in Many-to-Many table (after room has ID)
    if room_data.amenity_ids:
        valid_amenity_ids = {a.id for a in valid_amenities}
        for a_id in set(room_data.amenity_ids):
             # Only link if valid? Better use valid_amenities IDs
             # to ensure we don't link to others' amenities
             if a_id in valid_amenity_ids:
                 link = RoomAmenityLink(room_id=room.id, amenity_id=a_id)
                 session.add(link)
        await session.commit()
        await session.refresh(room)

    clear_availability_cache(current_user.hotel_id)
    invalidate_cache(f"rooms:{current_user.hotel_id}:*")
    invalidate_guest_agent_cache(current_user.hotel_id)
    bump_rate_version(current_user.hotel_id, room.id)
    return room


@router.get("/{room_id}", response_model=RoomTypeRead)
@cache_response(expire=300, key_prefix="room")
async def get_room(room_id: str, request: Request, current_user: CurrentUser, session: DbSession):
    """Single room type get karo"""
    result = await session.execute(
        select(RoomType).where(
            RoomType.id == room_id,
            RoomType.hotel_id == current_user.hotel_id
        )
    )
    room = result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room type not found"
        )
    return room


@router.patch("/{room_id}", response_model=RoomTypeRead, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_room(
    room_id: str,
    room_update: RoomTypeUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """Room type update karo"""
    result = await session.execute(
        select(RoomType).where(
            RoomType.id == room_id,
            RoomType.hotel_id == current_user.hotel_id
        )
    )
    room = result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room type not found"
        )
    
    update_data = room_update.model_dump(exclude_unset=True)
    
    # Check if amenity_ids is being updated
    if "amenity_ids" in update_data:
        new_ids = update_data.pop("amenity_ids")
        
        # 1. Fetch valid amenities
        stmt = select(Amenity).where(
            Amenity.id.in_(new_ids),
            Amenity.hotel_id == current_user.hotel_id
        )
        result = await session.execute(stmt)
        valid_amenities = result.scalars().all()
        
        # 2. Update JSON column
        room.amenities = [
            {"id": a.id, "name": a.name, "icon": a.icon_slug, "category": a.category} 
            for a in valid_amenities
        ]
        
        # 3. Update Link Table
        # Delete old links
        from sqlmodel import delete
        stmt_del = delete(RoomAmenityLink).where(RoomAmenityLink.room_id == room_id)
        await session.execute(stmt_del)
        
        # Add new links
        for a in valid_amenities:
            session.add(RoomAmenityLink(room_id=room.id, amenity_id=a.id))

    for field, value in update_data.items():
        setattr(room, field, value)
    
    room.updated_at = datetime.utcnow()
    session.add(room)
    await session.commit()
    await session.refresh(room)
    
    clear_availability_cache(current_user.hotel_id)
    invalidate_cache(f"rooms:{current_user.hotel_id}:*")
    invalidate_cache(f"room:{current_user.hotel_id}:*/rooms/{room_id}*")
    invalidate_guest_agent_cache(current_user.hotel_id)
    bump_rate_version(current_user.hotel_id, room_id)
    return room


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_room(room_id: str, current_user: CurrentUser, session: DbSession):
    """Room type delete karo"""
    result = await session.execute(
        select(RoomType).where(
            RoomType.id == room_id,
            RoomType.hotel_id == current_user.hotel_id
        )
    )
    room = result.scalar_one_or_none()
    
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room type not found"
        )
    
    # --- Manual Cascade Delete ---
    # Delete Room Amenities Links
    stmt_links = delete(RoomAmenityLink).where(RoomAmenityLink.room_id == room_id)
    await session.execute(stmt_links)

    # Delete Room Blocks
    stmt_blocks = delete(RoomBlock).where(RoomBlock.room_type_id == room_id)
    await session.execute(stmt_blocks)

    # Delete Room Rates
    stmt_rates = delete(RoomRate).where(RoomRate.room_type_id == room_id)
    await session.execute(stmt_rates)
    
    await session.delete(room)
    await session.commit()
    clear_availability_cache(current_user.hotel_id)
    invalidate_cache(f"rooms:{current_user.hotel_id}:*")
    invalidate_cache(f"room:{current_user.hotel_id}:*/rooms/{room_id}*")
    invalidate_guest_agent_cache(current_user.hotel_id)
    bump_rate_version(current_user.hotel_id, room_id)


