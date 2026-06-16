from typing import List
from datetime import datetime
from fastapi import Depends, APIRouter, HTTPException, status, BackgroundTasks
from sqlmodel import select

from app.core.auth.deps import CurrentUser, DbSession, require_hotel_role
from app.rate_shopper.competitor import Competitor, CompetitorCreate, CompetitorRead

router = APIRouter(prefix="/competitors", tags=["Competitors"])

@router.get("", response_model=List[CompetitorRead])
async def get_competitors(current_user: CurrentUser, session: DbSession):
    """
    Get all competitors for the current hotel.
    """
    query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("", response_model=CompetitorRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def create_competitor(
    competitor_data: CompetitorCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Add a new competitor hotel.
    """
    # Check limit of 5 competitors
    count_query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    res = await session.execute(count_query)
    existing_count = len(res.scalars().all())
    if existing_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can monitor a maximum of 5 competitors."
        )

    competitor = Competitor(
        **competitor_data.model_dump(),
        hotel_id=current_user.hotel_id
    )
    session.add(competitor)
    await session.commit()
    await session.refresh(competitor)
    return competitor

@router.delete("/{competitor_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def delete_competitor(
    competitor_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Delete a competitor and all its rates.
    """
    query = select(Competitor).where(
        Competitor.id == competitor_id,
        Competitor.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    competitor = result.scalar_one_or_none()
    
    if not competitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Competitor not found"
        )
        
    await session.delete(competitor)
    await session.commit()

@router.post("/scrape", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))])
async def trigger_competitor_scrape(
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Trigger real-time scrape for all active competitors.
    """
    query = select(Competitor).where(
        Competitor.hotel_id == current_user.hotel_id,
        Competitor.is_active == True
    )
    result = await session.execute(query)
    competitors = result.scalars().all()
    
    if not competitors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active competitors configured to scrape."
        )
        
    # Check if any scraper is currently running
    if any(c.last_scrape_status == "Running" for c in competitors):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scrape is already running in background."
        )
        
    # Set status to running in DB
    for c in competitors:
        c.last_scrape_status = "Running"
        c.scrape_started_at = datetime.utcnow()
        c.last_scrape_error = None
        session.add(c)
    await session.commit()

    # Import scripts function to run in background
    # We pass hotel_id to run dynamically
    from scripts.rate_shopper_matrix import run_rate_shopper_for_hotel
    background_tasks.add_task(run_rate_shopper_for_hotel, current_user.hotel_id)
    
    return {"message": "Competitor rate scraping job triggered."}

