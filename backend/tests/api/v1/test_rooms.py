"""
Room API tests — covers auth, CRUD lifecycle, validation, and edge cases.
"""
import pytest
from httpx import AsyncClient

from tests.conftest import seeded_room  # noqa: F401 (used as fixture)


# ---------------------------------------------------------------------------
# Auth boundary
# ---------------------------------------------------------------------------

async def test_list_rooms_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/rooms")
    assert res.status_code == 401


async def test_create_room_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/rooms", json={"name": "X", "base_price": 100})
    assert res.status_code == 401


async def test_delete_room_requires_auth(client: AsyncClient):
    res = await client.delete("/api/v1/rooms/some-id")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# List rooms
# ---------------------------------------------------------------------------

async def test_list_rooms_returns_list(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/rooms")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ---------------------------------------------------------------------------
# Create room
# ---------------------------------------------------------------------------

async def test_create_room_minimal_fields(auth_client: AsyncClient):
    payload = {"name": "Standard Room", "base_price": 1500.0}
    res = await auth_client.post("/api/v1/rooms", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Standard Room"
    assert body["base_price"] == 1500.0
    assert "id" in body
    assert "hotel_id" in body


async def test_create_room_full_fields(auth_client: AsyncClient):
    payload = {
        "name": "Luxury Suite",
        "base_price": 8000.0,
        "total_inventory": 3,
        "base_occupancy": 2,
        "max_occupancy": 4,
        "max_children": 2,
        "bed_type": "King",
        "room_size": 800,
        "view": "Ocean View",
        "extra_person_price": 500.0,
        "is_active": True,
    }
    res = await auth_client.post("/api/v1/rooms", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Luxury Suite"
    assert body["bed_type"] == "King"
    assert body["view"] == "Ocean View"
    assert body["total_inventory"] == 3


async def test_create_room_negative_price_rejected(auth_client: AsyncClient):
    res = await auth_client.post(
        "/api/v1/rooms", json={"name": "Bad Room", "base_price": -100}
    )
    assert res.status_code == 422


async def test_create_room_missing_name_rejected(auth_client: AsyncClient):
    res = await auth_client.post("/api/v1/rooms", json={"base_price": 1000})
    assert res.status_code == 422


async def test_create_room_missing_price_rejected(auth_client: AsyncClient):
    res = await auth_client.post("/api/v1/rooms", json={"name": "No Price Room"})
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Get single room
# ---------------------------------------------------------------------------

async def test_get_room_by_id(auth_client: AsyncClient, seeded_room):
    res = await auth_client.get(f"/api/v1/rooms/{seeded_room.id}")
    assert res.status_code == 200
    assert res.json()["id"] == seeded_room.id
    assert res.json()["name"] == seeded_room.name


async def test_get_room_not_found(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/rooms/00000000-does-not-exist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Update room
# ---------------------------------------------------------------------------

async def test_update_room_name(auth_client: AsyncClient, seeded_room):
    res = await auth_client.patch(
        f"/api/v1/rooms/{seeded_room.id}",
        json={"name": "Updated Room Name"},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Room Name"


async def test_update_room_price(auth_client: AsyncClient, seeded_room):
    res = await auth_client.patch(
        f"/api/v1/rooms/{seeded_room.id}",
        json={"base_price": 9999.0},
    )
    assert res.status_code == 200
    assert res.json()["base_price"] == 9999.0


async def test_update_room_not_found(auth_client: AsyncClient):
    res = await auth_client.patch(
        "/api/v1/rooms/00000000-does-not-exist",
        json={"name": "Ghost Room"},
    )
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Delete room
# ---------------------------------------------------------------------------

async def test_delete_room_lifecycle(auth_client: AsyncClient):
    """Create → verify present → delete → verify gone."""
    create_res = await auth_client.post(
        "/api/v1/rooms", json={"name": "Temp Room", "base_price": 1000.0}
    )
    assert create_res.status_code == 201
    room_id = create_res.json()["id"]

    # Verify it's in the list
    list_res = await auth_client.get("/api/v1/rooms")
    ids = [r["id"] for r in list_res.json()]
    assert room_id in ids

    # Delete
    del_res = await auth_client.delete(f"/api/v1/rooms/{room_id}")
    assert del_res.status_code == 204

    # Verify gone
    get_res = await auth_client.get(f"/api/v1/rooms/{room_id}")
    assert get_res.status_code == 404


async def test_delete_nonexistent_room(auth_client: AsyncClient):
    res = await auth_client.delete("/api/v1/rooms/00000000-does-not-exist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Cross-hotel isolation
# ---------------------------------------------------------------------------

async def test_created_room_belongs_to_correct_hotel(auth_client: AsyncClient, seeded_hotel):
    res = await auth_client.post(
        "/api/v1/rooms", json={"name": "Hotel Check Room", "base_price": 2000.0}
    )
    assert res.status_code == 201
    assert res.json()["hotel_id"] == seeded_hotel.id
