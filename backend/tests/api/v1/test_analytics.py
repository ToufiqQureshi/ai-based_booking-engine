import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_analytics_dashboard_unauthorized(client: AsyncClient):
    """Unauthorized users cannot see analytics"""
    response = await client.get("/api/v1/analytics/dashboard")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_analytics_tracking_public(client: AsyncClient):
    """Public tracking endpoint should be accessible but needs valid hotel_id"""
    # This is a public tracking endpoint
    session_data = {
        "user_agent": "Mozilla/5.0",
        "referrer": "google.com",
        "page_url": "https://test.com/book"
    }
    # hotel_id is required in path
    response = await client.post("/api/v1/analytics/track/start?hotel_id=test-hotel", json=session_data)
    # Even if hotel not found, it might fail with 404 or something else, but not 401
    assert response.status_code != 401
