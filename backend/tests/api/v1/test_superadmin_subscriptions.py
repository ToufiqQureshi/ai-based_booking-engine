"""
Super Admin — Subscriptions, Quotas, Plan Features, Broadcasts Tests.
All state mutations are isolated: tests create their own data and clean up.
"""
import uuid
import pytest
from httpx import AsyncClient

from app.models.hotel import Hotel

pytestmark = pytest.mark.asyncio


# ─── Subscriptions ────────────────────────────────────────────────────────────

class TestSubscriptions:
    async def test_super_admin_can_create_subscription(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.post(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/subscription",
            json={
                "plan_name": "Professional",
                "status": "active",
                "end_date": "2027-12-31T00:00:00",
            },
        )
        assert r.status_code == 200
        assert "updated" in r.json().get("message", "").lower()

    async def test_super_admin_can_update_subscription_plan(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        # Create first
        await super_admin_client.post(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/subscription",
            json={"plan_name": "Basic", "status": "active"},
        )
        # Now update
        r = await super_admin_client.post(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/subscription",
            json={"plan_name": "Enterprise", "status": "active"},
        )
        assert r.status_code == 200

    async def test_nonexistent_hotel_subscription_returns_404(self, super_admin_client: AsyncClient):
        r = await super_admin_client.post(
            f"/api/v1/superadmin/hotels/{uuid.uuid4()}/subscription",
            json={"plan_name": "Basic", "status": "active"},
        )
        assert r.status_code == 404

    async def test_regular_user_cannot_update_subscription(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.post(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/subscription",
            json={"plan_name": "Enterprise", "status": "active"},
        )
        assert r.status_code == 403


# ─── Quotas ───────────────────────────────────────────────────────────────────

class TestQuotas:
    async def test_super_admin_can_update_quotas(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/quotas",
            json={
                "whatsapp_credits": 5000,
                "sms_credits": 2000,
                "ai_hotelier_daily_limit": 75000,
                "ai_guest_chat_daily_limit": 150000,
                "ai_whatsapp_daily_limit": 150000,
            },
        )
        assert r.status_code == 200

    async def test_partial_quota_update_works(self, super_admin_client: AsyncClient, seeded_hotel: Hotel):
        r = await super_admin_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/quotas",
            json={"ai_hotelier_daily_limit": 25000},
        )
        assert r.status_code == 200

    async def test_regular_user_cannot_update_quotas(self, auth_client: AsyncClient, seeded_hotel: Hotel):
        r = await auth_client.patch(
            f"/api/v1/superadmin/hotels/{seeded_hotel.id}/quotas",
            json={"ai_hotelier_daily_limit": 999},
        )
        assert r.status_code == 403


# ─── Plan Features ────────────────────────────────────────────────────────────

class TestPlanFeatures:
    async def test_super_admin_can_read_plan_features(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/plan-features")
        assert r.status_code == 200
        body = r.json()
        # Must have at least one plan tier defined
        assert isinstance(body, dict)
        assert len(body) > 0

    async def test_regular_user_cannot_read_plan_features(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/plan-features")
        assert r.status_code == 403

    async def test_unauthenticated_cannot_read_plan_features(self, client: AsyncClient):
        r = await client.get("/api/v1/superadmin/plan-features")
        assert r.status_code == 401


# ─── Audit Logs ───────────────────────────────────────────────────────────────

class TestAuditLogs:
    async def test_super_admin_can_read_audit_logs(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/audit-logs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_audit_log_limit_respected(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/audit-logs?limit=5")
        assert r.status_code == 200
        assert len(r.json()) <= 5

    async def test_regular_user_cannot_read_audit_logs(self, auth_client: AsyncClient):
        r = await auth_client.get("/api/v1/superadmin/audit-logs")
        assert r.status_code == 403


# ─── Broadcasts ───────────────────────────────────────────────────────────────

class TestBroadcasts:
    async def test_super_admin_can_create_broadcast(self, super_admin_client: AsyncClient):
        r = await super_admin_client.post(
            "/api/v1/superadmin/broadcasts",
            json={
                "title": f"Test Broadcast {uuid.uuid4().hex[:6]}",
                "message": "This is a test system notification.",
                "type": "info",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["title"].startswith("Test Broadcast")
        return body["id"]

    async def test_super_admin_can_list_broadcasts(self, super_admin_client: AsyncClient):
        r = await super_admin_client.get("/api/v1/superadmin/broadcasts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_super_admin_can_update_broadcast(self, super_admin_client: AsyncClient):
        # Create one first
        create_r = await super_admin_client.post(
            "/api/v1/superadmin/broadcasts",
            json={"title": "Update Me", "message": "Original message", "type": "warning"},
        )
        broadcast_id = create_r.json()["id"]

        r = await super_admin_client.patch(
            f"/api/v1/superadmin/broadcasts/{broadcast_id}",
            json={"message": "Updated message", "is_active": True},
        )
        assert r.status_code == 200
        assert r.json()["message"] == "Updated message"

    async def test_super_admin_can_delete_broadcast(self, super_admin_client: AsyncClient):
        create_r = await super_admin_client.post(
            "/api/v1/superadmin/broadcasts",
            json={"title": "Delete Me", "message": "Will be deleted", "type": "info"},
        )
        broadcast_id = create_r.json()["id"]

        r = await super_admin_client.delete(f"/api/v1/superadmin/broadcasts/{broadcast_id}")
        assert r.status_code == 200

        # Verify it's gone
        list_r = await super_admin_client.get("/api/v1/superadmin/broadcasts")
        ids = [b["id"] for b in list_r.json()]
        assert broadcast_id not in ids

    async def test_delete_nonexistent_broadcast_returns_404(self, super_admin_client: AsyncClient):
        r = await super_admin_client.delete(f"/api/v1/superadmin/broadcasts/{uuid.uuid4()}")
        assert r.status_code == 404

    async def test_scheduled_broadcast_is_not_published_immediately(self, super_admin_client: AsyncClient):
        r = await super_admin_client.post(
            "/api/v1/superadmin/broadcasts",
            json={
                "title": "Future Broadcast",
                "message": "This is scheduled for next year",
                "type": "info",
                "scheduled_at": "2030-01-01T00:00:00",
            },
        )
        assert r.status_code == 200
        assert r.json()["is_published"] is False

    async def test_regular_user_cannot_create_broadcast(self, auth_client: AsyncClient):
        r = await auth_client.post(
            "/api/v1/superadmin/broadcasts",
            json={"title": "Hack", "message": "Not allowed", "type": "info"},
        )
        assert r.status_code == 403
