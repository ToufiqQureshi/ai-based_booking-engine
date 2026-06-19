"""
Security guards for super-admin user management.

Covers the protections added so the Core-Team view cannot be abused:
- read endpoint is role-filterable server-side (no cross-tenant PII leak),
- an admin cannot demote / suspend / delete themselves (lock-out prevention),
- a non-master super-admin cannot suspend a master admin (founder protection).
"""
import uuid
import contextlib

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db.database import engine
from app.guests.user import User, UserRole
from main import app


@contextlib.asynccontextmanager
async def _client_as(user: User):
    """Yield an HTTP client authenticated as the given user."""
    from app.core.auth.deps import get_current_active_user
    app.dependency_overrides[get_current_active_user] = lambda: user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


async def _make_user(role: UserRole, email: str, hotel_id=None) -> User:
    user = User(
        id=str(uuid.uuid4()),
        supabase_id=str(uuid.uuid4()),
        email=email,
        name="Guard Test User",
        role=role,
        hotel_id=hotel_id,
        hashed_password="PYTEST_NO_AUTH",
        is_active=True,
    )
    async with AsyncSession(engine) as session:
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


@pytest.mark.anyio
async def test_list_users_role_filter_scopes_results(seeded_hotel):
    """`?role=SUPER_ADMIN` must return only super admins — never other tenants."""
    admin = await _make_user(UserRole.SUPER_ADMIN, f"guard-admin-{uuid.uuid4().hex[:6]}@staybooker.ai")
    await _make_user(UserRole.STAFF, f"guard-staff-{uuid.uuid4().hex[:6]}@hotel.com", seeded_hotel.id)

    async with _client_as(admin) as ac:
        res = await ac.get("/api/v1/superadmin/users?role=SUPER_ADMIN")
        assert res.status_code == 200
        roles = {u["role"] for u in res.json()}
        assert roles == {"SUPER_ADMIN"}


@pytest.mark.anyio
async def test_list_users_rejects_invalid_role_filter(seeded_hotel):
    admin = await _make_user(UserRole.SUPER_ADMIN, f"guard-admin-{uuid.uuid4().hex[:6]}@staybooker.ai")
    async with _client_as(admin) as ac:
        res = await ac.get("/api/v1/superadmin/users?role=GOD_MODE")
        assert res.status_code == 400


@pytest.mark.anyio
async def test_admin_cannot_demote_self(seeded_hotel):
    admin = await _make_user(UserRole.SUPER_ADMIN, f"guard-admin-{uuid.uuid4().hex[:6]}@staybooker.ai")
    async with _client_as(admin) as ac:
        res = await ac.patch(f"/api/v1/superadmin/users/{admin.id}/role", json={"role": "MANAGER"})
        assert res.status_code == 400


@pytest.mark.anyio
async def test_admin_cannot_suspend_self(seeded_hotel):
    admin = await _make_user(UserRole.SUPER_ADMIN, f"guard-admin-{uuid.uuid4().hex[:6]}@staybooker.ai")
    async with _client_as(admin) as ac:
        res = await ac.patch(f"/api/v1/superadmin/users/{admin.id}/status", json={"is_active": False})
        assert res.status_code == 400


@pytest.mark.anyio
async def test_admin_cannot_delete_self(seeded_hotel):
    admin = await _make_user(UserRole.SUPER_ADMIN, f"guard-admin-{uuid.uuid4().hex[:6]}@staybooker.ai")
    async with _client_as(admin) as ac:
        res = await ac.delete(f"/api/v1/superadmin/users/{admin.id}")
        assert res.status_code == 400


@pytest.mark.anyio
async def test_non_master_cannot_suspend_master_admin(seeded_hotel, monkeypatch):
    """A regular super-admin must not be able to suspend a configured master admin."""
    master_email = f"founder-{uuid.uuid4().hex[:6]}@staybooker.ai"
    master = await _make_user(UserRole.SUPER_ADMIN, master_email)
    regular = await _make_user(UserRole.SUPER_ADMIN, f"emp-{uuid.uuid4().hex[:6]}@staybooker.ai")

    # Make `master_email` a master admin for the duration of this test.
    import app.superadmin.dashboard.users as users_mod

    class _FakeSettings:
        master_admin_email_set = {master_email.lower()}

    monkeypatch.setattr(users_mod, "get_settings", lambda: _FakeSettings())

    async with _client_as(regular) as ac:
        res = await ac.patch(f"/api/v1/superadmin/users/{master.id}/status", json={"is_active": False})
        assert res.status_code == 403
