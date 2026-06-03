import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import select
from datetime import datetime

from app.api.deps import DbSession
from app.models.audit import AuditLog
from app.models.chain import Chain
from app.models.hotel import Hotel
from app.models.user import User
from .hotels import get_super_admin, _get_client_ip

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chains", tags=["Super Admin Chains"])


class ChainCreateUpdate(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None


class ChainLinkRequest(BaseModel):
    hotel_ids: List[str]
    user_ids: List[str]


@router.get("", response_model=List[dict])
async def list_chains(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """List all chains with their linked hotels and users."""
    result = await session.execute(select(Chain))
    chains = result.scalars().all()
    
    chain_list = []
    for c in chains:
        # Fetch linked hotels
        hotels_res = await session.execute(select(Hotel).where(Hotel.chain_id == c.id))
        hotels = hotels_res.scalars().all()
        
        # Fetch linked users
        users_res = await session.execute(select(User).where(User.chain_id == c.id))
        users = users_res.scalars().all()
        
        chain_list.append({
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "logo_url": c.logo_url,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "hotels": [{"id": h.id, "name": h.name, "slug": h.slug} for h in hotels],
            "users": [{"id": u.id, "name": u.name, "email": u.email} for u in users]
        })
    return chain_list


@router.post("", response_model=dict)
async def create_chain(
    request: Request,
    data: ChainCreateUpdate,
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Create a new hotel chain group."""
    # Check if slug is unique
    existing = await session.execute(select(Chain).where(Chain.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A chain with this slug already exists")
        
    new_chain = Chain(
        name=data.name,
        slug=data.slug,
        logo_url=data.logo_url
    )
    session.add(new_chain)
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="CREATE_CHAIN",
        description=f"Created hotel chain group '{new_chain.name}' (slug: {new_chain.slug})",
        ip_address=_get_client_ip(request)
    ))
    await session.commit()
    await session.refresh(new_chain)
    return {"message": "Chain created successfully", "chain": new_chain}


@router.put("/{chain_id}", response_model=dict)
async def update_chain(
    chain_id: str,
    request: Request,
    data: ChainCreateUpdate,
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Update chain details."""
    chain = await session.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
        
    # Check if slug is unique
    if data.slug != chain.slug:
        existing = await session.execute(select(Chain).where(Chain.slug == data.slug))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="A chain with this slug already exists")
            
    chain.name = data.name
    chain.slug = data.slug
    chain.logo_url = data.logo_url
    chain.updated_at = datetime.utcnow()
    session.add(chain)
    
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="UPDATE_CHAIN",
        description=f"Updated details for hotel chain group '{chain.name}' (id: {chain.id})",
        ip_address=_get_client_ip(request)
    ))
    await session.commit()
    return {"message": "Chain updated successfully", "chain": chain}


@router.delete("/{chain_id}", response_model=dict)
async def delete_chain(
    chain_id: str,
    request: Request,
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Delete a chain (unlinks linked hotels and users)."""
    chain = await session.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
        
    # Unlink hotels
    hotels_res = await session.execute(select(Hotel).where(Hotel.chain_id == chain_id))
    for h in hotels_res.scalars().all():
        h.chain_id = None
        session.add(h)
        
    # Unlink users
    users_res = await session.execute(select(User).where(User.chain_id == chain_id))
    for u in users_res.scalars().all():
        u.chain_id = None
        session.add(u)
        
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="DELETE_CHAIN",
        description=f"Deleted hotel chain group '{chain.name}' (id: {chain.id})",
        ip_address=_get_client_ip(request)
    ))
    await session.delete(chain)
    await session.commit()
    return {"message": "Chain deleted successfully"}


@router.post("/{chain_id}/link", response_model=dict)
async def link_entities_to_chain(
    chain_id: str,
    request: Request,
    data: ChainLinkRequest,
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """Link multiple hotels and users to a chain and unlink removed ones."""
    chain = await session.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
        
    # 1. Update hotels
    # Get currently linked hotels
    curr_hotels_res = await session.execute(select(Hotel).where(Hotel.chain_id == chain_id))
    curr_hotels = curr_hotels_res.scalars().all()
    curr_hotel_ids = {h.id for h in curr_hotels}
    
    target_hotel_ids = set(data.hotel_ids)
    
    # Unlink removed hotels
    for h in curr_hotels:
        if h.id not in target_hotel_ids:
            h.chain_id = None
            session.add(h)
            session.add(AuditLog(
                user_id=super_admin.id,
                user_email=super_admin.email,
                action="UNLINK_HOTEL_FROM_CHAIN",
                description=f"Unlinked hotel '{h.name}' from chain group '{chain.name}'",
                ip_address=_get_client_ip(request)
            ))
            
    # Link new hotels
    for h_id in target_hotel_ids:
        if h_id not in curr_hotel_ids:
            h = await session.get(Hotel, h_id)
            if h:
                h.chain_id = chain_id
                session.add(h)
                session.add(AuditLog(
                    user_id=super_admin.id,
                    user_email=super_admin.email,
                    action="LINK_HOTEL_TO_CHAIN",
                    description=f"Linked hotel '{h.name}' to chain group '{chain.name}'",
                    ip_address=_get_client_ip(request)
                ))
                
    # 2. Update users
    # Get currently linked users
    curr_users_res = await session.execute(select(User).where(User.chain_id == chain_id))
    curr_users = curr_users_res.scalars().all()
    curr_user_ids = {u.id for u in curr_users}
    
    target_user_ids = set(data.user_ids)
    
    # Unlink removed users
    for u in curr_users:
        if u.id not in target_user_ids:
            u.chain_id = None
            session.add(u)
            session.add(AuditLog(
                user_id=super_admin.id,
                user_email=super_admin.email,
                action="UNLINK_USER_FROM_CHAIN",
                description=f"Unlinked user '{u.email}' from chain group '{chain.name}'",
                ip_address=_get_client_ip(request)
            ))
            
    # Link new users
    for u_id in target_user_ids:
        if u_id not in curr_user_ids:
            u = await session.get(User, u_id)
            if u:
                u.chain_id = chain_id
                session.add(u)
                session.add(AuditLog(
                    user_id=super_admin.id,
                    user_email=super_admin.email,
                    action="LINK_USER_TO_CHAIN",
                    description=f"Linked user '{u.email}' to chain group '{chain.name}' as brand manager",
                    ip_address=_get_client_ip(request)
                ))
                
    await session.commit()
    return {"message": "Entities linked successfully"}
