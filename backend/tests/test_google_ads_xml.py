import pytest
from app.services.google_hotel_ads.xml_generator import generate_hotel_list_xml
from app.brand_console.models import Hotel

def test_generate_hotel_list_xml():
    hotel = Hotel(
        id="test-hotel-123",
        name="Test Hotel",
        slug="test-hotel",
        address={"city": "Mumbai", "country": "India", "latitude": 19.076, "longitude": 72.877},
        contact={"phone": "+919876543210"}
    )

    xml = generate_hotel_list_xml([hotel])

    assert "<hotel>test-hotel-123</hotel>" in xml
    assert "<name>Test Hotel</name>" in xml
    assert "<latitude>19.076</latitude>" in xml
    assert "<longitude>72.877</longitude>" in xml
    assert "<component name=\"city\">Mumbai</component>" in xml
