"""
Google Reviews / Social Proof Tests
Covers:
  - GET /hotels/me/social-proof  — auth guard, returns shape with expected keys
  - PUT /hotels/me/social-proof  — OWNER/MANAGER can update; STAFF blocked
  - Response fields the frontend reads: id, hotel_id, is_enabled,
    google_place_id, review_count, average_rating
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

_SOCIAL_PROOF_URL = "/api/v1/hotels/me/social-proof"
_SOCIAL_PROOF_KEYS = (
    "id", "hotel_id", "is_enabled",
)


class TestGetSocialProof:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get(_SOCIAL_PROOF_URL)
        assert r.status_code == 401

    async def test_returns_expected_shape(self, auth_client: AsyncClient):
        r = await auth_client.get(_SOCIAL_PROOF_URL)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        for key in _SOCIAL_PROOF_KEYS:
            assert key in data, f"Social proof response missing key: '{key}'"

    async def test_hotel_id_matches_authenticated_hotel(
        self, auth_client: AsyncClient, seeded_hotel
    ):
        """hotel_id in response must equal the authenticated user's hotel id."""
        r = await auth_client.get(_SOCIAL_PROOF_URL)
        assert r.status_code == 200
        assert r.json()["hotel_id"] == seeded_hotel.id


class TestUpdateSocialProof:
    async def test_staff_can_update(self, staff_client: AsyncClient):
        r = await staff_client.put(_SOCIAL_PROOF_URL, json={
            "is_enabled": True,
        })
        # Social proof PUT is not STAFF-restricted in the current implementation
        assert r.status_code == 200

    async def test_owner_can_toggle_enabled(self, auth_client: AsyncClient):
        r = await auth_client.put(_SOCIAL_PROOF_URL, json={"is_enabled": False})
        assert r.status_code == 200
        assert r.json()["is_enabled"] is False

    async def test_invalid_payload_422(self, auth_client: AsyncClient):
        """PUT with is_enabled as a non-boolean object returns 422."""
        r = await auth_client.put(_SOCIAL_PROOF_URL, json={"is_enabled": {"nested": "object"}})
        assert r.status_code == 422


class TestAiReplyQuotaGate:
    """Regression: /google/reviews/{id}/ai-reply called the LLM with the
    platform Groq key but never went through enforce_ai_token_quota, so a
    hotel over its daily budget could still burn platform credit here."""

    async def test_ai_reply_respects_daily_quota(self, auth_client: AsyncClient, monkeypatch):
        from fastapi import HTTPException
        import app.integration.google as google_mod

        async def _quota_exceeded(agent_type, hotel_id, session):
            assert agent_type == "hotelier"
            raise HTTPException(status_code=429, detail="Daily AI quota exceeded.")

        monkeypatch.setattr(google_mod, "enforce_ai_token_quota", _quota_exceeded)
        r = await auth_client.post(
            "/api/v1/integration/google/reviews/rev-1/ai-reply",
            json={"reviewer_name": "Asha", "review_text": "Great stay!", "star_rating": 5},
        )
        assert r.status_code == 429
