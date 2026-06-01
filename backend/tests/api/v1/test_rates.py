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

@pytest.mark.asyncio
async def test_rate_plan_lifecycle(auth_client: AsyncClient):
    """Deep Test: Create and update a rate plan"""
    plan_data = {
        "name": "Standard Rate",
        "description": "Base rate for all rooms",
        "meal_plan": "EP",
        "is_refundable": True,
        "cancellation_hours": 24,
        "is_active": True
    }
    # 1. Create
    res = await auth_client.post("/api/v1/rates/plans", json=plan_data)
    assert res.status_code == 200 # App returns 200 for rate plan creation
    plan = res.json()
    assert plan["name"] == "Standard Rate"

    # 2. Update
    update_data = {"name": "Updated Standard Rate"}
    update_res = await auth_client.patch(f"/api/v1/rates/plans/{plan['id']}", json=update_data)
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Standard Rate"
