"""
Integration API Endpoints
Manage API keys, widget code, and integration settings
"""
from typing import List, Optional, Any, Dict, Tuple
from datetime import datetime, timedelta
import hmac
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import RedirectResponse
from sqlmodel import select
import secrets
import hashlib
import json
import httpx

from app.api.deps import CurrentUser, DbSession
from app.models.integration import (
    APIKey, APIKeyCreate, APIKeyRead, APIKeyWithSecret,
    IntegrationSettings, IntegrationSettingsRead, IntegrationSettingsUpdate,
    WidgetCodeResponse
)
from app.models.hotel import Hotel
from app.core.redis_client import redis_client
from app.core.cache import cache_response, invalidate_cache

router = APIRouter(prefix="/integration", tags=["Integration"])


def hash_api_key(key: str) -> str:
    """Hash API key for secure storage"""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate API key with prefix and hash.
    Returns: (full_key, prefix, hash)
    """
    # Generate random key
    random_part = secrets.token_urlsafe(32)
    full_key = f"sk_live_{random_part}"
    
    # Get prefix (first 12 chars for display)
    prefix = full_key[:12] + "..."
    
    # Hash for storage
    key_hash = hash_api_key(full_key)
    
    return full_key, prefix, key_hash


@router.get("/settings", response_model=IntegrationSettingsRead)
@cache_response(expire=3600, key_prefix="integration")
async def get_integration_settings(
    request: Request,
    current_user: CurrentUser,
    session: DbSession
):
    """Get integration settings for current hotel"""
    query = select(IntegrationSettings).where(
        IntegrationSettings.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    settings = result.scalar_one_or_none()
    
    # Create default settings if not exists
    if not settings:
        settings = IntegrationSettings(hotel_id=current_user.hotel_id)
        session.add(settings)
        await session.commit()
        await session.refresh(settings)
    
    return settings


@router.put("/settings", response_model=IntegrationSettingsRead)
async def update_integration_settings(
    settings_update: IntegrationSettingsUpdate,
    current_user: CurrentUser,
    session: DbSession
):
    """Update integration settings"""
    query = select(IntegrationSettings).where(
        IntegrationSettings.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    settings = result.scalar_one_or_none()
    
    if not settings:
        # Create new settings
        settings = IntegrationSettings(
            hotel_id=current_user.hotel_id,
            **settings_update.model_dump(exclude_unset=True)
        )
        session.add(settings)
    else:
        # Update existing
        for key, value in settings_update.model_dump(exclude_unset=True).items():
            setattr(settings, key, value)
        settings.updated_at = datetime.utcnow()
    
    # Sync AI parameters and primary color into Hotel table for synchronous background accesses
    from app.models.hotel import Hotel
    hotel_query = select(Hotel).where(Hotel.id == current_user.hotel_id)
    hotel_res = await session.execute(hotel_query)
    hotel = hotel_res.scalar_one_or_none()
    if hotel:
        updates_dict = settings_update.model_dump(exclude_unset=True)
        if 'ai_provider' in updates_dict:
            hotel.ai_provider = updates_dict['ai_provider']
        if 'ai_api_key' in updates_dict:
            hotel.ai_api_key = updates_dict['ai_api_key']
        if 'ai_model' in updates_dict:
            hotel.ai_model = updates_dict['ai_model']
        if 'ai_base_url' in updates_dict:
            hotel.ai_base_url = updates_dict['ai_base_url']
        if 'widget_primary_color' in updates_dict and updates_dict['widget_primary_color']:
            hotel.primary_color = updates_dict['widget_primary_color']
        session.add(hotel)

    await session.commit()
    await session.refresh(settings)
    
    # Invalidate caches
    invalidate_cache(f"integration:{current_user.hotel_id}:*")
    try:
        cache_key = f"public:widget-config:{current_user.hotel_id}"
        redis_client.delete_key(cache_key)
    except Exception as e:
        import logging
        logging.error(f"Failed to clear widget-config cache: {e}")
        
    return settings


@router.get("/api-keys", response_model=List[APIKeyRead])
async def list_api_keys(
    current_user: CurrentUser,
    session: DbSession
):
    """List all API keys for current hotel"""
    query = select(APIKey).where(
        APIKey.hotel_id == current_user.hotel_id
    ).order_by(APIKey.created_at.desc())
    
    result = await session.execute(query)
    keys = result.scalars().all()
    return keys


@router.post("/api-keys", response_model=APIKeyWithSecret)
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: CurrentUser,
    session: DbSession
):
    """
    Create a new API key.
    ⚠️ The secret key is only shown ONCE during creation!
    """
    # Generate key
    full_key, prefix, key_hash = generate_api_key()
    
    # Calculate expiry
    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=key_data.expires_in_days)
    
    # Create API key record
    api_key = APIKey(
        hotel_id=current_user.hotel_id,
        name=key_data.name,
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=key_data.scopes,
        expires_at=expires_at
    )
    
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    
    # Return with secret (only time it's shown)
    return APIKeyWithSecret(
        **api_key.model_dump(),
        secret_key=full_key
    )


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """Delete (revoke) an API key"""
    query = select(APIKey).where(
        APIKey.id == key_id,
        APIKey.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    await session.delete(api_key)
    await session.commit()
    
    return {"message": "API key deleted successfully"}


@router.put("/api-keys/{key_id}/toggle")
async def toggle_api_key(
    key_id: str,
    current_user: CurrentUser,
    session: DbSession
):
    """Enable or disable an API key"""
    query = select(APIKey).where(
        APIKey.id == key_id,
        APIKey.hotel_id == current_user.hotel_id
    )
    result = await session.execute(query)
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    api_key.is_active = not api_key.is_active
    await session.commit()
    await session.refresh(api_key)
    
    return api_key


@router.get("/widget-code", response_model=WidgetCodeResponse)
async def get_widget_code(
    current_user: CurrentUser,
    session: DbSession
):
    """
    Get embeddable widget code for hotel website.
    Returns HTML, JS, and CSS code snippets.
    """
    # Get hotel details
    hotel = await session.get(Hotel, current_user.hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")
    
    # Get integration settings
    settings_query = select(IntegrationSettings).where(
        IntegrationSettings.hotel_id == current_user.hotel_id
    )
    settings_result = await session.execute(settings_query)
    settings = settings_result.scalar_one_or_none()
    
    if not settings:
        settings = IntegrationSettings(hotel_id=current_user.hotel_id)
    
    # Get Base URLs
    from app.core.config import get_settings
    config = get_settings()
    
    api_url = config.API_URL
    frontend_url = config.FRONTEND_URL

    # If running locally, check if we should override for production/tunnel
    # User specified app.gadget4me.in is the production URL
    if "localhost" in frontend_url or "127.0.0.1" in frontend_url:
        frontend_url = "https://app.gadget4me.in"
        api_url = "https://app.gadget4me.in"

    hotel_slug = hotel.slug
    
    html_code = f'''<!-- Staybooker Booking Widget -->
<div id="hotelier-booking-widget" 
     data-hotel-slug="{hotel_slug}"
     data-theme="{settings.widget_theme}"
     data-color="{settings.widget_primary_color}"
     data-widget-layout="{getattr(settings, "widget_layout", "modern")}">
</div>'''
    
    javascript_code = f'''<script>
  (function() {{
    var script = document.createElement('script');
    script.src = '{frontend_url}/widget-v3.js';
    script.async = true;
    script.onload = function() {{
      HotelierWidget.init({{
        hotelSlug: '{hotel_slug}',
        primaryColor: '{settings.widget_primary_color}',
        theme: '{settings.widget_theme}',
        widgetLayout: '{getattr(settings, "widget_layout", "modern")}',
        apiUrl: '{api_url}',
        frontendUrl: '{frontend_url}'
      }});
    }};
    document.head.appendChild(script);
  }})();
</script>'''
    
    css_code = f'''<style>
  #hotelier-booking-widget {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }}
  /* Widget will load its own styles */
</style>'''
    
    instructions = f'''
# Integration Instructions

## Step 1: Add the HTML
Paste this code where you want the booking widget to appear on your website:

{html_code}

## Step 2: Add the JavaScript
Add this script tag before the closing </body> tag:

{javascript_code}

## Step 3: (Optional) Verify Domain
Ensure your website domain (e.g., www.lagoonaresort.com) is added to the "Allowed Domains" list in Settings.

## Direct Booking Link:
You can also link directly to your booking page:
{frontend_url}/book/{hotel_slug}/rooms

## Need Help?
Contact support or check our documentation for advanced customization options.
'''
    
    return WidgetCodeResponse(
        html_code=html_code,
        javascript_code=javascript_code,
        css_code=css_code,
        instructions=instructions
    )


async def _send_webhook_event(
    url: str,
    payload: Dict[str, Any],
    secret: Optional[str] = None
) -> Tuple[bool, str, Optional[int]]:
    """
    Send a webhook event to the configured URL.
    Returns: (success, message, status_code)
    """
    try:
        data = json.dumps(payload)
        headers = {"Content-Type": "application/json"}

        if secret:
            signature = hmac.new(
                secret.encode(),
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            headers["X-Hub-Signature-256"] = f"sha256={signature}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, content=data, headers=headers)

            if response.is_success:
                return True, "Webhook sent successfully", response.status_code
            else:
                return False, f"Webhook failed with status {response.status_code}", response.status_code

    except httpx.RequestError as e:
        return False, f"Connection error: {str(e)}", None
    except Exception as e:
        return False, f"Unexpected error: {str(e)}", None


@router.get("/webhook-test")
async def test_webhook(
    current_user: CurrentUser,
    session: DbSession
):
    """
    Test webhook configuration by sending a test event.
    """
    settings_query = select(IntegrationSettings).where(
        IntegrationSettings.hotel_id == current_user.hotel_id
    )
    result = await session.execute(settings_query)
    settings = result.scalar_one_or_none()
    
    if not settings or not settings.webhook_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook URL not configured"
        )
    
    # Prepare test payload
    payload = {
        "event": "webhook.test",
        "hotel_id": current_user.hotel_id,
        "timestamp": datetime.utcnow().isoformat(),
        "message": "This is a test webhook event from Staybooker",
        "note": "If you are seeing this, your webhook integration is working correctly!"
    }

    # Send actual webhook
    success, message, status_code = await _send_webhook_event(
        url=settings.webhook_url,
        payload=payload,
        secret=settings.webhook_secret
    )

    if not success:
        return {
            "status": "error",
            "message": message,
            "webhook_url": settings.webhook_url,
            "http_status": status_code
        }

    return {
        "status": "success",
        "message": "Webhook test delivered successfully",
        "webhook_url": settings.webhook_url,
        "http_status": status_code,
        "note": "Check your webhook endpoint for the test event"
    }

@router.post("/test-ai")
async def test_ai_connection(
    current_user: CurrentUser,
    session: DbSession
):
    """Test AI credentials by sending a simple prompt"""
    from app.core.guest_agent import create_guest_agent_graph
    
    # Get settings
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    res = await session.execute(query)
    settings = res.scalar_one_or_none()
    
    if not settings or not settings.ai_api_key:
        return {"status": "error", "message": "API Key is missing."}
        
    try:
        agent = create_guest_agent_graph(
            session, 
            current_user.hotel_id,
            settings.ai_provider,
            settings.ai_api_key,
            settings.ai_model,
            settings.ai_base_url,
            "Test Hotel"
        )
        
        if not agent:
            return {"status": "error", "message": "Agent failed to initialize. Check your Model ID."}
            
        from langchain_core.messages import HumanMessage
        # Use short timeout for testing
        response = await agent.ainvoke({"messages": [HumanMessage(content="Respond with 'Ready' only.")]})
        ai_msg = response["messages"][-1].content
        
        return {"status": "success", "message": f"Connection Successful! AI says: {ai_msg}"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/google/connect")
async def google_oauth_connect(
    current_user: CurrentUser,
):
    """Initiates Google OAuth flow for Google Business Profile Reviews integration"""
    from app.core.config import get_settings
    settings = get_settings()
    
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Client ID is not configured on the server."
        )
        
    redirect_uri = f"{settings.API_URL}/api/v1/integration/google/callback"
    scopes = "https://www.googleapis.com/auth/business.manage"
    state = current_user.hotel_id
    
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        f"scope={scopes}&"
        f"state={state}&"
        "access_type=offline&"
        "prompt=consent"
    )
    # Return URL as JSON — frontend will redirect the browser (JWT can't travel with window.location.href)
    return {"auth_url": google_auth_url}



@router.get("/google/callback")
async def google_oauth_callback(
    code: str,
    state: str,
    session: DbSession
):
    """Callback endpoint for Google OAuth authorization code exchange"""
    from app.core.config import get_settings
    settings = get_settings()
    
    # Determine frontend redirect base URL — always go to /reviews page
    if "localhost" in settings.API_URL or "127.0.0.1" in settings.API_URL:
        frontend_url = "http://localhost:5173"
    else:
        frontend_url = "https://app.staybooker.ai"
        
    frontend_redirect = f"{frontend_url}/reviews"
    
    async with httpx.AsyncClient() as client:
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"{settings.API_URL}/api/v1/integration/google/callback"
        }
        
        try:
            response = await client.post(token_url, data=payload)
            if response.status_code != 200:
                error_msg = f"Failed to retrieve token from Google: {response.text}"
                return RedirectResponse(url=f"{frontend_redirect}&google_status=error&message={error_msg}")
                
            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            
            # Save to database
            hotel_id = state
            query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
            result = await session.execute(query)
            integration_settings = result.scalar_one_or_none()
            
            if not integration_settings:
                integration_settings = IntegrationSettings(hotel_id=hotel_id)
                
            integration_settings.google_business_access_token = access_token
            if refresh_token:
                integration_settings.google_business_refresh_token = refresh_token
                
            session.add(integration_settings)
            await session.commit()
            
            return RedirectResponse(url=f"{frontend_redirect}?google_status=success")
            
        except Exception as e:
            return RedirectResponse(url=f"{frontend_redirect}?google_status=error&message={str(e)}")


@router.get("/google/status")
async def google_connection_status(
    current_user: CurrentUser,
    session: DbSession
):
    """Check if the hotel's Google Business Profile is connected and return account info"""
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if not settings or not settings.google_business_access_token:
        return {"connected": False, "account_id": None, "location_id": None, "email": None}

    # Try to get Google user info to show which account is connected
    email = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {settings.google_business_access_token}"}
            )
            if resp.status_code == 200:
                email = resp.json().get("email")
            elif resp.status_code == 401:
                # Try refresh
                new_token = await _refresh_google_token(settings)
                if new_token:
                    settings.google_business_access_token = new_token
                    session.add(settings)
                    await session.commit()
                    resp2 = await client.get(
                        "https://www.googleapis.com/oauth2/v2/userinfo",
                        headers={"Authorization": f"Bearer {new_token}"}
                    )
                    if resp2.status_code == 200:
                        email = resp2.json().get("email")
    except Exception:
        pass

    return {
        "connected": True,
        "account_id": settings.google_business_account_id,
        "location_id": settings.google_business_location_id,
        "email": email,
    }


