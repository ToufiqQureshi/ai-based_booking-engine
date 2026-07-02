import pytest

# These tests exercise the Gemini provider, whose underlying `google-genai`
# package is an optional dependency the app imports lazily at call time.
# When it isn't installed (e.g. in CI), skip the whole module rather than
# failing collection for the entire test suite.
pytest.importorskip("google.genai", reason="google-genai not installed")

from app.ai_engine.guest_agent import create_guest_agent_graph
from agno.models.google import Gemini
from agno.models.deepseek import DeepSeek
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db.database import engine
from app.brand_console.hotel import Hotel

@pytest.mark.asyncio
async def test_guest_agent_gemini_model_instantiation(seeded_hotel: Hotel):
    async with AsyncSession(engine) as session:
        agent = await create_guest_agent_graph(
            session=session,
            hotel_id=seeded_hotel.id,
            ai_provider="gemini",
            ai_api_key="AIza_test_key",
            ai_model="gemini-1.5-flash",
            ai_base_url=None,
            hotel_name="Test Hotel",
        )
        assert agent is not None
        assert isinstance(agent.model, Gemini)
        assert agent.model.id == "gemini-1.5-flash"
        assert agent.model.api_key == "AIza_test_key"
        assert agent.model.max_output_tokens == 1024

@pytest.mark.asyncio
async def test_guest_agent_deepseek_model_instantiation(seeded_hotel: Hotel):
    async with AsyncSession(engine) as session:
        agent = await create_guest_agent_graph(
            session=session,
            hotel_id=seeded_hotel.id,
            ai_provider="deepseek",
            ai_api_key="sk-test-key",
            ai_model="deepseek-chat",
            ai_base_url=None,
            hotel_name="Test Hotel",
        )
        assert agent is not None
        assert isinstance(agent.model, DeepSeek)
        assert agent.model.id == "deepseek-chat"
        assert agent.model.api_key == "sk-test-key"
        assert agent.model.max_tokens == 1024


class TestDefaultAiModelIsSupported:
    """Regression: hotels defaulted to llama-3.1-70b-versatile, which Groq has
    decommissioned — every new hotel's AI agent would 400 on its first call."""

    def test_hotel_default_ai_model_not_decommissioned(self):
        from app.brand_console.hotel import Hotel

        hotel = Hotel(name="Fresh Hotel", slug="fresh-hotel")
        assert hotel.ai_model == "llama-3.3-70b-versatile"

    def test_no_decommissioned_groq_ids_in_backend(self):
        import pathlib

        app_dir = pathlib.Path(__file__).resolve().parents[3] / "app"
        offenders = [
            str(p) for p in app_dir.rglob("*.py")
            if "llama-3.1-70b-versatile" in p.read_text(encoding="utf-8", errors="ignore")
        ]
        assert offenders == [], f"Decommissioned Groq model id still referenced: {offenders}"
