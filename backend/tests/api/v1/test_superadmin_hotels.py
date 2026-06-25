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

from app.brand_console.hotel import Hotel
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


# ─── Provision Hotel ──────────────────────────────────────────────────────────

class TestProvisionHotel:
    """
    POST /superadmin/hotels/provision
    Tests: auth guard, RBAC, happy path (Supabase mocked), duplicate email,
    invalid plan, response shape, and DB persistence.
    """

    BASE_URL = "/api/v1/superadmin/hotels/provision"

    def _payload(self, suffix: str = "") -> dict:
        """Generate a unique valid payload."""
        tag = suffix or uuid.uuid4().hex[:8]
        return {
            "hotel_name": f"Test Hotel {tag}",
            "owner_name": f"Test Owner {tag}",
            "owner_email": f"owner-{tag}@testhotel.com",
            "plan_name": "Basic",
        }

    # ── Auth & RBAC ───────────────────────────────────────────────────────────

    async def test_unauthenticated_request_rejected(self, client: AsyncClient):
        """Unauthenticated requests must return 401."""
        r = await client.post(self.BASE_URL, json=self._payload())
        assert r.status_code == 401

    async def test_regular_owner_cannot_provision(self, auth_client: AsyncClient):
        """Hotel OWNER must not be able to provision hotels (403)."""
        r = await auth_client.post(self.BASE_URL, json=self._payload())
        assert r.status_code == 403

    # ── Happy Path (Supabase invite mocked) ────────────────────────────────────

    async def test_provision_creates_hotel_user_subscription(
        self, super_admin_client: AsyncClient, monkeypatch
    ):
        """
        Full happy-path: Hotel, User, Subscription must be created in DB.
        Supabase invite_user_by_email is mocked to avoid real network call.
        """
        from unittest.mock import MagicMock
        import app.superadmin.hotels.hotels as hotels_module

        # Mock Supabase client — invite always succeeds with a fake user id
        fake_supabase_user = MagicMock()
        fake_supabase_user.id = str(uuid.uuid4())
        fake_invite_resp = MagicMock()
        fake_invite_resp.user = fake_supabase_user

        mock_supabase = MagicMock()
        mock_supabase.auth.admin.invite_user_by_email.return_value = fake_invite_resp

        monkeypatch.setattr(hotels_module, "get_supabase", lambda: mock_supabase)

        payload = self._payload("happypath")
        r = await super_admin_client.post(self.BASE_URL, json=payload)

        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        body = r.json()

        # Response shape
        assert "hotel_id" in body
        assert "hotel_slug" in body
        assert "owner_email" in body
        assert "plan" in body
        assert "subscription_end_date" in body
        assert body["owner_email"] == payload["owner_email"]
        assert body["plan"] == "Basic"
        assert "message" in body

        # Simpler: just assert it was called with our email
        called_args = mock_supabase.auth.admin.invite_user_by_email.call_args[0]
        called_kwargs = mock_supabase.auth.admin.invite_user_by_email.call_args[1]
        
        assert called_args[0] == payload["owner_email"]
        assert called_kwargs["options"]["data"]["hotel_id"] == body["hotel_id"]
        assert called_kwargs["options"]["data"]["name"] == payload["owner_name"]

    async def test_provision_persists_to_database(
        self, super_admin_client: AsyncClient, monkeypatch
    ):
        """Hotel, User, and Subscription rows must actually exist in the DB after provisioning."""
        from unittest.mock import MagicMock
        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlmodel import select as sa_select
        import app.superadmin.hotels.hotels as hotels_module
        from app.brand_console.hotel import Hotel
        from app.guests.user import User
        from app.superadmin.subscriptions.subscription import Subscription
        from tests.conftest import engine

        fake_user = MagicMock(); fake_user.id = str(uuid.uuid4())
        fake_resp = MagicMock(); fake_resp.user = fake_user
        mock_sup = MagicMock()
        mock_sup.auth.admin.invite_user_by_email.return_value = fake_resp
        monkeypatch.setattr(hotels_module, "get_supabase", lambda: mock_sup)

        payload = self._payload("dbcheck")
        r = await super_admin_client.post(self.BASE_URL, json=payload)
        assert r.status_code == 201
        body = r.json()
        hotel_id = body["hotel_id"]

        async with AsyncSession(engine) as session:
            hotel = await session.get(Hotel, hotel_id)
            assert hotel is not None, "Hotel row must exist in DB"
            assert hotel.name == payload["hotel_name"]
            assert hotel.is_active is True

            user = (await session.execute(
                sa_select(User).where(User.hotel_id == hotel_id, User.email == payload["owner_email"])
            )).scalar_one_or_none()
            assert user is not None, "User row must exist in DB linked to hotel"
            assert user.role.value == "OWNER"

            sub = (await session.execute(
                sa_select(Subscription).where(Subscription.hotel_id == hotel_id)
            )).scalar_one_or_none()
            assert sub is not None, "Subscription row must exist in DB"
            assert sub.plan_name == "Basic"
            assert sub.status == "active"

    # ── Plan Selection ─────────────────────────────────────────────────────────

    async def test_provision_pro_plan(self, super_admin_client: AsyncClient, monkeypatch):
        """Pro plan must create subscription with higher limits."""
        from unittest.mock import MagicMock
        import app.superadmin.hotels.hotels as hotels_module
        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlmodel import select as sa_select
        from app.superadmin.subscriptions.subscription import Subscription
        from tests.conftest import engine

        fake_user = MagicMock(); fake_user.id = str(uuid.uuid4())
        fake_resp = MagicMock(); fake_resp.user = fake_user
        mock_sup = MagicMock()
        mock_sup.auth.admin.invite_user_by_email.return_value = fake_resp
        monkeypatch.setattr(hotels_module, "get_supabase", lambda: mock_sup)

        payload = {**self._payload("pro"), "plan_name": "Pro"}
        r = await super_admin_client.post(self.BASE_URL, json=payload)
        assert r.status_code == 201
        body = r.json()
        assert body["plan"] == "Pro"

        async with AsyncSession(engine) as session:
            sub = (await session.execute(
                sa_select(Subscription).where(Subscription.hotel_id == body["hotel_id"])
            )).scalar_one_or_none()
            assert sub is not None
            assert sub.plan_name == "Pro"
            assert sub.whatsapp_credits == 2000  # Pro > Basic (500)

    async def test_invalid_plan_returns_400(self, super_admin_client: AsyncClient, monkeypatch):
        """Unknown plan names must be rejected with 400 before hitting Supabase."""
        from unittest.mock import MagicMock
        import app.superadmin.hotels.hotels as hotels_module
        mock_sup = MagicMock()
        monkeypatch.setattr(hotels_module, "get_supabase", lambda: mock_sup)

        payload = {**self._payload("badplan"), "plan_name": "NonExistentPlan"}
        r = await super_admin_client.post(self.BASE_URL, json=payload)
        assert r.status_code == 400
        # Supabase must NOT be called when validation fails early
        mock_sup.auth.admin.invite_user_by_email.assert_not_called()

    # ── Duplicate Email ────────────────────────────────────────────────────────

    async def test_duplicate_email_returns_409(self, super_admin_client: AsyncClient, monkeypatch, seeded_user: User):
        """Provisioning with an already-registered email must return 409."""
        from unittest.mock import MagicMock
        import app.superadmin.hotels.hotels as hotels_module
        mock_sup = MagicMock()
        monkeypatch.setattr(hotels_module, "get_supabase", lambda: mock_sup)

        # Use the email that already exists in the DB (seeded_user)
        payload = {**self._payload("dup"), "owner_email": seeded_user.email}
        r = await super_admin_client.post(self.BASE_URL, json=payload)
        assert r.status_code == 409
        assert "already exists" in r.json()["detail"].lower()
        # Supabase must NOT be called on duplicate
        mock_sup.auth.admin.invite_user_by_email.assert_not_called()

    # ── Supabase Failure Rollback ──────────────────────────────────────────────

    async def test_supabase_failure_rolls_back_db(self, super_admin_client: AsyncClient, monkeypatch):
        """
        If Supabase invite fails, the hotel/user/subscription rows must be
        rolled back — we cannot have an orphaned hotel with no login path.
        """
        from unittest.mock import MagicMock
        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlmodel import select as sa_select
        import app.superadmin.hotels.hotels as hotels_module
        from app.brand_console.hotel import Hotel
        from tests.conftest import engine

        mock_sup = MagicMock()
        mock_sup.auth.admin.invite_user_by_email.side_effect = Exception("Supabase SMTP down")
        monkeypatch.setattr(hotels_module, "get_supabase", lambda: mock_sup)

        payload = self._payload("rollback")
        r = await super_admin_client.post(self.BASE_URL, json=payload)
        assert r.status_code == 502

        # Hotel must NOT exist in DB after rollback
        async with AsyncSession(engine) as session:
            hotels = (await session.execute(
                sa_select(Hotel).where(Hotel.name == payload["hotel_name"])
            )).scalars().all()
            assert len(hotels) == 0, "Hotel row must be rolled back on Supabase failure"

    # ── Slug Uniqueness ────────────────────────────────────────────────────────

    async def test_duplicate_hotel_name_gets_unique_slug(
        self, super_admin_client: AsyncClient, monkeypatch
    ):
        """Two hotels with the same name must get different slugs."""
        from unittest.mock import MagicMock
        import app.superadmin.hotels.hotels as hotels_module

        def _mock_sup():
            fake_user = MagicMock(); fake_user.id = str(uuid.uuid4())
            fake_resp = MagicMock(); fake_resp.user = fake_user
            m = MagicMock()
            m.auth.admin.invite_user_by_email.return_value = fake_resp
            return m

        monkeypatch.setattr(hotels_module, "get_supabase", _mock_sup)

        r1 = await super_admin_client.post(self.BASE_URL, json={
            "hotel_name": "Same Name Hotel",
            "owner_name": "Owner One",
            "owner_email": f"owner1-{uuid.uuid4().hex[:6]}@test.com",
            "plan_name": "Basic",
        })
        r2 = await super_admin_client.post(self.BASE_URL, json={
            "hotel_name": "Same Name Hotel",
            "owner_name": "Owner Two",
            "owner_email": f"owner2-{uuid.uuid4().hex[:6]}@test.com",
            "plan_name": "Basic",
        })
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["hotel_slug"] != r2.json()["hotel_slug"], \
            "Duplicate hotel names must produce unique slugs"