@router.delete("/google/disconnect")
async def google_disconnect(
    current_user: CurrentUser,
    session: DbSession
):
    """Disconnect Google Business Profile for this hotel"""
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if settings:
        settings.google_business_access_token = None
        settings.google_business_refresh_token = None
        settings.google_business_account_id = None
        settings.google_business_location_id = None
        session.add(settings)
        await session.commit()

    return {"status": "success", "message": "Google Business Profile disconnected successfully."}




async def _refresh_google_token(settings: IntegrationSettings) -> str | None:
    """Refresh Google access token using the stored refresh token. Returns new access token or None."""
    from app.core.config import get_settings
    config = get_settings()
    if not settings.google_business_refresh_token:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "refresh_token": settings.google_business_refresh_token,
            "grant_type": "refresh_token"
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
    return None


@router.get("/google/reviews")
async def get_google_reviews(
    current_user: CurrentUser,
    session: DbSession
):
    """Fetch Google Business Profile reviews for the hotel"""
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if not settings or not settings.google_business_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Business Profile not connected. Please connect via /integration/google/connect"
        )

    access_token = settings.google_business_access_token
    account_id = settings.google_business_account_id
    location_id = settings.google_business_location_id

    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient() as client:
        # Step 1: Fetch accounts if not stored
        if not account_id:
            accounts_resp = await client.get(
                "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
                headers=headers
            )
            if accounts_resp.status_code == 401:
                # Token expired, try refresh
                new_token = await _refresh_google_token(settings)
                if not new_token:
                    raise HTTPException(status_code=401, detail="Google token expired. Please reconnect.")
                settings.google_business_access_token = new_token
                session.add(settings)
                await session.commit()
                access_token = new_token
                headers = {"Authorization": f"Bearer {access_token}"}
                accounts_resp = await client.get(
                    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
                    headers=headers
                )

            if accounts_resp.status_code != 200:
                raise HTTPException(
                    status_code=accounts_resp.status_code,
                    detail=f"Google API error: {accounts_resp.text}"
                )

            accounts_data = accounts_resp.json()
            if "error" in accounts_data:
                raise HTTPException(
                    status_code=accounts_resp.status_code,
                    detail=f"Google API returned error: {accounts_data['error']}"
                )

            accounts = accounts_data.get("accounts", [])
            if not accounts:
                raise HTTPException(
                    status_code=404,
                    detail=f"No Google Business accounts found for this user. Response: {accounts_data}"
                )

            account_name = accounts[0].get("name")  # e.g. "accounts/123456"
            account_id = account_name.split("/")[-1]
            settings.google_business_account_id = account_id
            session.add(settings)
            await session.commit()

        # Step 2: Fetch locations if not stored
        if not location_id:
            locations_resp = await client.get(
                f"https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{account_id}/locations",
                headers=headers
            )
            locations_data = locations_resp.json()
            locations = locations_data.get("locations", [])
            if not locations:
                raise HTTPException(status_code=404, detail="No Google Business locations found.")

            location_name = locations[0].get("name")  # e.g. "locations/456789"
            location_id = location_name.split("/")[-1]
            settings.google_business_location_id = location_id
            session.add(settings)
            await session.commit()

        # Step 3: Fetch reviews
        reviews_resp = await client.get(
            f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews",
            headers=headers,
            params={"pageSize": 50, "orderBy": "updateTime desc"}
        )

        if reviews_resp.status_code != 200:
            raise HTTPException(
                status_code=reviews_resp.status_code,
                detail=f"Failed to fetch reviews: {reviews_resp.text}"
            )

        return reviews_resp.json()


