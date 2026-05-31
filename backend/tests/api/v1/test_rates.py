import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_rate_plans_unauthorized(client: AsyncClient):
    """Bina login ke rate plans nahi dikhne chahiye"""
    response = await client.get("/api/v1/rates/plans")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_create_rate_plan_unauthorized(client: AsyncClient):
    """Bina login ke rate plan create nahi hona chahiye"""
    plan_data = {
        "name": "Member Rate",
        "discount_type": "percentage",
        "discount_value": 10
    }
    response = await client.post("/api/v1/rates/plans", json=plan_data)
    assert response.status_code == 401
