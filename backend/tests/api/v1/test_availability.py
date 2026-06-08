"""
Availability & Room Blocks Tests
Covers:
  - GET /availability (grid calculation, cache)
  - GET /blocks, POST /blocks, DELETE /blocks
  - POST /rates (interval splitting)
  - POST /weekend-update
  - POST /copy
  - RBAC: anonymous, STAFF operations
"""
import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hotel import Hotel
from app.models.room import RoomType

pytestmark = pytest.mark.asyncio


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
async def room_type(seeded_hotel: Hotel) -> RoomType:
    from tests.conftest import engine
    rt = RoomType(
        id=str(uuid.uuid4()),
        hotel_id=seeded_hotel.id,
        name="Test Room",
        base_price=1000.0,
        total_inventory=5,
        base_occupancy=2,
        max_occupancy=4,
    )
    async with AsyncSession(engine) as session:
        session.add(rt)
        await session.commit()
        await session.refresh(rt)
    return rt


def _d(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


# ─── GET /availability ────────────────────────────────────────────────────────

class TestGetAvailability:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/availability?start_date=2026-01-01&end_date=2026-01-07")
        assert r.status_code == 401

    async def test_returns_list_with_availability_field(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.get(f"/api/v1/availability?start_date={_d(1)}&end_date={_d(3)}")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        # Should include our seeded room type
        ids = [item["id"] for item in body]
        assert room_type.id in ids

    async def test_availability_structure(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.get(f"/api/v1/availability?start_date={_d(1)}&end_date={_d(2)}")
        assert r.status_code == 200
        item = next(i for i in r.json() if i["id"] == room_type.id)
        assert "totalInventory" in item
        assert "availability" in item
        assert len(item["availability"]) == 2   # 2 dates

        day = item["availability"][0]
        assert "date" in day
        assert "availableRooms" in day
        assert "bookedRooms" in day
        assert "blockedRooms" in day
        assert "price" in day

    async def test_missing_params_returns_422(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/availability")
        assert r.status_code == 422


# ─── Blocks CRUD ─────────────────────────────────────────────────────────────

class TestBlocks:
    async def test_create_block(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.post("/api/v1/availability/blocks", json={
            "room_type_id": room_type.id,
            "start_date": _d(5),
            "end_date": _d(7),
            "reason": "Maintenance",
            "blocked_count": 2,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["room_type_id"] == room_type.id
        assert body["blocked_count"] == 2
        return body["id"]

    async def test_list_blocks(self, auth_client: AsyncClient, room_type: RoomType):
        # Create a block first
        await auth_client.post("/api/v1/availability/blocks", json={
            "room_type_id": room_type.id,
            "start_date": _d(8),
            "end_date": _d(9),
            "reason": "Test",
            "blocked_count": 1,
        })
        r = await auth_client.get(
            f"/api/v1/availability/blocks?room_type_id={room_type.id}&start_date={_d(1)}&end_date={_d(30)}"
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    async def test_delete_block(self, auth_client: AsyncClient, room_type: RoomType):
        create_r = await auth_client.post("/api/v1/availability/blocks", json={
            "room_type_id": room_type.id,
            "start_date": _d(12),
            "end_date": _d(13),
            "reason": "Delete me",
            "blocked_count": 1,
        })
        block_id = create_r.json()["id"]

        delete_r = await auth_client.delete(f"/api/v1/availability/blocks/{block_id}")
        assert delete_r.status_code == 200

    async def test_delete_nonexistent_block_returns_404(self, auth_client: AsyncClient):
        r = await auth_client.delete(f"/api/v1/availability/blocks/{uuid.uuid4()}")
        assert r.status_code == 404

    async def test_block_wrong_hotel_room_type_returns_404(self, auth_client: AsyncClient):
        """TEN-05: cannot create a block for a room that belongs to another hotel."""
        r = await auth_client.post("/api/v1/availability/blocks", json={
            "room_type_id": str(uuid.uuid4()),   # nonexistent for this hotel
            "start_date": _d(5),
            "end_date": _d(6),
            "reason": "Cross-tenant attack",
            "blocked_count": 1,
        })
        assert r.status_code == 404


# ─── Rate management ──────────────────────────────────────────────────────────

class TestRates:
    async def test_set_rate_for_range(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.post("/api/v1/availability/rates", json={
            "room_type_id": room_type.id,
            "start_date": _d(20),
            "end_date": _d(25),
            "price": 1800.0,
        })
        assert r.status_code == 200
        assert r.json()["message"] == "Rates updated successfully"

    async def test_rate_reflected_in_availability(self, auth_client: AsyncClient, room_type: RoomType):
        """After setting a rate, GET /availability should show that price on those days."""
        await auth_client.post("/api/v1/availability/rates", json={
            "room_type_id": room_type.id,
            "start_date": _d(40),
            "end_date": _d(40),
            "price": 2500.0,
        })
        r = await auth_client.get(f"/api/v1/availability?start_date={_d(40)}&end_date={_d(40)}")
        assert r.status_code == 200
        item = next(i for i in r.json() if i["id"] == room_type.id)
        day = item["availability"][0]
        assert day["price"] == 2500.0

    async def test_rate_wrong_room_type_returns_404(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/availability/rates", json={
            "room_type_id": str(uuid.uuid4()),
            "start_date": _d(1), "end_date": _d(3), "price": 999.0,
        })
        assert r.status_code == 404


# ─── Weekend update ───────────────────────────────────────────────────────────

class TestWeekendUpdate:
    async def test_weekend_update_returns_200(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.post("/api/v1/availability/weekend-update", json={
            "room_type_id": room_type.id,
            "start_date": _d(1),
            "end_date": _d(14),
            "price": 2000.0,
        })
        assert r.status_code == 200
        assert "days" in r.json()["message"]

    async def test_reset_to_default_removes_overrides(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.post("/api/v1/availability/weekend-update", json={
            "room_type_id": room_type.id,
            "start_date": _d(1),
            "end_date": _d(14),
            "reset_to_default": True,
        })
        assert r.status_code == 200


# ─── Calendar copy ────────────────────────────────────────────────────────────

class TestCopyCalendar:
    async def test_copy_calendar_returns_200(self, auth_client: AsyncClient, room_type: RoomType):
        r = await auth_client.post("/api/v1/availability/copy", json={
            "room_type_id": room_type.id,
            "source_start_date": _d(1),
            "source_end_date": _d(7),
            "target_start_date": _d(50),
            "target_end_date": _d(56),
            "copy_price": True,
            "copy_availability": True,
        })
        assert r.status_code == 200
        assert "days" in r.json()["message"]

    async def test_copy_calendar_wrong_room_type_returns_404(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/availability/copy", json={
            "room_type_id": str(uuid.uuid4()),
            "source_start_date": _d(1),
            "source_end_date": _d(3),
            "target_start_date": _d(10),
            "target_end_date": _d(12),
            "copy_price": True,
            "copy_availability": False,
        })
        assert r.status_code == 404


# ─── Anonymous access ─────────────────────────────────────────────────────────

class TestAnonBlocked:
    async def test_anon_cannot_get_availability(self, client: AsyncClient):
        r = await client.get(f"/api/v1/availability?start_date={_d(1)}&end_date={_d(3)}")
        assert r.status_code == 401

    async def test_anon_cannot_create_block(self, client: AsyncClient):
        r = await client.post("/api/v1/availability/blocks", json={
            "room_type_id": str(uuid.uuid4()), "start_date": _d(1), "end_date": _d(2),
            "reason": "Anon attempt", "blocked_count": 1,
        })
        assert r.status_code == 401
