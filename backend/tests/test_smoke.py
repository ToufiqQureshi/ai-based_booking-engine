"""
Smoke tests — verify the app boots and basic routing works.
These must pass before any other test suite is meaningful.
"""
import pytest
from httpx import AsyncClient


async def test_health(client: AsyncClient):
    res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert "version" in body


async def test_root(client: AsyncClient):
    res = await client.get("/")
    assert res.status_code == 200
    assert "Staybooker" in res.json()["message"]


async def test_docs_reachable(client: AsyncClient):
    res = await client.get("/docs")
    assert res.status_code == 200


# --- Auth boundary ---

async def test_protected_route_no_token(client: AsyncClient):
    res = await client.get("/api/v1/users/me")
    assert res.status_code == 401


async def test_protected_route_bad_token(client: AsyncClient):
    res = await client.get(
        "/api/v1/rooms",
        headers={"Authorization": "Bearer this.is.not.valid"},
    )
    assert res.status_code == 401


async def test_auth_client_can_reach_protected_route(auth_client: AsyncClient):
    """Sanity check: auth_client dependency override works."""
    res = await auth_client.get("/api/v1/rooms")
    assert res.status_code == 200


# --- Public routes ---

async def test_public_hotel_not_found(client: AsyncClient):
    res = await client.get("/api/v1/public/hotels/slug/nonexistent-hotel-xyz-99999/widget-config")
    assert res.status_code == 404


async def test_unknown_route_returns_404(client: AsyncClient):
    res = await client.get("/api/v1/this-endpoint-does-not-exist")
    assert res.status_code == 404
