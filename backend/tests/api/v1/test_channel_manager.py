"""
Channel Manager — feature removed for launch (production audit 2026-07-02).

The old integration only ever talked to a localhost mock server
(http://127.0.0.1:8001/api/v1/mock-channex/...) and could not work in
production, so the router was unmounted and the domain package deleted.

These regression tests pin the removal: if anyone re-mounts a
/channel-manager route by accident, they must do so consciously
(with a real provider integration) and update these tests.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestChannelManagerRemoved:
    async def test_settings_endpoint_removed(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/channel-manager/settings")
        assert r.status_code == 404

    async def test_mappings_endpoint_removed(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/channel-manager/mappings")
        assert r.status_code == 404

    async def test_logs_endpoint_removed(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/channel-manager/logs")
        assert r.status_code == 404

    async def test_test_connection_endpoint_removed(self, auth_client: AsyncClient):
        r = await auth_client.post("/api/v1/channel-manager/test-connection")
        assert r.status_code == 404

    async def test_no_channel_manager_routes_registered(self):
        from main import app

        channel_routes = [
            route.path for route in app.routes
            if "channel-manager" in getattr(route, "path", "")
        ]
        assert channel_routes == []
