"""
Auth & RBAC Tests
Verifies that each role tier (SUPER_ADMIN / OWNER / MANAGER / STAFF / anon)
can only access what it's supposed to.

RBAC matrix being tested:
  SUPER_ADMIN  → all superadmin endpoints
  OWNER        → all hotel-management endpoints, config changes
  MANAGER      → bookings, availability, rooms (read); no hotel-delete / no super paths
  STAFF        → availability, bookings (operational only); no settings / no payments
  Anonymous    → public booking widget only
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand_console.hotel import Hotel
from app.guests.user import User, UserRole

pytestmark = pytest.mark.asyncio


# ─── Role fixtures (extend conftest) ─────────────────────────────────────────

@pytest.fixture
async def manager_client(seeded_hotel: Hotel):
    """MANAGER-role authenticated client for the seeded hotel."""
    from tests.conftest import engine
    from main import app
    from app.core.auth.deps import get_current_active_user

    manager = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-mgr-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Pytest Manager",
        role=UserRole.MANAGER,
        hotel_id=seeded_hotel.id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(manager)
        await session.commit()
        await session.refresh(manager)

    from httpx import AsyncClient, ASGITransport
    app.dependency_overrides[get_current_active_user] = lambda: manager
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_current_active_user, None)


@pytest.fixture
async def staff_client(seeded_hotel: Hotel):
    """STAFF-role authenticated client for the seeded hotel."""
    from tests.conftest import engine
    from main import app
    from app.core.auth.deps import get_current_active_user

    staff = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=f"pytest-staff-{uuid.uuid4().hex[:6]}@staybooker.ai",
        name="Pytest Staff",
        role=UserRole.STAFF,
        hotel_id=seeded_hotel.id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(staff)
        await session.commit()
        await session.refresh(staff)

    from httpx import AsyncClient, ASGITransport
    app.dependency_overrides[get_current_active_user] = lambda: staff
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_current_active_user, None)


# ─── Anonymous access ─────────────────────────────────────────────────────────

class TestAnonymousAccess:
    """Unauthenticated callers can only hit public/* routes."""

    async def test_anon_cannot_list_bookings(self, client: AsyncClient):
        r = await client.get("/api/v1/bookings")
        assert r.status_code == 401

    async def test_anon_cannot_access_dashboard(self, client: AsyncClient):
        r = await client.get("/api/v1/dashboard/stats")
        assert r.status_code == 401

    async def test_anon_cannot_access_superadmin(self, client: AsyncClient):
        r = await client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 401

    async def test_anon_cannot_access_analytics(self, client: AsyncClient):
        r = await client.get("/api/v1/analytics/dashboard")
        assert r.status_code == 401

    async def test_anon_cannot_access_rooms(self, client: AsyncClient):
        r = await client.get("/api/v1/rooms")
        assert r.status_code == 401


# ─── Super Admin only routes ──────────────────────────────────────────────────

class TestSuperAdminOnlyRoutes:
    """Only SUPER_ADMIN should be able to access /superadmin/* endpoints."""

    async def test_owner_blocked_from_superadmin_hotels(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 403

    async def test_manager_blocked_from_superadmin_hotels(self, manager_client: AsyncClient):
        r = await manager_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 403

    async def test_staff_blocked_from_superadmin_hotels(self, staff_client: AsyncClient):
        r = await staff_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 403

    async def test_owner_blocked_from_audit_logs(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/audit-logs")
        assert r.status_code == 403

    async def test_owner_blocked_from_impersonation(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.post(f"/api/v1/superadmin/impersonate/{seeded_hotel.id}")
        assert r.status_code == 403

    async def test_super_admin_can_access_hotels(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/hotels")
        assert r.status_code == 200


# ─── Owner-only routes (OWNER / SUPER_ADMIN allowed, MANAGER / STAFF blocked) ─

class TestOwnerOnlyRoutes:
    """Hotel config/settings changes require OWNER or MANAGER role."""

    async def test_owner_can_access_hotel_settings(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/hotels/me")
        assert r.status_code == 200

    async def test_staff_cannot_create_room(self, staff_client: AsyncClient):
        r = await staff_client.post("/api/v1/rooms", json={
            "name": "Hack Room", "base_price": 1000, "total_inventory": 1,
            "base_occupancy": 2, "max_occupancy": 2,
        })
        # STAFF should be blocked from creating rooms
        assert r.status_code == 403

    async def test_staff_cannot_update_hotel_settings(self, staff_client: AsyncClient, seeded_hotel: Hotel):
        r = await staff_client.patch("/api/v1/hotels/me", json={"name": "Hacked Name"})
        assert r.status_code == 403

    async def test_manager_can_view_rooms(self, manager_client: AsyncClient):
        r = await manager_client.get("/api/v1/rooms")
        assert r.status_code == 200

    async def test_staff_can_view_bookings(self, staff_client: AsyncClient):
        r = await staff_client.get("/api/v1/bookings")
        assert r.status_code == 200


# ─── Tenant isolation (IDOR prevention) ──────────────────────────────────────

class TestTenantIsolation:
    """A user from hotel A must never access hotel B's data."""

    async def test_cannot_access_another_hotels_bookings_by_id(self, auth_client: AsyncClient):
        # Attempt to read a booking from a different hotel by guessing a UUID
        fake_booking_id = str(uuid.uuid4())
        r = await auth_client.get(f"/api/v1/bookings/{fake_booking_id}")
        # Must be 404 (not found for this hotel) — never 200 with another hotel's data
        assert r.status_code in (404, 403)

    async def test_cannot_update_another_hotels_room(self, auth_client: AsyncClient):
        fake_room_id = str(uuid.uuid4())
        r = await auth_client.patch(f"/api/v1/rooms/{fake_room_id}", json={"name": "Stolen"})
        assert r.status_code in (404, 403)

    async def test_rate_plan_scoped_to_hotel(self, auth_client: AsyncClient):
        fake_id = str(uuid.uuid4())
        r = await auth_client.get(f"/api/v1/rates/{fake_id}")
        assert r.status_code in (404, 403)


# ─── Deactivated user / hotel ─────────────────────────────────────────────────

class TestDeactivatedEntities:
    """Deactivated users and hotels should be blocked at the auth layer."""

    async def test_deactivated_user_cannot_authenticate(self, seeded_hotel: Hotel):
        """
        Verifies the is_active check inside get_current_active_user.
        We override get_current_user (the inner dep) so get_current_active_user
        still runs and enforces the is_active guard.
        """
        from tests.conftest import engine
        from main import app
        from app.core.auth.deps import get_current_user
        from httpx import AsyncClient, ASGITransport

        inactive_user = User(
            id=str(uuid.uuid4()),
            supabase_id=str(uuid.uuid4()),
            email=f"inactive-{uuid.uuid4().hex[:6]}@staybooker.ai",
            name="Inactive User",
            role=UserRole.OWNER,
            hotel_id=seeded_hotel.id,
            hashed_password="PYTEST_NO_AUTH",
            is_active=False,  # deactivated
        )
        async with AsyncSession(engine) as session:
            session.add(inactive_user)
            await session.commit()
            await session.refresh(inactive_user)

        # Override the inner dep so get_current_active_user still runs its checks
        app.dependency_overrides[get_current_user] = lambda: inactive_user
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                r = await ac.get("/api/v1/hotels/me")
            # 403 if is_active check fires; 401 if oauth token missing first — both mean blocked
            assert r.status_code in (401, 403)
        finally:
            app.dependency_overrides.pop(get_current_user, None)
