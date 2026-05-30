from fastapi import APIRouter, Depends, Response, Header, HTTPException
from sqlmodel import select
from app.api.deps import DbSession
from app.models.hotel import Hotel
from app.services.google_hotel_ads.xml_generator import generate_hotel_list_xml
import logging

router = APIRouter(prefix="/google", tags=["Google Hotel Ads"])

@router.get("/feed/hotels.xml")
async def get_hotel_list_feed(
    session: DbSession,
    user_agent: str = Header(None)
):
    """
    Publicly accessible endpoint for Google to fetch the Hotel List Feed.
    In production, this should be IP-restricted to Google's crawlers.
    """
    # Only include hotels that have GHA enabled
    query = select(Hotel).where(Hotel.feature_google_ads == True)
    result = await session.execute(query)
    hotels = result.scalars().all()

    xml_content = generate_hotel_list_xml(hotels)

    return Response(
        content=xml_content,
        media_type="application/xml"
    )

@router.get("/feed/ari.xml")
async def get_ari_feed(
    session: DbSession,
    hotel_id: str
):
    """
    Fetch ARI (Availability, Rates, and Inventory) for a specific hotel.
    Google Pull mode calls this for specific properties.
    """
    # Logic to fetch room rates and availability for the next 330 days
    # and convert to XML using the service.

    # Placeholder for actual ARI logic
    return Response(
        content="<Transaction />",
        media_type="application/xml"
    )

@router.post("/sync/push")
async def trigger_google_push(
    hotel_id: str,
    session: DbSession
):
    """
    Endpoint called internally when rates change to push updates to Google.
    """
    # Logic to send a POST request to Google's ARI endpoint
    # Reference: https://developers.google.com/hotels/hotel-prices/dev-guide/ari-overview#push-delivery-mode
    return {"status": "success", "message": "Push sync triggered"}
