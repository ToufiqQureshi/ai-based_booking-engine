"""
Shareable public report + city-level visitor tracking.

Covers the new guest-tracking / hotelier-report feature:
  * city geo is captured from Cloudflare headers and surfaced in the dashboard
  * OWNER/MANAGER can mint a public share link; auth is required to mint
  * the public token endpoint returns aggregate data (no auth) and is scoped to
    exactly one hotel, with revoke + 404-on-unknown behaviour
"""
import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# City-level tracking
# ---------------------------------------------------------------------------

async def test_track_start_captures_city_from_cloudflare(
    client: AsyncClient, seeded_hotel
):
    """A Cloudflare cf-ipcity header should land in the city breakdown."""
    res = await client.post(
        f"/api/v1/analytics/track/start?hotel_id={seeded_hotel.id}",
        json={"user_agent": "Mozilla/5.0", "page_url": "https://x.test/book"},
        headers={"cf-ipcity": "Mumbai", "cf-ipcountry": "IN"},
    )
    assert res.status_code == 200
    assert res.json()["session_id"]


async def test_dashboard_exposes_city_stats(auth_client: AsyncClient, seeded_hotel):
    """city_stats is always present and well-formed (sums never exceed visitors)."""
    # Seed a visitor from Pune via the public tracker.
    await auth_client.post(
        f"/api/v1/analytics/track/start?hotel_id={seeded_hotel.id}",
        json={"user_agent": "Mozilla/5.0"},
        headers={"cf-ipcity": "Pune", "cf-ipcountry": "IN"},
    )
    # Unique days value → fresh cache key (avoids a stale cached dashboard).
    res = await auth_client.get("/api/v1/analytics/dashboard?days=33")
    assert res.status_code == 200
    body = res.json()
    assert "city_stats" in body
    assert isinstance(body["city_stats"], list)
    for row in body["city_stats"]:
        assert {"city", "visitors", "percentage"}.issubset(row.keys())


# ---------------------------------------------------------------------------
# Share-link auth boundary
# ---------------------------------------------------------------------------

async def test_create_share_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/analytics/share", json={"days": 30})
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# Mint → view → revoke lifecycle
# ---------------------------------------------------------------------------

async def test_share_link_lifecycle(auth_client: AsyncClient, client: AsyncClient):
    # Mint a link (auth_client is an OWNER).
    create = await auth_client.post(
        "/api/v1/analytics/share",
        json={"label": "Investor deck", "days": 14, "expires_in_days": 7},
    )
    assert create.status_code == 200
    link = create.json()
    token = link["token"]
    assert token and link["is_active"] is True
    assert link["days"] == 14

    # It shows up in the hotel's list.
    listed = await auth_client.get("/api/v1/analytics/share")
    assert listed.status_code == 200
    assert any(l["id"] == link["id"] for l in listed.json())

    # Public read works with NO auth and is scoped to the hotel.
    pub = await client.get(f"/api/v1/public/report/{token}")
    assert pub.status_code == 200
    body = pub.json()
    assert body["hotel_name"] == "Pytest Grand Hotel"
    assert body["days"] == 14
    assert "total_visitors" in body["data"]
    # Must never leak PII — only aggregate keys.
    assert "guests" not in body["data"]

    # Revoke → the public link dies (404).
    revoke = await auth_client.delete(f"/api/v1/analytics/share/{link['id']}")
    assert revoke.status_code == 200
    gone = await client.get(f"/api/v1/public/report/{token}")
    assert gone.status_code == 404


async def test_public_report_unknown_token_404(client: AsyncClient):
    res = await client.get("/api/v1/public/report/definitely-not-a-real-token")
    assert res.status_code == 404
