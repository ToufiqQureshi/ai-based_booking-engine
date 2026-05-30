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
from app.core.limiter import limiter
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

@router.post("/test-whatsapp")
async def test_whatsapp_connection(
    current_user: CurrentUser,
    session: DbSession
):
    """Test WhatsApp credentials by fetching the phone number profile"""
    query = select(Hotel).where(Hotel.id == current_user.hotel_id)
    res = await session.execute(query)
    hotel = res.scalar_one_or_none()
    
    if not hotel or not hotel.settings:
        return {"status": "error", "message": "Hotel settings not found."}
        
    wa_token = hotel.settings.get("whatsapp_api_key")
    wa_phone_id = hotel.settings.get("whatsapp_phone_number_id")
    
    if not wa_token or not wa_phone_id:
        return {"status": "error", "message": "WhatsApp API Key or Phone ID is missing. Please save settings first."}
        
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://graph.facebook.com/v21.0/{wa_phone_id}",
                headers={"Authorization": f"Bearer {wa_token}"}
            )
            
            if resp.status_code == 200:
                data = resp.json()
                display_phone_number = data.get("display_phone_number", "Verified")
                return {"status": "success", "message": f"Connection Successful! Validated Phone Number."}
            else:
                try:
                    err = resp.json().get("error", {}).get("message", resp.text)
                except:
                    err = resp.text
                return {"status": "error", "message": f"Meta Error: {err}"}
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
@limiter.limit("10/minute")
async def get_google_reviews(
    request: Request,
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
                logger.error(f"Google API error fetching accounts: {accounts_resp.text}")
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
                logger.warning(f"No Google Business accounts found for hotel_id {current_user.hotel_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"No Google Business accounts found for this user. Ensure you have a Business Profile set up."
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
@limiter.limit("5/minute")
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


@router.get("/whatsapp/webhook")
async def whatsapp_webhook_verification(
    request: Request
):
    """
    Meta calls this GET endpoint to verify the webhook.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    challenge = params.get("hub.challenge")
    verify_token = params.get("hub.verify_token")

    if mode == "subscribe" and challenge:
        # Check against a default webhook verify token
        if verify_token == "whatsapp_agent_verify_token":
            from fastapi.responses import PlainTextResponse
            return PlainTextResponse(content=challenge)
        else:
            raise HTTPException(status_code=403, detail="Invalid verification token")
    raise HTTPException(status_code=400, detail="Missing challenge or invalid mode")


@router.post("/whatsapp/webhook")
@limiter.limit("60/minute")
async def whatsapp_webhook_receive(
    request: Request,
    session: DbSession
):
    """
    Meta calls this POST endpoint when a guest sends a WhatsApp message.
    """
    import logging
    logger = logging.getLogger("whatsapp_webhook")
    
    debug_log = []  # Collect debug info to return in response
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    entry = body.get("entry", [])
    if not entry:
        return {"status": "ignored", "reason": "no entries"}
        
    for ent in entry:
        changes = ent.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            if "messages" not in value:
                debug_log.append("SKIP: no messages in value")
                continue
                
            metadata = value.get("metadata", {})
            phone_number_id = str(metadata.get("phone_number_id", ""))
            debug_log.append(f"phone_number_id from webhook: '{phone_number_id}' (type: {type(metadata.get('phone_number_id')).__name__})")
            
            if not phone_number_id:
                debug_log.append("SKIP: empty phone_number_id")
                continue
                
            from app.core.config import get_settings
            config = get_settings()
            
            # Identify if this is the Central Number or a Specific Hotel's Number
            is_central_number = (config.CENTRAL_WHATSAPP_PHONE_ID and phone_number_id == config.CENTRAL_WHATSAPP_PHONE_ID)
            
            # Define these variables to be populated
            target_hotel = None
            whatsapp_token_to_use = None
            
            if not is_central_number:
                # OLD BEHAVIOR: Specific Hotel Number Match
                hotel_stmt = select(Hotel)
                hotel_res = await session.execute(hotel_stmt)
                hotels = hotel_res.scalars().all()
                for h in hotels:
                    h_settings = h.settings or {}
                    stored_id = h_settings.get("whatsapp_phone_number_id")
                    if str(stored_id) == phone_number_id:
                        target_hotel = h
                        whatsapp_token_to_use = h_settings.get("whatsapp_api_key")
                        break
                
                if not target_hotel:
                    debug_log.append(f"SKIP: No hotel found for specific phone_number_id '{phone_number_id}'")
                    continue
            else:
                # NEW BEHAVIOR: Central Number Handling
                whatsapp_token_to_use = config.CENTRAL_WHATSAPP_TOKEN
                # We don't know the hotel yet. We will resolve it per message.
                    
            if not target_hotel:
                debug_log.append(f"SKIP: No hotel found matching phone_number_id '{phone_number_id}'")
                continue
            
            debug_log.append(f"MATCH: Hotel '{target_hotel.name}' (ID: {target_hotel.id})")
                
            # Check Subscription and WhatsApp credits quota
            from app.models.subscription import Subscription
            sub_stmt = select(Subscription).where(Subscription.hotel_id == target_hotel.id, Subscription.status == "active")
            sub_res = await session.execute(sub_stmt)
            subscription = sub_res.scalar_one_or_none()

            # If credits are exhausted, do not respond to save costs
            if subscription and subscription.whatsapp_credits <= 0:
                debug_log.append("SKIP: WhatsApp credits exhausted")
                continue
            
            debug_log.append(f"Subscription: {'active' if subscription else 'none (OK, no limit)'}")

            # Check if AI feature flag is active
            if not target_hotel.feature_ai_agent:
                debug_log.append("SKIP: feature_ai_agent is False")
                continue
            
            debug_log.append(f"feature_ai_agent: {target_hotel.feature_ai_agent}")

            # Load integration settings to get AI credentials
            int_stmt = select(IntegrationSettings).where(IntegrationSettings.hotel_id == target_hotel.id)
            int_res = await session.execute(int_stmt)
            int_settings = int_res.scalar_one_or_none()
            
            if not int_settings or not int_settings.ai_api_key:
                debug_log.append(f"SKIP: int_settings={bool(int_settings)}, ai_api_key={bool(int_settings.ai_api_key) if int_settings else False}")
                continue
            
            debug_log.append(f"AI Config: provider={int_settings.ai_provider}, model={int_settings.ai_model}")

            messages = value.get("messages", [])
            contacts = value.get("contacts", [])
            contact_name = "Guest"
            if contacts:
                contact_name = contacts[0].get("profile", {}).get("name", "Guest")
                
            for msg in messages:
                sender_phone = msg.get("from")
                msg_type = msg.get("type")
                
                if msg_type != "text" or not sender_phone:
                    continue
                    
                user_message = msg.get("text", {}).get("body", "").strip()
                if not user_message:
                    continue
                
                debug_log.append(f"Processing message from {sender_phone}: '{user_message[:50]}'")
                
                from app.core.redis_client import redis_client
                
                # --- RESOLVE TARGET HOTEL IF CENTRAL NUMBER ---
                agent_reply = ""
                resolved_hotel = target_hotel
                
                if is_central_number:
                    # Check if session is already mapped to a hotel
                    session_key = f"whatsapp:global_session:{sender_phone}:hotel_id"
                    stored_hotel_id = redis_client.get_value(session_key)
                    
                    if stored_hotel_id:
                        # Load the hotel
                        h_stmt = select(Hotel).where(Hotel.id == stored_hotel_id)
                        h_res = await session.execute(h_stmt)
                        resolved_hotel = h_res.scalar_one_or_none()
                    
                    if not resolved_hotel:
                        # We don't know the hotel. Trigger the Global Concierge Agent
                        try:
                            from app.core.global_agent import create_global_concierge_graph
                            global_agent = create_global_concierge_graph(
                                session,
                                ai_provider="groq", # Defaulting to Groq for Staybooker central
                                ai_api_key=config.GROQ_API_KEY,
                                ai_model="llama-3.1-8b-instant"
                            )
                            
                            if not global_agent:
                                debug_log.append("Global agent disabled or missing GROQ key.")
                                continue
                                
                            history_key = f"whatsapp:global_chat:{sender_phone}"
                            history_raw = redis_client.get_value(history_key)
                            history = json.loads(history_raw) if history_raw else []
                            
                            from langchain_core.messages import HumanMessage, AIMessage
                            chat_history = []
                            for role, content in history:
                                if role in ("human", "user"):
                                    chat_history.append(HumanMessage(content=content))
                                elif role in ("ai", "assistant", "model"):
                                    chat_history.append(AIMessage(content=content))
                                    
                            input_messages = chat_history + [HumanMessage(content=user_message)]
                            result = await global_agent.ainvoke({"messages": input_messages})
                            agent_reply = result["messages"][-1].content
                            
                            # Check if the global agent routed to a hotel
                            if "ACTION:ROUTE_TO_HOTEL|" in agent_reply:
                                parts = agent_reply.split("ACTION:ROUTE_TO_HOTEL|")
                                action_data = json.loads(parts[1].strip())
                                selected_hotel_id = action_data.get("hotel_id")
                                selected_hotel_name = action_data.get("hotel_name")
                                
                                # Save to Redis to lock session
                                redis_client.set_value(session_key, selected_hotel_id, expire=86400) # 24h
                                
                                agent_reply = f"Connecting you to {selected_hotel_name}... \n\nHi! I'm the virtual assistant for {selected_hotel_name}. How can I help you today?"
                                
                                # Clear global history so hotel agent starts fresh
                                redis_client.delete_value(history_key)
                            else:
                                # Save global history
                                history.append(["user", user_message])
                                history.append(["assistant", agent_reply])
                                redis_client.set_value(history_key, json.dumps(history[-10:]), expire=86400)
                                
                        except Exception as e:
                            logger.error(f"Global Agent error: {e}")
                            continue

                # --- ROUTE TO SPECIFIC HOTEL AGENT ---
                if resolved_hotel:
                    # Proceed with guest_agent
                    # Check Subscription
                    from app.models.subscription import Subscription
                    sub_stmt = select(Subscription).where(Subscription.hotel_id == resolved_hotel.id, Subscription.status == "active")
                    sub_res = await session.execute(sub_stmt)
                    subscription = sub_res.scalar_one_or_none()
                    if subscription and subscription.whatsapp_credits <= 0:
                        continue
                        
                    if not resolved_hotel.feature_ai_agent:
                        continue
                        
                    int_stmt = select(IntegrationSettings).where(IntegrationSettings.hotel_id == resolved_hotel.id)
                    int_res = await session.execute(int_stmt)
                    int_settings = int_res.scalar_one_or_none()
                    if not int_settings or not int_settings.ai_api_key:
                        continue

                    # Load chat history
                    redis_key = f"whatsapp:session:{resolved_hotel.id}:{sender_phone}"
                    history_raw = redis_client.get_value(redis_key)
                    history = json.loads(history_raw) if history_raw else []
                    
                    from langchain_core.messages import HumanMessage, AIMessage
                    chat_history = []
                    for role, content in history:
                        if role in ("human", "user"):
                            chat_history.append(HumanMessage(content=content))
                        elif role in ("ai", "assistant", "model"):
                            chat_history.append(AIMessage(content=content))
                            
                    try:
                        from app.core.guest_agent import create_guest_agent_graph
                        agent = create_guest_agent_graph(
                            session,
                            resolved_hotel.id,
                            int_settings.ai_provider,
                            int_settings.ai_api_key,
                            int_settings.ai_model,
                            int_settings.ai_base_url,
                            resolved_hotel.name
                        )
                        
                        if agent:
                            # Use initial agent_reply (if it was "Connecting you...") or invoke agent
                            if not agent_reply:
                                input_messages = chat_history + [HumanMessage(content=user_message)]
                                result = await agent.ainvoke({"messages": input_messages})
                                agent_reply = result["messages"][-1].content
                                
                            # Check for booking action
                            if "ACTION:BOOKING_LINK|" in agent_reply:
                                try:
                                    parts = agent_reply.split("ACTION:BOOKING_LINK|")
                                    action_data_str = parts[1].strip()
                                    action_data = json.loads(action_data_str)
                                    
                                    from app.core.config import get_settings
                                    config = get_settings()
                                    frontend_url = config.FRONTEND_URL
                                    if "localhost" in frontend_url or "127.0.0.1" in frontend_url:
                                        frontend_url = "https://app.gadget4me.in"
                                    
                                    check_in = action_data.get("checkInDate", "")
                                    check_out = action_data.get("checkOutDate", "")
                                    adults = action_data.get("adults", 1)
                                    children = action_data.get("children", 0)
                                    guest_info = action_data.get("guest_info", {})
                                    first_name = guest_info.get("firstName", "")
                                    last_name = guest_info.get("lastName", "")
                                    email = guest_info.get("email", "")
                                    phone = guest_info.get("phone", sender_phone)
                                    
                                    room_id = ""
                                    rooms_list = action_data.get("rooms", [])
                                    if rooms_list:
                                        room_id = rooms_list[0].get("id", "")
                                    
                                    booking_url = f"{frontend_url}/book/{resolved_hotel.slug}/rooms?checkIn={check_in}&checkOut={check_out}&adults={adults}&children={children}&roomTypeId={room_id}&firstName={first_name}&lastName={last_name}&email={email}&phone={phone}"
                                    
                                    agent_reply = f"I have prepared your booking details for {resolved_hotel.name}. Please click the link below to complete your booking:\n\n👉 {booking_url}"
                                except Exception:
                                    pass
                                    
                            # Update History
                            history.append(["user", user_message])
                            history.append(["assistant", agent_reply])
                            redis_client.set_value(redis_key, json.dumps(history[-30:]), expire=86400)
                            
                            if subscription:
                                subscription.whatsapp_credits = max(0, subscription.whatsapp_credits - 1)
                                session.add(subscription)
                                await session.commit()
                                await session.refresh(subscription)

                    except Exception as e:
                        logger.error(f"Guest Agent error: {e}", exc_info=True)
                        continue

                # --- SEND WHATSAPP REPLY ---
                if agent_reply and whatsapp_token_to_use:
                    send_url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
                    headers = {
                        "Authorization": f"Bearer {whatsapp_token_to_use}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "messaging_product": "whatsapp",
                        "recipient_type": "individual",
                        "to": sender_phone,
                        "type": "text",
                        "text": {"body": agent_reply}
                    }
                    
                    try:
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            wa_response = await client.post(send_url, headers=headers, json=payload)
                            logger.info(f"WhatsApp send status={wa_response.status_code}")
                    except Exception as e:
                        logger.error(f"WhatsApp send error: {e}")
    
    logger.info(f"WhatsApp webhook debug: {debug_log}")
    return {"status": "success", "debug": debug_log}


