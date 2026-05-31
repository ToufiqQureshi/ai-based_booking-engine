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

@pytest.mark.asyncio
async def test_get_rooms_authenticated(auth_client: AsyncClient):
    """Authenticated users can call the rooms API"""
    # This might return 200 [] if DB is empty but accessible
    response = await auth_client.get("/api/v1/rooms")
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_create_room_full_lifecycle(auth_client: AsyncClient):
    """Deep Test: Create a room and verify it appears in the list"""
    room_data = {
        "name": "Super Deep Test Room",
        "base_price": 9999,
        "total_inventory": 1,
        "capacity": 2
    }
    # 1. Create
    create_res = await auth_client.post("/api/v1/rooms", json=room_data)
    assert create_res.status_code == 201
    created_room = create_res.json()
    assert created_room["name"] == "Super Deep Test Room"

    # 2. Verify in list
    list_res = await auth_client.get("/api/v1/rooms")
    assert list_res.status_code == 200
    rooms = list_res.json()
    assert any(r["id"] == created_room["id"] for r in rooms)
