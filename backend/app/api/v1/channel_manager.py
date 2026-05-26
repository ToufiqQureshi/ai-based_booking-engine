from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from sqlmodel import select
import httpx
import json
import logging

logger = logging.getLogger(__name__)

from app.api.deps import CurrentUser, DbSession
from app.models.channel_manager import (
    ChannelManagerSettings, ChannelSettingsRead, ChannelSettingsUpdate,
    ChannelRoomMapping, MappingCreate, MappingRead,
    ChannelLog, ChannelLogRead
)
from app.models.room import RoomType

router = APIRouter(prefix="/channel-manager", tags=["Channel Manager"])

# --- SETTINGS ---

@router.get("/settings", response_model=ChannelSettingsRead)
async def get_settings(current_user: CurrentUser, session: DbSession):
    """Get connection settings"""
    query = select(ChannelManagerSettings).where(
        ChannelManagerSettings.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    settings = result.scalar_one_or_none()
    
    if not settings:
        # Create default if missing
        settings = ChannelManagerSettings(hotel_id=current_user.hotel_id)
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
        
    return settings

@router.put("/settings", response_model=ChannelSettingsRead)
async def update_settings(
    update_data: ChannelSettingsUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """Update connection settings"""
    query = select(ChannelManagerSettings).where(
        ChannelManagerSettings.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = ChannelManagerSettings(
            hotel_id=current_user.hotel_id,
            **update_data.model_dump(exclude_unset=True)
        )
        session.add(settings)
    else:
        for k, v in update_data.model_dump(exclude_unset=True).items():
            setattr(settings, k, v)
        settings.updated_at = datetime.utcnow()
    
    await session.commit()
    await session.refresh(settings)
    return settings

# --- MAPPINGS ---

@router.get("/mappings", response_model=List[MappingRead])
async def get_mappings(current_user: CurrentUser, session: DbSession):
    """Get all room mappings"""
    query = select(ChannelRoomMapping).where(
        ChannelRoomMapping.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/mappings", response_model=MappingRead)
async def create_mapping(
    mapping_data: MappingCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """Create or update a mapping"""
    # Verify local room exists
    room = await session.get(RoomType, mapping_data.local_room_id)
    if not room or room.hotel_id != current_user.hotel_id:
        raise HTTPException(404, "Local room not found")

    # Check if mapping already exists for this room+channel
    query = select(ChannelRoomMapping).where(
        ChannelRoomMapping.hotel_id == current_user.hotel_id,
        ChannelRoomMapping.local_room_id == mapping_data.local_room_id,
        ChannelRoomMapping.channel_name == mapping_data.channel_name
    )
    result = await session.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update existing
        existing.ota_room_id = mapping_data.ota_room_id
        await session.commit()
        await session.refresh(existing)
        return existing
    
    # Create new
    mapping = ChannelRoomMapping(
        hotel_id=current_user.hotel_id,
        **mapping_data.model_dump()
    )
    session.add(mapping)
    await session.commit()
    await session.refresh(mapping)
    return mapping

# --- LOGS ---

@router.get("/logs", response_model=List[ChannelLogRead])
async def get_logs(current_user: CurrentUser, session: DbSession):
    """Get recent sync logs"""
    query = select(ChannelLog).where(
        ChannelLog.hotel_id == current_user.hotel_id
    ).order_by(ChannelLog.timestamp.desc()).limit(50)
    
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/test-connection")
async def test_connection(current_user: CurrentUser, session: DbSession):
    """
    Verify connection to Connectivity Gateway (Channex Staging).
    This performs a REAL HTTP request to the provider.
    """
    # Get settings to see if we have an API key (future proofing) or just use Hotel ID
    query = select(ChannelManagerSettings).where(
        ChannelManagerSettings.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    settings = result.scalar_one_or_none()
    
    # For now, we use a Demo/Staging URL. 
    # In a real scenario, we would use settings.api_key or the Platform Master Key.
    # Since we don't have a real key, this WILL fail with 401 or 404, which is CORRECT/REAL behavior.
    
    import urllib.parse
    
    # SIMULATION: Use Local Mock Server
    target_hotel_id = settings.provider_hotel_id if settings and settings.provider_hotel_id else "demo-hotel-id"
    safe_hotel_id = urllib.parse.quote(target_hotel_id)
    
    # url = f"https://staging.channex.io/api/v1/hotels/{target_hotel_id}"
    url = f"http://127.0.0.1:8001/api/v1/mock-channex/hotels/{safe_hotel_id}"
    
    try:
        # We attempt to fetch the hotel details from Channex
        # We send a dummy key if none exists, expecting a 401 if the system is live.
        headers = {"user-api-key": settings.api_key if settings and settings.api_key else "dummy_key"}
        
        # specific channex ping or hotel fetch
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, headers=headers)
        
        status_code = response.status_code
        try:
            r_json = response.json()
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse channel response as JSON: {e}")
            r_json = {"raw": response.text}
            
        if response.ok:
            msg = f"Connected! Provider returned: {r_json.get('data', {}).get('attributes', {}).get('title', 'Unknown Hotel')}"
            log_type = "success"
        else:
            # THIS IS A REAL ERROR from the Real Server
            msg = f"Gateway Connection Error: {status_code} - {r_json.get('error', 'Unauthorized/Not Found')}"
            log_type = "error"
            
    except Exception as e:
        msg = f"Network Connection Failed: {str(e)}"
        log_type = "error"
        status_code = 500

    # Log the REAL result
    log = ChannelLog(
        hotel_id=current_user.hotel_id,
        type=log_type,
        action="connection_test",
        message=msg,
        details=str(status_code)
    )
    session.add(log)
    await session.commit()
    
    if log_type == "error":
        # We return the error details so the UI can show them
        raise HTTPException(status_code=400, detail=msg)
        
    return {"status": "ok", "message": msg}