@router.post("/google/reviews/{review_id}/ai-reply")
async def generate_ai_reply(
    review_id: str,
    request: Request,
    current_user: CurrentUser,
    session: DbSession
):
    """Generate an AI reply for a Google review"""
    body = await request.json()
    reviewer_name = body.get("reviewer_name", "Guest")
    review_text = body.get("review_text", "")
    star_rating = body.get("star_rating", 5)

    # Get integration settings for AI config
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    # Get hotel name
    hotel = await session.get(Hotel, current_user.hotel_id)
    hotel_name = hotel.name if hotel else "Our Hotel"

    # Build AI prompt
    stars_label = {1: "very negative", 2: "negative", 3: "neutral", 4: "positive", 5: "very positive"}.get(star_rating, "positive")
    prompt = f"""You are the hotel manager of {hotel_name}. Write a professional, warm, and personalized reply to the following Google review.

Reviewer: {reviewer_name}
Star Rating: {star_rating}/5 ({stars_label} review)
Review: {review_text}

Guidelines:
- Be warm, professional, and grateful
- Address the reviewer by name
- If the review is negative, acknowledge concerns and invite them to contact us directly
- Keep it concise (2-4 sentences max)
- End with an invitation to return
- Do NOT use generic templates — make it feel personal

Reply:"""

    try:
        from app.core.guest_agent import create_guest_agent_graph
        from langchain_core.messages import HumanMessage

        if settings and settings.ai_api_key:
            agent = create_guest_agent_graph(
                session, current_user.hotel_id,
                settings.ai_provider, settings.ai_api_key,
                settings.ai_model, settings.ai_base_url,
                hotel_name
            )
            if agent:
                response = await agent.ainvoke({"messages": [HumanMessage(content=prompt)]})
                reply_text = response["messages"][-1].content
                return {"reply": reply_text.strip()}

        # Fallback: use platform Groq key
        from app.core.config import get_settings
        config = get_settings()
        if config.GROQ_API_KEY:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {config.GROQ_API_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.1-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 200
                    }
                )
                if resp.status_code == 200:
                    reply_text = resp.json()["choices"][0]["message"]["content"]
                    return {"reply": reply_text.strip()}

        raise HTTPException(status_code=500, detail="No AI provider configured. Please set up AI in Integration settings.")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/google/reviews/{review_id}/reply")
