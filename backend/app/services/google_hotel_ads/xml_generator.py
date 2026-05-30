import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Optional
from app.models.hotel import Hotel
from sqlmodel import Session, select

def generate_hotel_list_xml(hotels: List[Hotel]) -> str:
    """
    Generates Google Hotel List (Listings) XML feed.
    Reference: https://developers.google.com/hotels/hotel-prices/xml-reference/hotel-list-feed
    """
    listings = ET.Element("listings")

    for hotel in hotels:
        hotel_element = ET.SubElement(listings, "listing")

        # Unique identifier for the hotel
        ET.SubElement(hotel_element, "hotel").text = str(hotel.id)

        # Hotel name
        ET.SubElement(hotel_element, "name").text = hotel.name

        # Address details
        address = hotel.address or {}
        address_element = ET.SubElement(hotel_element, "address")
        address_element.set("format", "simple")

        ET.SubElement(address_element, "component", name="addr1").text = address.get("street", "")
        ET.SubElement(address_element, "component", name="city").text = address.get("city", "")
        ET.SubElement(address_element, "component", name="province").text = address.get("state", "")
        ET.SubElement(address_element, "component", name="postal_code").text = address.get("postal_code", "")
        ET.SubElement(address_element, "component", name="country").text = address.get("country", "IN")

        # Lat/Long coordinates (critical for Google)
        if address.get("latitude") and address.get("longitude"):
            latitude = ET.SubElement(hotel_element, "latitude")
            latitude.text = str(address.get("latitude"))
            longitude = ET.SubElement(hotel_element, "longitude")
            longitude.text = str(address.get("longitude"))

        # Contact info
        contact = hotel.contact or {}
        if contact.get("phone"):
            ET.SubElement(hotel_element, "phone", type="main").text = contact.get("phone")

        # Website (Landing Page URL)
        # Note: Google uses landing pages file normally, but listing can have a fallback
        if contact.get("website"):
            ET.SubElement(hotel_element, "website").text = contact.get("website")

    # Generate XML string with declaration
    return ET.tostring(listings, xml_declaration=True, encoding='utf-8', method='xml').decode('utf-8')

def generate_pos_xml(base_url: str) -> str:
    """
    Generates Landing Pages (Points of Sale) XML.
    Reference: https://developers.google.com/hotels/hotel-prices/dev-guide/pos-syntax
    """
    pos_root = ET.Element("PointsOfSale")

    # We define one main Point of Sale for the entire platform
    pos = ET.SubElement(pos_root, "PointOfSale", id="staybooker_default")

    # Display name (can be hotel name or platform name)
    ET.SubElement(pos, "DisplayNames", display_text="Staybooker Direct", display_language="en")

    # Match criteria (allow for all)
    ET.SubElement(pos, "Match", status="yes")

    # The dynamic landing page URL with Google variables
    # Reference: https://developers.google.com/hotels/hotel-prices/dev-guide/pos-urls
    # URL structure: https://app.staybooker.ai/book/(SLUG)/rooms?check_in=(CHECKIN)&check_out=(CHECKOUT)...
    landing_url = f"{base_url}/book/{{{{HOTEL_ID}}}}/rooms?check_in={{{{CHECKIN}}}}&check_out={{{{CHECKOUT}}}}&adults={{{{ADULTS}}}}&children={{{{CHILDREN}}}}"
    ET.SubElement(pos, "URL").text = landing_url

    return ET.tostring(pos_root, xml_declaration=True, encoding='utf-8', method='xml').decode('utf-8')

def generate_ari_xml(hotel: Hotel, room_types: List) -> str:
    """
    Generates Availability, Rates, and Inventory (ARI) XML.
    This example focuses on the Transaction (Property Data) message for pricing.
    Reference: https://developers.google.com/hotels/hotel-prices/dev-guide/ari-overview
    """
    # For Pull delivery mode, Google expects a <Transaction> message
    transaction = ET.Element("Transaction", timestamp=datetime.utcnow().isoformat() + "Z", id=str(hotel.id))

    for room in room_types:
        # Each Result represents a specific itinerary (date + length of stay)
        # For simplicity in this generator, we would iterate through a date range
        # but here we just provide the structure for a single date.

        # In a real implementation, this would be a loop over dates and stay lengths
        pass

    return ET.tostring(transaction, encoding='utf-8', method='xml').decode('utf-8')
