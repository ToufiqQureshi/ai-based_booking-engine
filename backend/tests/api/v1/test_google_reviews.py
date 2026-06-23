"""
Regression tests: AI-key resolution for Google review replies and the
"Test AI" connection check must go through Vault (get_hotel_ai_key),
not read IntegrationSettings.ai_api_key / Hotel.ai_api_key directly.

Bug: when a hotel's AI key is stored only in Supabase Vault (the standard
path — set via the superadmin hotel panel, which writes
hotel.ai_api_key_vault_id and leaves the plaintext ai_api_key column
None), both endpoints used a raw getattr(obj, "ai_api_key", None) lookup
that always evaluated to None, so they silently fell through to "No AI
provider configured." / "API Key is missing."
"""
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.db.database import engine
from app.brand_console.hotel import Hotel
from app.integration.integration import IntegrationSettings


async def _connect_google_business(hotel_id: str) -> None:
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
        )
        settings = result.scalar_one_or_none()
        if not settings:
            settings = IntegrationSettings(hotel_id=hotel_id)
        settings.google_business_access_token = "fake-access-token"
        settings.google_business_account_id = "accounts/123"
        settings.google_business_location_id = "locations/456"
        session.add(settings)
        await session.commit()


class _FakeAgentResult:
    def __init__(self, content: str):
        self.content = content


class _FakeAgent:
    def __init__(self, content: str):
        self._content = content

    async def arun(self, messages):
        return _FakeAgentResult(self._content)


def _patch_vault_key_and_agent(monkeypatch, expected_key: str, reply_content: str):
    async def fake_get_hotel_ai_key(session, integration_settings, hotel):
        return expected_key

    monkeypatch.setattr("app.core.auth.vault.get_hotel_ai_key", fake_get_hotel_ai_key)

    async def fake_create_guest_agent_graph(
        session, hotel_id, ai_provider, ai_api_key, ai_model, ai_base_url, hotel_name, **kwargs
    ):
        assert ai_api_key == expected_key, "AI reply must use the vault-resolved key, not the raw column"
        return _FakeAgent(reply_content)

    monkeypatch.setattr(
        "app.ai_engine.guest_agent.create_guest_agent_graph", fake_create_guest_agent_graph
    )


async def test_google_ai_reply_uses_vault_resolved_key(
    auth_client: AsyncClient, seeded_hotel: Hotel, monkeypatch
):
    await _connect_google_business(seeded_hotel.id)
    _patch_vault_key_and_agent(monkeypatch, "vault-resolved-key", "Thank you for staying with us!")

    res = await auth_client.post(
        "/api/v1/integration/google/reviews/review123/ai-reply",
        json={"reviewer_name": "Alice", "review_text": "Great stay!", "star_rating": 5},
    )
    assert res.status_code == 200
    assert res.json()["reply"] == "Thank you for staying with us!"


async def test_test_ai_connection_uses_vault_resolved_key(
    auth_client: AsyncClient, seeded_hotel: Hotel, monkeypatch
):
    _patch_vault_key_and_agent(monkeypatch, "vault-resolved-key", "Ready")

    res = await auth_client.post("/api/v1/integration/test-ai")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"


async def test_google_reviews_requires_location_selected(auth_client: AsyncClient, seeded_hotel: Hotel):
    """Connected but no account/location chosen yet -> explicit LOCATION_NOT_SELECTED, not a crash."""
    async with AsyncSession(engine) as session:
        result = await session.execute(
            select(IntegrationSettings).where(IntegrationSettings.hotel_id == seeded_hotel.id)
        )
        settings = result.scalar_one_or_none()
        if not settings:
            settings = IntegrationSettings(hotel_id=seeded_hotel.id)
        settings.google_business_access_token = "fake-access-token"
        settings.google_business_account_id = None
        settings.google_business_location_id = None
        session.add(settings)
        await session.commit()

    res = await auth_client.get("/api/v1/integration/google/reviews")
    assert res.status_code == 400
    assert res.json()["detail"] == "LOCATION_NOT_SELECTED"
