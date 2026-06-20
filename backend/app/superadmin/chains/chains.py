import logging
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import select
from datetime import datetime

from app.core.auth.deps import DbSession
from app.system.audit import AuditLog
from app.superadmin.chains.chain import Chain
from app.brand_console.hotel import Hotel
from app.guests.user import User
from app.superadmin.hotels.hotels import get_super_admin, _get_client_ip, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chains", tags=["Super Admin Chains"])


class ChainCreateUpdate(BaseModel):
    name: str
    slug: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None


class ChainLinkRequest(BaseModel):
    hotel_ids: List[str]
    user_ids: List[str]


@router.get("", response_model=List[dict])
async def list_chains(
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.read")),
):
    """List all chains with linked hotels and users — bulk-loaded, no N+1."""
    chains = (await session.execute(select(Chain))).scalars().all()
    if not chains:
        return []

    chain_ids = [c.id for c in chains]

    # Bulk fetch — 2 queries total instead of N*2
    all_hotels = (await session.execute(
        select(Hotel).where(Hotel.chain_id.in_(chain_ids))
    )).scalars().all()
    all_users = (await session.execute(
        select(User).where(User.chain_id.in_(chain_ids))
    )).scalars().all()

    hotels_by_chain: Dict[str, list] = {}
    for h in all_hotels:
        hotels_by_chain.setdefault(h.chain_id, []).append(
            {"id": h.id, "name": h.name, "slug": h.slug}
        )
    users_by_chain: Dict[str, list] = {}
    for u in all_users:
        users_by_chain.setdefault(u.chain_id, []).append(
            {"id": u.id, "name": u.name, "email": u.email}
        )

    return [
        {
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "logo_url": c.logo_url,
            "primary_color": c.primary_color,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "hotels": hotels_by_chain.get(c.id, []),
            "users": users_by_chain.get(c.id, []),
        }
        for c in chains
    ]


@router.post("", response_model=dict)
async def create_chain(
    request: Request,
    data: ChainCreateUpdate,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
):
    """Create a new hotel chain group."""
    # Check if slug is unique
    existing = await session.execute(select(Chain).where(Chain.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A chain with this slug already exists")
        
    new_chain = Chain(
        name=data.name,
        slug=data.slug,
        logo_url=data.logo_url,
        primary_color=data.primary_color
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
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
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
    chain.primary_color = data.primary_color
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
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
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


class AddPropertyToChainRequest(BaseModel):
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


@router.post("/{chain_id}/add-property", response_model=dict)
async def add_property_to_chain(
    chain_id: str,
    request: Request,
    data: AddPropertyToChainRequest,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
):
    """Create a new hotel and immediately link it to the chain."""
    chain = await session.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")

    existing = (await session.execute(
        select(Hotel).where(Hotel.slug == data.slug)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Hotel slug already exists")

    hotel = Hotel(name=data.name, slug=data.slug, chain_id=chain_id)
    if data.email or data.phone:
        hotel.contact = {"email": data.email or "", "phone": data.phone or ""}
    hotel.address = {
        "city": data.city or "Unknown",
        "country": data.country or "India",
    }

    session.add(hotel)
    session.add(AuditLog(
        user_id=super_admin.id,
        user_email=super_admin.email,
        action="ADD_PROPERTY_TO_CHAIN",
        description=f"Created property '{data.name}' and linked to chain '{chain.name}'",
        ip_address=_get_client_ip(request),
    ))
    await session.commit()
    await session.refresh(hotel)
    return {
        "message": "Property created and linked to chain",
        "hotel": {"id": hotel.id, "name": hotel.name, "slug": hotel.slug},
    }


@router.post("/{chain_id}/link", response_model=dict)
async def link_entities_to_chain(
    chain_id: str,
    request: Request,
    data: ChainLinkRequest,
    session: DbSession,
    super_admin: User = Depends(require_permission("superadmin.hotels.write")),
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


