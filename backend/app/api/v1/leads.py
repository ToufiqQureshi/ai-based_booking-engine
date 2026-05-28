from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, desc
from app.api.deps import DbSession, CurrentUser
from app.models.lead import Lead

router = APIRouter()

@router.get("/", response_model=List[Lead])
async def list_leads(
    session: DbSession,
    current_user: CurrentUser,
    limit: int = Query(default=100, le=500),
    offset: int = 0
):
    """
    List all AI-generated leads for the current hotel.
    """
    query = (
        select(Lead)
        .where(Lead.hotel_id == current_user.hotel_id)
        .order_by(desc(Lead.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(query)
    leads = result.scalars().all()
    return leads

@router.patch("/{lead_id}", response_model=Lead)
async def update_lead_status(
    lead_id: str,
    status: str,
    session: DbSession,
    current_user: CurrentUser
):
    """
    Update the status of a lead (e.g., contacted, converted).
    """
    lead = await session.get(Lead, lead_id)
    if not lead or lead.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead.status = status
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    return lead
