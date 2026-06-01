import pytest
from httpx import AsyncClient
from app.models.booking import BookingStatus

@pytest.mark.asyncio
async def test_booking_flow_mock(client: AsyncClient):
    """
    Ek basic test jo ye check karta hai ki booking creation logic
    bina crash hue response deta hai.
    """
    # 1. Create a dummy booking request
    booking_data = {
        "check_in": "2024-12-01",
        "check_out": "2024-12-05",
        "guest": {
            "first_name": "Test",
            "last_name": "User",
            "email": "test@example.com",
            "phone": "1234567890"
        },
        "rooms": [
            {
                "room_type_id": "rt_123",
                "room_type_name": "Deluxe Room",
                "price_per_night": 2000,
                "total_price": 8000,
                "occupancy": {"adults": 2, "children": 0}
            }
        ],
        "total_amount": 8000
    }

    # Note: Unauthorized access check
    response = await client.post("/api/v1/bookings", json=booking_data)
    # Auth ke bina 401 aana chahiye
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_payment_unauthorized(client: AsyncClient):
    """Security check: Bina login ke payment create nahi hona chahiye"""
    payment_data = {
        "booking_id": "bk_123",
        "amount": 1000,
        "payment_method": "cash",
        "status": "completed"
    }
    response = await client.post("/api/v1/payments", json=payment_data)
    assert response.status_code == 401
