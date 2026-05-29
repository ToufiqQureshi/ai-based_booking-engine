from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlmodel import select, and_, SQLModel
import uuid

from app.api.deps import CurrentUser, DbSession
from app.models.hotel import Hotel, HotelRead
from app.models.links import UserHotelLink
from app.models.user import User
from app.core.cache import cache_response, invalidate_cache

router = APIRouter(prefix="/properties", tags=["Properties"])

class PropertyRead(HotelRead):
    role: str
    is_current: bool

class PropertyCreate(SQLModel):
    name: str
    slug: str
    phone: Optional[str] = None
    email: Optional[str] = None

@router.get("", response_model=List[PropertyRead])
@cache_response(expire=300, key_prefix="properties")
async def list_properties(request: Request, current_user: CurrentUser, session: DbSession):
    """
    List all properties accessible by the current user.
    Auto-migrates existing single-hotel users to the new link system.
    """
    # 1. Fetch links
    link_query = select(UserHotelLink).where(UserHotelLink.user_id == current_user.id)
    result = await session.execute(link_query)
    links = result.scalars().all()
    
    # 2. Auto-Migration: If no links but user has a hotel_id, create the link
    if not links and current_user.hotel_id:
        # Verify hotel exists
        hotel = await session.get(Hotel, current_user.hotel_id)
        if hotel:
            new_link = UserHotelLink(
                user_id=current_user.id,
                hotel_id=hotel.id,
                role=current_user.role
            )
            session.add(new_link)
            await session.commit()
            await session.refresh(new_link)
            links = [new_link]
    
    # 3. Fetch Hotels
    properties = []
    for link in links:
        hotel = await session.get(Hotel, link.hotel_id)
        if hotel:
            # Add extra fields
            prop_dict = hotel.model_dump()
            prop_dict["role"] = link.role
            prop_dict["is_current"] = (hotel.id == current_user.hotel_id)
            properties.append(prop_dict)
            
    return properties


@router.post("", response_model=PropertyRead)
async def add_property(prop_data: PropertyCreate, current_user: CurrentUser, session: DbSession):
    """
    Create a new property for the existing user.
    """
    # 1. Check slug uniqueness
    existing_query = select(Hotel).where(Hotel.slug == prop_data.slug)
    existing = await session.execute(existing_query)
    if existing.scalar_one_or_none():
         raise HTTPException(status_code=400, detail="Hotel slug already exists")

    # 2. Create Hotel
    new_hotel = Hotel(
        name=prop_data.name,
        slug=prop_data.slug,
        contact_email=prop_data.email or current_user.email,
        contact_phone=prop_data.phone or ""
    )
    session.add(new_hotel)
    await session.flush()
    await session.refresh(new_hotel)
    
    # 3. Create Link
    link = UserHotelLink(
        user_id=current_user.id,
        hotel_id=new_hotel.id,
        role="OWNER" 
    )
    session.add(link)
    
    # 4. Auto-Switch to new property?
    # Let's do it for convenience
    user = await session.get(User, current_user.id)
    user.hotel_id = new_hotel.id
    session.add(user)
    
    await session.commit()
    
    # Return result
    response = new_hotel.model_dump()
    response["role"] = "OWNER"
    response["is_current"] = True
    return response


@router.post("/switch/{hotel_id}", response_model=dict)
async def switch_property(hotel_id: str, current_user: CurrentUser, session: DbSession):
    """
    Switch the current active context to another hotel.
    """
    # 1. Verify link exists
    link_query = select(UserHotelLink).where(
        UserHotelLink.user_id == current_user.id,
        UserHotelLink.hotel_id == hotel_id
    )
    result = await session.execute(link_query)
    link = result.scalar_one_or_none()
    
    if not link:
        raise HTTPException(status_code=403, detail="You do not have access to this property")
        
    # 2. Update User
    user = await session.get(User, current_user.id)
    user.hotel_id = hotel_id
    session.add(user)
    await session.commit()
    
    return {"message": f"Switched to property: {hotel_id}", "hotel_id": hotel_id}
