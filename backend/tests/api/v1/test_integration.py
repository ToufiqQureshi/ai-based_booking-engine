"""
Integration API tests — settings CRUD, API key lifecycle, security.
"""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Auth boundary
# ---------------------------------------------------------------------------

async def test_get_settings_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/integration/settings")
    assert res.status_code == 401


async def test_put_settings_requires_auth(client: AsyncClient):
    res = await client.put("/api/v1/integration/settings", json={})
    assert res.status_code == 401


async def test_list_api_keys_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/integration/api-keys")
    assert res.status_code == 401


async def test_create_api_key_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/integration/api-keys", json={"name": "Test"})
    assert res.status_code == 401


async def test_widget_code_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/integration/widget-code")
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Integration settings GET
# ---------------------------------------------------------------------------

async def test_get_settings_returns_object(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/integration/settings")
    assert res.status_code == 200
    body = res.json()
    assert "hotel_id" in body
    assert "widget_theme" in body


async def test_get_settings_creates_defaults_if_missing(auth_client: AsyncClient):
    """Second call must also return 200 (idempotent)."""
    res1 = await auth_client.get("/api/v1/integration/settings")
    res2 = await auth_client.get("/api/v1/integration/settings")
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["hotel_id"] == res2.json()["hotel_id"]


async def test_get_settings_hides_ai_key_for_owner(auth_client: AsyncClient):
    """Non-super-admin should not see raw ai_api_key."""
    # First set a key
    await auth_client.put(
        "/api/v1/integration/settings",
        json={"ai_provider": "openai", "ai_api_key": "sk-secret-key-123"},
    )
    res = await auth_client.get("/api/v1/integration/settings")
    assert res.status_code == 200
    assert res.json().get("ai_api_key") is None


async def test_super_admin_sees_ai_key(super_admin_client: AsyncClient):
    """Super admin should receive the raw ai_api_key."""
    await super_admin_client.put(
        "/api/v1/integration/settings",
        json={"ai_api_key": "sk-visible-to-admin"},
    )
    res = await super_admin_client.get("/api/v1/integration/settings")
    assert res.status_code == 200
    assert res.json().get("ai_api_key") == "sk-visible-to-admin"


# ---------------------------------------------------------------------------
# Integration settings PUT
# ---------------------------------------------------------------------------

async def test_update_widget_theme(auth_client: AsyncClient):
    res = await auth_client.put(
        "/api/v1/integration/settings",
        json={"widget_theme": "dark"},
    )
    assert res.status_code == 200
    assert res.json()["widget_theme"] == "dark"


async def test_update_widget_primary_color(auth_client: AsyncClient):
    res = await auth_client.put(
        "/api/v1/integration/settings",
        json={"widget_primary_color": "#FF5733"},
    )
    assert res.status_code == 200
    assert res.json()["widget_primary_color"] == "#FF5733"


async def test_update_multiple_fields_at_once(auth_client: AsyncClient):
    res = await auth_client.put(
        "/api/v1/integration/settings",
        json={"widget_theme": "light", "widget_primary_color": "#123456"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["widget_theme"] == "light"
    assert body["widget_primary_color"] == "#123456"


async def test_update_settings_persists(auth_client: AsyncClient):
    """PUT value must be visible on subsequent GET."""
    await auth_client.put(
        "/api/v1/integration/settings",
        json={"widget_theme": "dark"},
    )
    get_res = await auth_client.get("/api/v1/integration/settings")
    assert get_res.json()["widget_theme"] == "dark"


# ---------------------------------------------------------------------------
# API Key lifecycle
# ---------------------------------------------------------------------------

async def test_list_api_keys_returns_list(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/integration/api-keys")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_create_api_key_returns_secret_once(auth_client: AsyncClient):
    # scopes is a comma-separated string in the model, not a list
    res = await auth_client.post(
        "/api/v1/integration/api-keys",
        json={"name": "Test Key", "scopes": "read:rooms,read:availability"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "secret_key" in body
    assert body["secret_key"].startswith("sk_live_")
    assert "id" in body
    assert body["name"] == "Test Key"


async def test_created_api_key_appears_in_list(auth_client: AsyncClient):
    create_res = await auth_client.post(
        "/api/v1/integration/api-keys",
        json={"name": "Listable Key"},
    )
    key_id = create_res.json()["id"]

    list_res = await auth_client.get("/api/v1/integration/api-keys")
    ids = [k["id"] for k in list_res.json()]
    assert key_id in ids


async def test_list_does_not_expose_secret_key(auth_client: AsyncClient):
    """List endpoint must never return the raw secret."""
    await auth_client.post(
        "/api/v1/integration/api-keys",
        json={"name": "Secret Check Key"},
    )
    list_res = await auth_client.get("/api/v1/integration/api-keys")
    for key in list_res.json():
        assert "secret_key" not in key


async def test_toggle_api_key(auth_client: AsyncClient):
    create_res = await auth_client.post(
        "/api/v1/integration/api-keys",
        json={"name": "Toggle Me"},
    )
    key_id = create_res.json()["id"]
    initial_active = create_res.json().get("is_active", True)

    toggle_res = await auth_client.put(f"/api/v1/integration/api-keys/{key_id}/toggle")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_active"] != initial_active

    # Toggle back
    toggle_res2 = await auth_client.put(f"/api/v1/integration/api-keys/{key_id}/toggle")
    assert toggle_res2.json()["is_active"] == initial_active


async def test_delete_api_key(auth_client: AsyncClient):
    create_res = await auth_client.post(
        "/api/v1/integration/api-keys",
        json={"name": "Delete Me"},
    )
    key_id = create_res.json()["id"]

    del_res = await auth_client.delete(f"/api/v1/integration/api-keys/{key_id}")
    assert del_res.status_code == 200

    list_res = await auth_client.get("/api/v1/integration/api-keys")
    ids = [k["id"] for k in list_res.json()]
    assert key_id not in ids


async def test_delete_nonexistent_api_key(auth_client: AsyncClient):
    res = await auth_client.delete("/api/v1/integration/api-keys/00000000-does-not-exist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Widget code
# ---------------------------------------------------------------------------

async def test_get_widget_code_structure(auth_client: AsyncClient):
    res = await auth_client.get("/api/v1/integration/widget-code")
    assert res.status_code == 200
    body = res.json()
    assert "html_code" in body
    assert "javascript_code" in body
    assert "css_code" in body
    assert "instructions" in body


async def test_widget_code_contains_hotel_slug(auth_client: AsyncClient, seeded_hotel):
    res = await auth_client.get("/api/v1/integration/widget-code")
    assert res.status_code == 200
    assert seeded_hotel.slug in res.json()["html_code"]
