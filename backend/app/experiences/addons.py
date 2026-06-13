
from typing import List
from datetime import datetime
from fastapi import Depends, APIRouter, HTTPException, status, Request
from sqlmodel import select

from app.core.deps import CurrentUser, DbSession, require_hotel_role
from app.experiences.addon import AddOn, AddOnCreate, AddOnUpdate
from app.core.cache import cache_response, invalidate_cache

router = APIRouter(prefix="/addons", tags=["Addons"])

@router.get("", response_model=List[AddOn])
@cache_response(expire=3600, key_prefix="addons")
async def get_addons(request: Request, current_user: CurrentUser, session: DbSession):
    """
    Get all add-ons for the current hotel.
    """
    query = select(AddOn).where(AddOn.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("", response_model=AddOn, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_addon(
    addon_data: AddOnCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Create a new add-on.
    """
    addon = AddOn(
        **addon_data.model_dump(),
        hotel_id=current_user.hotel_id
    )
    session.add(addon)
    await session.commit()
    await session.refresh(addon)
    invalidate_cache(f"addons:{current_user.hotel_id}:*")
    return addon

@router.patch("/{addon_id}", response_model=AddOn, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def update_addon(
    addon_id: str,
    addon_update: AddOnUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Update an existing add-on.
    """
    query = select(AddOn).where(
        AddOn.id == addon_id,
        AddOn.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    addon = result.scalar_one_or_none()
    
    if not addon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Add-on not found"
        )
    
    update_data = addon_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(addon, field, value)
        
    addon.updated_at = datetime.utcnow()
    session.add(addon)
    await session.commit()
    await session.refresh(addon)
    invalidate_cache(f"addons:{current_user.hotel_id}:*")
    return addon

@router.delete("/{addon_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_addon(
    addon_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Delete an add-on.
    """
    query = select(AddOn).where(
        AddOn.id == addon_id,
        AddOn.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    addon = result.scalar_one_or_none()
    
    if not addon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Add-on not found"
        )
        
    await session.delete(addon)
    await session.commit()
    invalidate_cache(f"addons:{current_user.hotel_id}:*")