async def post_google_review_reply(
    review_id: str,
    request: Request,
    current_user: CurrentUser,
    session: DbSession
):
    """Post a reply to a Google Business Profile review"""
    body = await request.json()
    reply_text = body.get("comment", "")

    if not reply_text.strip():
        raise HTTPException(status_code=400, detail="Reply text cannot be empty.")

    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if not settings or not settings.google_business_access_token:
        raise HTTPException(status_code=400, detail="Google Business Profile not connected.")

    account_id = settings.google_business_account_id
    location_id = settings.google_business_location_id

    if not account_id or not location_id:
        raise HTTPException(status_code=400, detail="Please fetch reviews first to initialize account/location IDs.")

    headers = {
        "Authorization": f"Bearer {settings.google_business_access_token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews/{review_id}/reply",
            headers=headers,
            json={"comment": reply_text}
        )

        if resp.status_code == 401:
            new_token = await _refresh_google_token(settings)
            if new_token:
                settings.google_business_access_token = new_token
                session.add(settings)
                await session.commit()
                headers["Authorization"] = f"Bearer {new_token}"
                resp = await client.put(
                    f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews/{review_id}/reply",
                    headers=headers,
                    json={"comment": reply_text}
                )

        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=resp.status_code, detail=f"Failed to post reply: {resp.text}")

        return {"status": "success", "message": "Reply posted successfully to Google!", "data": resp.json()}

