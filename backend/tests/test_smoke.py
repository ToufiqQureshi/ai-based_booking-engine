import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    """Test public health endpoint"""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_protected_route_unauthorized(client: AsyncClient):
    """Test a protected route without authorization header (should return 401)"""
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_public_route_not_found(client: AsyncClient):
    """Test public route that does not exist (should return 404)"""
    response = await client.get("/api/v1/public/hotels/slug/nonexistent-hotel-slug-12345/widget-config")
    assert response.status_code == 404
