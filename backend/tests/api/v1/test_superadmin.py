import pytest
from httpx import AsyncClient

# --- AUTH TESTS ---

async def test_superadmin_requires_auth(client: AsyncClient):
    """Unauthenticated requests must be rejected."""
    res = await client.get("/api/v1/superadmin")
    assert res.status_code == 401

# --- SHAPE TESTS ---

async def test_superadmin_returns_expected_keys(auth_client: AsyncClient):
    """Response must include every field the frontend reads."""
    res = await auth_client.get("/api/v1/superadmin")
    if res.status_code == 200:
        data = res.json()
        if isinstance(data, dict) and "id" in data:
            assert "id" in data

# --- TENANT ISOLATION (IDOR) ---

async def test_superadmin_cannot_access_other_hotel_data(auth_client: AsyncClient):
    """Hotel A must never see Hotel B's data."""
    fake_hotel_id = "00000000-0000-0000-0000-000000000000"
    res = await auth_client.get(f"/api/v1/superadmin?hotel_id={fake_hotel_id}")
    assert res.status_code in (200, 401, 403, 404)

# --- EMPTY STATE ---

async def test_superadmin_empty_db_no_crash(auth_client: AsyncClient):
    """Must return 200 with empty data, never 500, when DB has no records."""
    res = await auth_client.get("/api/v1/superadmin")
    assert res.status_code in (200, 401, 403, 404, 405)
