import pytest
from httpx import AsyncClient
from app.models.room import RoomType

@pytest.mark.asyncio
async def test_get_rooms_unauthorized(client: AsyncClient):
    """Unauthorized users cannot see rooms"""
    response = await client.get("/api/v1/rooms")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_create_room_unauthorized(client: AsyncClient):
    """Unauthorized users cannot create rooms"""
    room_data = {
        "name": "Luxury Suite",
        "base_price": 5000,
        "total_inventory": 5,
        "capacity": 2
    }
    response = await client.post("/api/v1/rooms", json=room_data)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_delete_room_non_existent(client: AsyncClient):
    """Deleting non-existent room should be caught if authorized (tested as 401 here)"""
    response = await client.delete("/api/v1/rooms/non-existent-id")
    assert response.status_code == 401
