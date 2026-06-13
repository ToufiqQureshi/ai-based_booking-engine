from typing import List
from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlmodel import select

from app.core.deps import CurrentUser, DbSession, require_hotel_role
from app.rooms.amenity import Amenity, AmenityCreate, AmenityRead, RoomAmenityLink
from app.core.cache import cache_response, invalidate_cache

router = APIRouter(prefix="/amenities", tags=["Amenities"])

@router.get("", response_model=List[AmenityRead])
@cache_response(expire=3600, key_prefix="amenities")
async def get_amenities(request: Request, current_user: CurrentUser, session: DbSession):
    """List all amenities for the hotel"""
    query = select(Amenity).where(Amenity.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("", response_model=AmenityRead, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_amenity(
    data: AmenityCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """Create a new amenity type"""
    amenity = Amenity(
        hotel_id=current_user.hotel_id,
        **data.model_dump()
    )
    session.add(amenity)
    await session.commit()
    await session.refresh(amenity)
    invalidate_cache(f"amenities:{current_user.hotel_id}:*")
    return amenity

@router.delete("/{amenity_id}", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_amenity(
    amenity_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """Delete an amenity type"""
    amenity = await session.get(Amenity, amenity_id)
    if not amenity or amenity.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Amenity not found")
        
    await session.delete(amenity)
    await session.commit()
    invalidate_cache(f"amenities:{current_user.hotel_id}:*")
    return {"message": "Deleted successfully"}

# Helper to Initialize Defaults (Optional)
@router.post("/seed-defaults", dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def seed_defaults(current_user: CurrentUser, session: DbSession):
    """Create basic amenities if none exist"""
    existing = await session.execute(select(Amenity).where(Amenity.hotel_id == current_user.hotel_id))
    if existing.first():
        return {"message": "Amenities already exist"}
        
    defaults = [
        {"name": "Free WiFi", "icon_slug": "wifi", "category": "tech", "scope": "room", "is_featured": True},
        {"name": "Air Conditioning", "icon_slug": "snowflake", "category": "room", "scope": "room", "is_featured": True},
        {"name": "Smart TV", "icon_slug": "tv", "category": "tech", "scope": "room", "is_featured": True},
        {"name": "Coffee Maker", "icon_slug": "coffee", "category": "dining", "scope": "room", "is_featured": False},
        {"name": "Mini Bar", "icon_slug": "wine", "category": "dining", "scope": "room", "is_featured": False},
        {"name": "Luxury Bathtub", "icon_slug": "bath", "category": "room", "scope": "room", "is_featured": False},
        {"name": "Swimming Pool", "icon_slug": "waves", "category": "wellness", "scope": "hotel", "is_featured": False},
        {"name": "Gym / Fitness", "icon_slug": "dumbbell", "category": "wellness", "scope": "hotel", "is_featured": False},
        {"name": "Parking Area", "icon_slug": "car", "category": "general", "scope": "hotel", "is_featured": False},
        {"name": "In-room Safe", "icon_slug": "shield", "category": "general", "scope": "room", "is_featured": False},
        {"name": "Room Service", "icon_slug": "bell", "category": "general", "scope": "hotel", "is_featured": False},
        {"name": "Pet Friendly", "icon_slug": "pet", "category": "general", "scope": "room", "is_featured": False},
    ]
    
    created = []
    for d in defaults:
        a = Amenity(hotel_id=current_user.hotel_id, **d)
        session.add(a)
        created.append(a)
    
    await session.commit()
    invalidate_cache(f"amenities:{current_user.hotel_id}:*")
    return {"message": "Created default amenities", "count": len(created)}

