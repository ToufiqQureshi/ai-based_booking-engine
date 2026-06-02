"""
Rate Plan API tests — lifecycle, validation, delete protection.
"""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Auth boundary
# ---------------------------------------------------------------------------

async def test_list_rate_plans_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/rates/plans")
    assert res.status_code == 401


async def test_create_rate_plan_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/rates/plans", json={"name": "Test"})
    assert res.status_code == 401


async def test_delete_rate_plan_requires_auth(client: AsyncClient):
    res = await client.delete("/api/v1/rates/plans/some-id")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# List rate plans
# ---------------------------------------------------------------------------

async def test_list_rate_plans_returns_list(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/rates/plans")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ---------------------------------------------------------------------------
# Create rate plan
# ---------------------------------------------------------------------------

async def test_create_rate_plan_minimal(auth_client: AsyncClient):
    res = await auth_client.post(
        "/api/v1/rates/plans",
        json={"name": "Base Rate", "meal_plan": "EP"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Base Rate"
    assert body["meal_plan"] == "EP"
    assert "id" in body
    assert "hotel_id" in body


async def test_create_rate_plan_full_fields(auth_client: AsyncClient):
    payload = {
        "name": "Breakfast Included",
        "description": "Room with breakfast",
        "meal_plan": "CP",
        "price_adjustment": 500.0,
        "is_refundable": True,
        "cancellation_hours": 48,
        "min_los": 2,
        "advance_purchase_days": 7,
        "inclusions": ["Breakfast", "Free WiFi"],
        "is_active": True,
    }
    res = await auth_client.post("/api/v1/rates/plans", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["meal_plan"] == "CP"
    assert body["price_adjustment"] == 500.0
    assert body["cancellation_hours"] == 48
    assert "Breakfast" in body["inclusions"]


async def test_create_rate_plan_missing_name_rejected(auth_client: AsyncClient):
    res = await auth_client.post("/api/v1/rates/plans", json={"meal_plan": "EP"})
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Update rate plan
# ---------------------------------------------------------------------------

async def test_update_rate_plan_name(auth_client: AsyncClient, seeded_rate_plan):
    res = await auth_client.patch(
        f"/api/v1/rates/plans/{seeded_rate_plan.id}",
        json={"name": "Updated Plan Name"},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Plan Name"


async def test_update_rate_plan_price_adjustment(auth_client: AsyncClient, seeded_rate_plan):
    # PATCH uses RatePlanCreate (not partial), so name is required
    res = await auth_client.patch(
        f"/api/v1/rates/plans/{seeded_rate_plan.id}",
        json={"name": seeded_rate_plan.name, "price_adjustment": 750.0},
    )
    assert res.status_code == 200
    assert res.json()["price_adjustment"] == 750.0


async def test_update_rate_plan_not_found(auth_client: AsyncClient):
    res = await auth_client.patch(
        "/api/v1/rates/plans/00000000-does-not-exist",
        json={"name": "Ghost Plan"},
    )
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Delete rate plan
# ---------------------------------------------------------------------------

async def test_delete_rate_plan_lifecycle(auth_client: AsyncClient):
    """Create → verify in list → delete → verify gone."""
    create_res = await auth_client.post(
        "/api/v1/rates/plans",
        json={"name": "Temp Plan", "meal_plan": "EP"},
    )
    assert create_res.status_code == 200
    plan_id = create_res.json()["id"]

    list_res = await auth_client.get("/api/v1/rates/plans")
    ids = [p["id"] for p in list_res.json()]
    assert plan_id in ids

    del_res = await auth_client.delete(f"/api/v1/rates/plans/{plan_id}")
    assert del_res.status_code == 200

    list_res2 = await auth_client.get("/api/v1/rates/plans")
    ids2 = [p["id"] for p in list_res2.json()]
    assert plan_id not in ids2


async def test_delete_nonexistent_rate_plan(auth_client: AsyncClient):
    res = await auth_client.delete("/api/v1/rates/plans/00000000-does-not-exist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Data integrity
# ---------------------------------------------------------------------------

async def test_created_rate_plan_belongs_to_correct_hotel(auth_client: AsyncClient, seeded_hotel):
    res = await auth_client.post(
        "/api/v1/rates/plans",
        json={"name": "Hotel Check Plan"},
    )
    assert res.status_code == 200
    assert res.json()["hotel_id"] == seeded_hotel.id
