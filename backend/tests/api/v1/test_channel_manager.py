"""
Channel Manager Tests
Covers:
  - GET /channel-manager/settings  — auth guard, response shape
  - GET /channel-manager/mappings  — auth guard, returns list
  - GET /channel-manager/logs      — auth guard, returns list
  - PUT /channel-manager/settings  — only OWNER can update
  - POST /channel-manager/test-connection — only OWNER can trigger
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestChannelSettings:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/channel-manager/settings")
        assert r.status_code == 401

    async def test_returns_settings_shape(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/channel-manager/settings")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        # Core fields the frontend reads from channel settings
        for key in ("provider", "is_connected"):
            assert key in data, f"Channel settings missing key: '{key}'"

    async def test_staff_cannot_update_settings(self, staff_client: AsyncClient):
        r = await staff_client.put("/api/v1/channel-manager/settings", json={
            "is_enabled": True,
        })
        assert r.status_code == 403

    async def test_staff_cannot_test_connection(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/channel-manager/test-connection")
        assert r.status_code == 403


class TestChannelMappings:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/channel-manager/mappings")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/channel-manager/mappings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_staff_cannot_create_mapping(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/channel-manager/mappings", json={
            "room_type_id": "fake-id",
            "channel_room_id": "ota-room-123",
            "channel_name": "booking.com",
        })
        assert r.status_code == 403


class TestChannelLogs:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/v1/channel-manager/logs")
        assert r.status_code == 401

    async def test_returns_list(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/channel-manager/logs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
