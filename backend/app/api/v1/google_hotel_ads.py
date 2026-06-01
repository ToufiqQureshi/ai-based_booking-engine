from fastapi import APIRouter, Request, Response, HTTPException, Depends
from sqlmodel import select
from typing import List
from datetime import datetime, date
import xml.etree.ElementTree as ET

from app.api.deps import DbSession
from app.models.hotel import Hotel
from app.models.integration import IntegrationSettings
from app.models.room import RoomType
from app.models.rates import RatePlan

router = APIRouter(prefix="/google-hotel-ads", tags=["Google Hotel Ads"])

def generate_hotel_list_xml(hotels: List[Hotel]) -> str:
    root = ET.Element("listings")
    language = ET.SubElement(root, "language")
    language.text = "en"
    
    for hotel in hotels:
        listing = ET.SubElement(root, "listing")
        
        ET.SubElement(listing, "id").text = hotel.id
        ET.SubElement(listing, "name").text = hotel.name
        
        # Phone
        contact = hotel.contact or {}
        if contact.get("phone"):
            ET.SubElement(listing, "phone").text = contact["phone"]
            
        # Address
        address = hotel.address or {}
        address_node = ET.SubElement(listing, "address")
        
        if address.get("street"):
            c1 = ET.SubElement(address_node, "component", name="addr1")
            c1.text = address["street"]
        if address.get("city"):
            c2 = ET.SubElement(address_node, "component", name="city")
            c2.text = address["city"]
        if address.get("state"):
            c3 = ET.SubElement(address_node, "component", name="province")
            c3.text = address["state"]
        if address.get("postal_code"):
            c4 = ET.SubElement(address_node, "component", name="postal_code")
            c4.text = address["postal_code"]
        if address.get("country"):
            c5 = ET.SubElement(address_node, "component", name="country")
            c5.text = address["country"]
            
        # Lat/Long
        if address.get("latitude") and address.get("longitude"):
            ET.SubElement(listing, "latitude").text = str(address["latitude"])
            ET.SubElement(listing, "longitude").text = str(address["longitude"])

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")


@router.get("/hotels.xml", response_class=Response)
async def get_hotels_feed(session: DbSession):
    """
    Returns an XML feed of all hotels that have Google Hotel Ads enabled.
    """
    # Find hotels with Google Hotel Ads enabled
    query = (
        select(Hotel)
        .join(IntegrationSettings, IntegrationSettings.hotel_id == Hotel.id)
        .where(IntegrationSettings.google_hotel_ads_enabled == True)
        .where(Hotel.is_active == True)
    )
    result = await session.execute(query)
    hotels = result.scalars().all()

    xml_content = generate_hotel_list_xml(hotels)
    return Response(content=xml_content, media_type="application/xml")


@router.post("/pricing", response_class=Response)
async def pricing_pull_endpoint(request: Request, session: DbSession):
    """
    Handles Google's Pull requests for prices (Query XML).
    Returns a Transaction XML with rates and availability.
    """
    try:
        body = await request.body()
        # Parse Google's Query XML
        root = ET.fromstring(body)
        
        # Build Transaction XML
        trans_root = ET.Element("Transaction", timestamp=datetime.utcnow().isoformat() + "Z", id="staybooker-pull")
        
        # Extract requests (Google sends multiple PropertyContext/Room/Dates in one Query)
        # For simplicity in this v1, we just return a skeleton structure or an error if we can't parse it.
        # A real implementation would query the inventory based on dates and guests.
        
        for item in root.findall(".//PropertyContext"):
            # Extract basic query params (dates, occupancy)
            # This is a placeholder for actual parsing logic which would be extensive
            pass

        xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(trans_root, encoding="unicode")
        return Response(content=xml_content, media_type="application/xml")
    
    except Exception as e:
        # Return generic error transaction
        error_root = ET.Element("Transaction", timestamp=datetime.utcnow().isoformat() + "Z", id="error")
        error_node = ET.SubElement(error_root, "Error")
        error_node.text = str(e)
        xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(error_root, encoding="unicode")
        return Response(content=xml_content, media_type="application/xml")
