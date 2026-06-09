"""
Integration Settings, API Keys, Widget Code, and Test Endpoints
"""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

import httpx
from fastapi import Depends, APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession, require_hotel_role
from app.core.cache import invalidate_cache
from app.core.config import get_settings
from app.core.redis_client import redis_client
from app.models.hotel import Hotel
from app.models.integration import (
    APIKey, APIKeyCreate, APIKeyRead, APIKeyWithSecret,
    IntegrationSettings, IntegrationSettingsRead, IntegrationSettingsUpdate,
    WidgetCodeResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Returns (full_key, prefix, hash)."""
    random_part = secrets.token_urlsafe(32)
    full_key = f"sk_live_{random_part}"
    prefix = full_key[:12] + "..."
    return full_key, prefix, hash_api_key(full_key)


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=IntegrationSettingsRead)
async def get_integration_settings(current_user: CurrentUser, session: DbSession):
    from app.models.user import UserRole

    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        settings = IntegrationSettings(hotel_id=current_user.hotel_id)
        session.add(settings)
        await session.commit()
        await session.refresh(settings)

    response = IntegrationSettingsRead.model_validate(settings, from_attributes=True)

    if current_user.role != UserRole.SUPER_ADMIN:
        response.ai_api_key = None
        response.google_business_access_token = None
        response.google_business_refresh_token = None

    return response


_AI_ONLY_FIELDS = frozenset({"ai_provider", "ai_api_key", "ai_model", "ai_base_url", "ai_max_tokens"})


@router.put("/settings", response_model=IntegrationSettingsRead, dependencies=[Depends(require_hotel_role("OWNER"))])
async def update_integration_settings(
    settings_update: IntegrationSettingsUpdate,
    current_user: CurrentUser,
    session: DbSession,
):
    from app.models.user import UserRole

    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    # AI credentials are super-admin-only — strip them from hotelier requests
    update_data = settings_update.model_dump(exclude_unset=True)
    if current_user.role != UserRole.SUPER_ADMIN:
        for field in _AI_ONLY_FIELDS:
            update_data.pop(field, None)

    if not settings:
        settings = IntegrationSettings(hotel_id=current_user.hotel_id, **update_data)
        session.add(settings)
    else:
        for key, value in update_data.items():
            setattr(settings, key, value)
        settings.updated_at = datetime.utcnow()

    hotel_query = select(Hotel).where(Hotel.id == current_user.hotel_id)
    hotel_res = await session.execute(hotel_query)
    hotel = hotel_res.scalar_one_or_none()
    if hotel:
        if "widget_primary_color" in update_data and update_data["widget_primary_color"]:
            hotel.primary_color = update_data["widget_primary_color"]
        session.add(hotel)

    await session.commit()
    await session.refresh(settings)

    invalidate_cache(f"integration:{current_user.hotel_id}:*")
    try:
        redis_client.delete_key(f"public:widget-config:{current_user.hotel_id}")
    except Exception as e:
        logger.error("Failed to clear widget-config cache: %s", e)

    return settings


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

@router.get("/api-keys", response_model=List[APIKeyRead])
async def list_api_keys(current_user: CurrentUser, session: DbSession):
    query = select(APIKey).where(APIKey.hotel_id == current_user.hotel_id).order_by(APIKey.created_at.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.post("/api-keys", response_model=APIKeyWithSecret, dependencies=[Depends(require_hotel_role("OWNER"))])
async def create_api_key(key_data: APIKeyCreate, current_user: CurrentUser, session: DbSession):
    """The secret key is only returned once at creation time."""
    full_key, prefix, key_hash = generate_api_key()

    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=key_data.expires_in_days)

    api_key = APIKey(
        hotel_id=current_user.hotel_id,
        name=key_data.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=key_data.scopes,
        expires_at=expires_at,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return APIKeyWithSecret(**api_key.model_dump(), secret_key=full_key)


@router.delete("/api-keys/{key_id}", dependencies=[Depends(require_hotel_role("OWNER"))])
async def delete_api_key(key_id: str, current_user: CurrentUser, session: DbSession):
    query = select(APIKey).where(APIKey.id == key_id, APIKey.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    await session.delete(api_key)
    await session.commit()
    return {"message": "API key deleted successfully"}


@router.put("/api-keys/{key_id}/toggle", dependencies=[Depends(require_hotel_role("OWNER"))])
async def toggle_api_key(key_id: str, current_user: CurrentUser, session: DbSession):
    query = select(APIKey).where(APIKey.id == key_id, APIKey.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")

    api_key.is_active = not api_key.is_active
    await session.commit()
    await session.refresh(api_key)
    return api_key


# ---------------------------------------------------------------------------
# Widget Code
# ---------------------------------------------------------------------------

@router.get("/widget-code", response_model=WidgetCodeResponse)
async def get_widget_code(current_user: CurrentUser, session: DbSession):
    hotel = await session.get(Hotel, current_user.hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    settings_query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    settings_result = await session.execute(settings_query)
    int_settings = settings_result.scalar_one_or_none() or IntegrationSettings(hotel_id=current_user.hotel_id)

    config = get_settings()
    api_url = config.API_URL
    frontend_url = config.FRONTEND_URL
    slug = hotel.slug
    theme = int_settings.widget_theme
    color = int_settings.widget_primary_color
    layout = getattr(int_settings, "widget_layout", "modern")

    html_code = f'''<!-- Staybooker Booking Widget -->
<div id="hotelier-booking-widget"
     data-hotel-slug="{slug}"
     data-theme="{theme}"
     data-color="{color}"
     data-widget-layout="{layout}">
</div>'''

    javascript_code = f'''<script>
  (function() {{
    var script = document.createElement('script');
    script.src = '{frontend_url}/widget-v3.js';
    script.async = true;
    script.onload = function() {{
      HotelierWidget.init({{
        hotelSlug: '{slug}',
        primaryColor: '{color}',
        theme: '{theme}',
        widgetLayout: '{layout}',
        apiUrl: '{api_url}',
        frontendUrl: '{frontend_url}'
      }});
    }};
    document.head.appendChild(script);
  }})();
</script>'''

    css_code = '''<style>
  #hotelier-booking-widget {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
</style>'''

    instructions = f'''# Integration Instructions

## Step 1: Add the HTML
{html_code}

## Step 2: Add the JavaScript
{javascript_code}

## Direct Booking Link:
{frontend_url}/book/{slug}/rooms
'''

    return WidgetCodeResponse(
        html_code=html_code,
        javascript_code=javascript_code,
        css_code=css_code,
        instructions=instructions,
    )


# ---------------------------------------------------------------------------
# Connection Tests
# ---------------------------------------------------------------------------

@router.post("/test-ai", dependencies=[Depends(require_hotel_role("OWNER"))])
async def test_ai_connection(current_user: CurrentUser, session: DbSession):
    """Test AI credentials by sending a simple prompt."""
    from app.core.guest_agent import create_guest_agent_graph

    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    res = await session.execute(query)
    settings = res.scalar_one_or_none()

    hotel = await session.get(Hotel, current_user.hotel_id)

    effective_provider = (getattr(settings, "ai_provider", None) or getattr(hotel, "ai_provider", None))
    effective_api_key = (getattr(settings, "ai_api_key", None) or getattr(hotel, "ai_api_key", None))
    effective_model = (getattr(settings, "ai_model", None) or getattr(hotel, "ai_model", None))
    effective_base_url = (getattr(settings, "ai_base_url", None) or getattr(hotel, "ai_base_url", None))

    if not effective_api_key:
        return {"status": "error", "message": "API Key is missing."}

    try:
        agent = await create_guest_agent_graph(
            session, current_user.hotel_id,
            effective_provider, effective_api_key,
            effective_model, effective_base_url,
            "Test Hotel",
        )
        if not agent:
            return {"status": "error", "message": "Agent failed to initialize. Check your Model ID."}

        from agno.agent import Message
        result = await agent.arun([Message(role="user", content="Respond with 'Ready' only.")])
        return {"status": "success", "message": f"Connection Successful! AI says: {result.content or ''}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/test-whatsapp", dependencies=[Depends(require_hotel_role("OWNER"))])
async def test_whatsapp_connection(current_user: CurrentUser, session: DbSession):
    """Test WhatsApp credentials by fetching the phone number profile."""
    query = select(Hotel).where(Hotel.id == current_user.hotel_id)
    res = await session.execute(query)
    hotel = res.scalar_one_or_none()

    if not hotel or not hotel.settings:
        return {"status": "error", "message": "Hotel settings not found."}

    from app.core.vault import resolve_settings_secrets
    resolved = await resolve_settings_secrets(session, hotel.settings)
    wa_token = resolved.get("whatsapp_api_key")
    wa_phone_id = resolved.get("whatsapp_phone_number_id")

    if not wa_token or not wa_phone_id:
        return {"status": "error", "message": "WhatsApp API Key or Phone ID is missing. Please save settings first."}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://graph.facebook.com/v21.0/{wa_phone_id}",
                headers={"Authorization": f"Bearer {wa_token}"},
            )
            if resp.status_code == 200:
                return {"status": "success", "message": "Connection Successful! Validated Phone Number."}
            try:
                err = resp.json().get("error", {}).get("message", resp.text)
            except (ValueError, AttributeError, TypeError):
                err = resp.text
            return {"status": "error", "message": f"Meta Error: {err}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
