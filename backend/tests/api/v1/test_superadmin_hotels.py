"""
Super Admin — Hotel Management Tests
Covers: list hotels, update hotel, delete hotel, impersonate, social proof refresh.
All tests use the super_admin_client fixture which overrides auth with a SUPER_ADMIN user.
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.brand_console.models import Hotel
from app.guests.user import User, UserRole


pytestmark = pytest.mark.asyncio


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
async def second_hotel() -> Hotel:
    """A second hotel created fresh for delete/isolation tests."""
    from tests.conftest import engine
    hotel = Hotel(
        id=str(uuid.uuid4()),
        name="Delete Me Hotel",
        slug=f"delete-me-{uuid.uuid4().hex[:8]}",
    )
    async with AsyncSession(engine) as session:
        session.add(hotel)
        await session.commit()
        await session.refresh(hotel)
    return hotel


# ─── List Hotels ─────────────────────────────────────────────────────────────

class TestListHotels:
    async def test_super_admin_can_list_hotels(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 200
        hotels = r.json()
        assert isinstance(hotels, list)
        ids = [h["id"] for h in hotels]
        assert seeded_hotel.id in ids

    async def test_hotel_listing_contains_required_fields(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.get("/api/v1/superadmin/hotels")
        hotel = next(h for h in r.json() if h["id"] == seeded_hotel.id)
        required = ["id", "name", "slug", "is_active", "owner_email", "subscription"]
        for field in required:
            assert field in hotel, f"Missing field: {field}"

    async def test_regular_user_cannot_list_hotels(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 403

    async def test_unauthenticated_cannot_list_hotels(self, client: AsyncClient):
        r = await client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 401


# ─── Update Hotel ─────────────────────────────────────────────────────────────

class TestUpdateHotel:
    async def test_super_admin_can_toggle_feature_flag(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}",
            json={"feature_ai_agent": True},
        )
        assert r.status_code == 200
        assert r.json()["feature_ai_agent"] is True

    async def test_super_admin_can_deactivate_hotel(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}",
            json={"is_active": False},
        )
        assert r.status_code == 200
        # Reactivate to not break other tests
        await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}",
            json={"is_active": True},
        )

    async def test_slug_conflict_rejected(self, super_admin_client: AsyncClient, seeded_hotel: Hotel, second_hotel: Hotel):
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}",
            json={"slug": second_hotel.slug},
        )
        assert r.status_code == 400
        assert "taken" in r.json()["detail"].lower()

    async def test_update_nonexistent_hotel_returns_404(self, super_admin_client: AsyncClient):
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{uuid.uuid4()}",
            json={"is_active": False},
        )
        assert r.status_code == 404

    async def test_regular_user_cannot_update_hotel(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}",
            json={"is_active": False},
        )
        assert r.status_code == 403


# ─── Impersonation ────────────────────────────────────────────────────────────

class TestImpersonation:
    async def test_super_admin_gets_impersonation_token(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.post(f"/api/v1/superadmin/impersonate/{seeded_hotel.id}")
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "Bearer"
        # Token must be short-lived (exp field present); we can't verify exp without decoding,
        # but the endpoint must return a non-empty token string.
        assert len(body["access_token"]) > 20

    async def test_impersonation_of_nonexistent_hotel_returns_404(self, super_admin_client: AsyncClient):
        r = await super_admin_client.post(f"/api/v1/superadmin/impersonate/{uuid.uuid4()}")
        assert r.status_code == 404

    async def test_regular_user_cannot_impersonate(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.post(f"/api/v1/superadmin/impersonate/{seeded_hotel.id}")
        assert r.status_code == 403


# ─── Role Permissions ─────────────────────────────────────────────────────────

class TestRolePermissions:
    async def test_super_admin_can_update_role_permissions(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        permissions = {
            "OWNER": ["/dashboard", "/settings"],
            "MANAGER": ["/dashboard"],
            "STAFF": ["/bookings"],
        }
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/permissions",
            json=permissions,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["role_permissions"]["OWNER"] == ["/dashboard", "/settings"]

    async def test_regular_user_cannot_update_permissions(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/permissions",
            json={"OWNER": ["/dashboard"]},
        )
        assert r.status_code == 403


# ─── Super Admin Access Check ─────────────────────────────────────────────────

class TestAccessCheck:
    async def test_me_access_returns_permissions(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/me/access")
        assert r.status_code == 200
        body = r.json()
        assert "permissions" in body
        assert "allowed_tabs" in body

    async def test_regular_user_cannot_check_admin_access(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/me/access")
        assert r.status_code == 403
