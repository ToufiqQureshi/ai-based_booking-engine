"""
Booking API tests — auth, creation validation, status flow, guest data.
Requires seeded room and rate plan from conftest fixtures.
"""
import pytest
from datetime import date, timedelta
from httpx import AsyncClient


def _future_dates(nights: int = 2):
    check_in = date.today() + timedelta(days=10)
    check_out = check_in + timedelta(days=nights)
    return check_in.isoformat(), check_out.isoformat()


def _booking_payload(room_type_id: str, rate_plan_id: str, nights: int = 2) -> dict:
    check_in, check_out = _future_dates(nights)
    return {
        "check_in": check_in,
        "check_out": check_out,
        "guest": {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@test.com",
            "phone": "9876543210",
        },
        "rooms": [
            {
                "room_type_id": room_type_id,
                "room_type_name": "Test Room",
                "rate_plan_id": rate_plan_id,
                "rate_plan_name": "Test Plan",
                "guests": 2,
                "children": 0,
                "price_per_night": 2500.0,
                "total_price": 2500.0 * nights,
            }
        ],
        "total_amount": 2500.0 * nights,
    }


# ---------------------------------------------------------------------------
# Auth boundary
# ---------------------------------------------------------------------------

async def test_list_bookings_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/bookings")
    assert res.status_code == 401


async def test_create_booking_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/bookings", json={"check_in": "2025-01-01"})
    assert res.status_code == 401


async def test_get_booking_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/bookings/some-id")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# List bookings
# ---------------------------------------------------------------------------

async def test_list_bookings_returns_list(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/bookings")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ---------------------------------------------------------------------------
# Create booking — validation
# ---------------------------------------------------------------------------

async def test_create_booking_missing_guest_rejected(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    check_in, check_out = _future_dates()
    payload = {
        "check_in": check_in,
        "check_out": check_out,
        "rooms": [
            {
                "room_type_id": seeded_room.id,
                "room_type_name": "Test Room",
                "rate_plan_id": seeded_rate_plan.id,
                "rate_plan_name": "Test Plan",
                "guests": 1,
                "children": 0,
                "price_per_night": 2500.0,
                "total_price": 5000.0,
            }
        ],
        "total_amount": 5000.0,
        # guest field intentionally missing
    }
    res = await auth_client.post("/api/v1/bookings", json=payload)
    assert res.status_code == 422


async def test_create_booking_empty_rooms_no_crash(auth_client: AsyncClient):
    """API accepts manual bookings with no rooms — must not 500."""
    check_in, check_out = _future_dates()
    payload = {
        "check_in": check_in,
        "check_out": check_out,
        "guest": {
            "first_name": "A",
            "last_name": "B",
            "email": "a@b.com",
        },
        "rooms": [],
        "total_amount": 0,
    }
    res = await auth_client.post("/api/v1/bookings", json=payload)
    assert res.status_code != 500


# ---------------------------------------------------------------------------
# Create booking — success
# ---------------------------------------------------------------------------

async def test_create_booking_success(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    payload = _booking_payload(seeded_room.id, seeded_rate_plan.id)
    res = await auth_client.post("/api/v1/bookings", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert "id" in body
    assert body["status"] in ("pending", "confirmed")
    assert body["guest"]["first_name"] == "John"
    assert body["total_amount"] == pytest.approx(5000.0)


async def test_created_booking_appears_in_list(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    payload = _booking_payload(seeded_room.id, seeded_rate_plan.id)
    create_res = await auth_client.post("/api/v1/bookings", json=payload)
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    list_res = await auth_client.get("/api/v1/bookings")
    ids = [b["id"] for b in list_res.json()]
    assert booking_id in ids


async def test_get_booking_by_id(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    payload = _booking_payload(seeded_room.id, seeded_rate_plan.id)
    create_res = await auth_client.post("/api/v1/bookings", json=payload)
    booking_id = create_res.json()["id"]

    get_res = await auth_client.get(f"/api/v1/bookings/{booking_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == booking_id


async def test_get_nonexistent_booking(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/bookings/00000000-does-not-exist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Status flow
# ---------------------------------------------------------------------------

async def test_confirm_booking(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    payload = _booking_payload(seeded_room.id, seeded_rate_plan.id)
    create_res = await auth_client.post("/api/v1/bookings", json=payload)
    booking_id = create_res.json()["id"]

    update_res = await auth_client.patch(
        f"/api/v1/bookings/{booking_id}",
        json={"status": "confirmed"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "confirmed"


async def test_cancel_booking(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    payload = _booking_payload(seeded_room.id, seeded_rate_plan.id)
    create_res = await auth_client.post("/api/v1/bookings", json=payload)
    booking_id = create_res.json()["id"]

    cancel_res = await auth_client.patch(
        f"/api/v1/bookings/{booking_id}",
        json={"status": "cancelled"},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


# ---------------------------------------------------------------------------
# Guest data integrity
# ---------------------------------------------------------------------------

async def test_booking_stores_guest_email(
    auth_client: AsyncClient, seeded_room, seeded_rate_plan
):
    payload = _booking_payload(seeded_room.id, seeded_rate_plan.id)
    payload["guest"]["email"] = "unique_guest@test.com"
    res = await auth_client.post("/api/v1/bookings", json=payload)
    assert res.status_code == 201
    assert res.json()["guest"]["email"] == "unique_guest@test.com"
