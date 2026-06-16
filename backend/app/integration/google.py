"""
Google Business Profile — OAuth flow, reviews, AI reply.
"""
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlmodel import select

from app.core.auth.deps import CurrentUser, DbSession
from app.core.utils.config import get_settings
from app.core.utils.limiter import limiter
from app.brand_console.hotel import Hotel
from app.integration.integration import IntegrationSettings

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Signed OAuth state (TEN-04)
# ---------------------------------------------------------------------------
# The OAuth `state` round-trips through Google and comes back attacker-
# influenceable. Previously it was the raw hotel_id, so an attacker could
# complete OAuth with their own Google account and replay the callback with
# state=<victim_hotel_id> to write THEIR tokens onto the victim's hotel.
# We HMAC-sign (hotel_id, issued_at) so the callback only trusts a state we
# minted, valid for a short window.
import hmac
import hashlib
import time

_STATE_TTL_SECONDS = 600  # 10 minutes to complete the consent flow


def _sign_oauth_state(hotel_id: str) -> str:
    ts = str(int(time.time()))
    msg = f"{hotel_id}:{ts}"
    secret = get_settings().SECRET_KEY.encode()
    sig = hmac.new(secret, msg.encode(), hashlib.sha256).hexdigest()
    return f"{msg}:{sig}"


def _verify_oauth_state(state: str) -> Optional[str]:
    try:
        hotel_id, ts, sig = state.rsplit(":", 2)
    except ValueError:
        return None
    secret = get_settings().SECRET_KEY.encode()
    expected = hmac.new(secret, f"{hotel_id}:{ts}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        if int(time.time()) - int(ts) > _STATE_TTL_SECONDS:
            return None
    except ValueError:
        return None
    return hotel_id


async def _refresh_google_token(settings: IntegrationSettings) -> str | None:
    """Refresh Google access token. Returns new access token or None."""
    if not settings.google_business_refresh_token:
        return None
    config = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "refresh_token": settings.google_business_refresh_token,
            "grant_type": "refresh_token",
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
    return None


# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------

@router.get("/google/connect")
async def google_oauth_connect(current_user: CurrentUser):
    """Initiate Google OAuth flow for Business Profile Reviews."""
    config = get_settings()
    if not config.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Client ID is not configured on the server.",
        )
    redirect_uri = f"{config.API_URL}/api/v1/integration/google/callback"
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={config.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        "response_type=code&"
        "scope=https://www.googleapis.com/auth/business.manage&"
        f"state={_sign_oauth_state(current_user.hotel_id)}&"
        "access_type=offline&prompt=consent"
    )
    return {"auth_url": google_auth_url}


@router.get("/google/callback")
async def google_oauth_callback(code: str, state: str, session: DbSession):
    """Exchange authorization code for tokens and save them."""
    config = get_settings()
    if "localhost" in config.API_URL or "127.0.0.1" in config.API_URL:
        frontend_redirect = "http://localhost:5173/reviews"
    else:
        frontend_redirect = "https://app.staybooker.ai/reviews"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": config.GOOGLE_CLIENT_ID,
                "client_secret": config.GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{config.API_URL}/api/v1/integration/google/callback",
            })
            if response.status_code != 200:
                return RedirectResponse(url=f"{frontend_redirect}?google_status=error&message=Failed+to+retrieve+token")

            # SECURITY (TEN-04): only trust a state we signed ourselves.
            hotel_id = _verify_oauth_state(state)
            if not hotel_id:
                return RedirectResponse(url=f"{frontend_redirect}?google_status=error&message=Invalid+or+expired+state")

            token_data = response.json()
            query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == hotel_id)
            result = await session.execute(query)
            int_settings = result.scalar_one_or_none() or IntegrationSettings(hotel_id=hotel_id)

            int_settings.google_business_access_token = token_data.get("access_token")
            if token_data.get("refresh_token"):
                int_settings.google_business_refresh_token = token_data["refresh_token"]

            session.add(int_settings)
            await session.commit()
            return RedirectResponse(url=f"{frontend_redirect}?google_status=success")
        except Exception as e:
            return RedirectResponse(url=f"{frontend_redirect}?google_status=error&message={str(e)}")


@router.get("/google/status")
async def google_connection_status(current_user: CurrentUser, session: DbSession):
    """Check Google Business Profile connection status."""
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if not settings or not settings.google_business_access_token:
        return {"connected": False, "account_id": None, "location_id": None, "email": None}

    email = None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {settings.google_business_access_token}"},
            )
            if resp.status_code == 200:
                email = resp.json().get("email")
            elif resp.status_code == 401:
                new_token = await _refresh_google_token(settings)
                if new_token:
                    settings.google_business_access_token = new_token
                    session.add(settings)
                    await session.commit()
                    resp2 = await client.get(
                        "https://www.googleapis.com/oauth2/v2/userinfo",
                        headers={"Authorization": f"Bearer {new_token}"},
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
async def google_disconnect(current_user: CurrentUser, session: DbSession):
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


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

@router.get("/google/reviews")
@limiter.limit("10/minute")
async def get_google_reviews(request: Request, current_user: CurrentUser, session: DbSession):
    """Fetch Google Business Profile reviews."""
    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    if not settings or not settings.google_business_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Business Profile not connected. Please connect via /integration/google/connect",
        )

    access_token = settings.google_business_access_token
    account_id = settings.google_business_account_id
    location_id = settings.google_business_location_id
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient() as client:
        if not account_id:
            accounts_resp = await client.get(
                "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
                headers=headers,
            )
            if accounts_resp.status_code == 401:
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
                    headers=headers,
                )

            if accounts_resp.status_code != 200:
                logger.error("Google API error fetching accounts: %s", accounts_resp.text)
                raise HTTPException(status_code=accounts_resp.status_code, detail=f"Google API error: {accounts_resp.text}")

            accounts_data = accounts_resp.json()
            if "error" in accounts_data:
                raise HTTPException(status_code=accounts_resp.status_code, detail=f"Google API error: {accounts_data['error']}")

            accounts = accounts_data.get("accounts", [])
            if not accounts:
                logger.warning("No Google Business accounts found for hotel_id %s", current_user.hotel_id)
                raise HTTPException(status_code=404, detail="No Google Business accounts found. Ensure you have a Business Profile set up.")

            account_id = accounts[0].get("name", "").split("/")[-1]
            settings.google_business_account_id = account_id
            session.add(settings)
            await session.commit()

        if not location_id:
            locations_resp = await client.get(
                f"https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{account_id}/locations",
                headers=headers,
            )
            locations = locations_resp.json().get("locations", [])
            if not locations:
                raise HTTPException(status_code=404, detail="No Google Business locations found.")

            location_id = locations[0].get("name", "").split("/")[-1]
            settings.google_business_location_id = location_id
            session.add(settings)
            await session.commit()

        reviews_resp = await client.get(
            f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews",
            headers=headers,
            params={"pageSize": 50, "orderBy": "updateTime desc"},
        )
        if reviews_resp.status_code != 200:
            raise HTTPException(status_code=reviews_resp.status_code, detail=f"Failed to fetch reviews: {reviews_resp.text}")

        return reviews_resp.json()


@router.post("/google/reviews/{review_id}/ai-reply")
@limiter.limit("5/minute")
async def generate_ai_reply(
    review_id: str,
    request: Request,
    current_user: CurrentUser,
    session: DbSession,
):
    """Generate an AI reply for a Google review."""
    body = await request.json()
    reviewer_name = body.get("reviewer_name", "Guest")
    review_text = body.get("review_text", "")
    star_rating = body.get("star_rating", 5)

    query = select(IntegrationSettings).where(IntegrationSettings.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    settings = result.scalar_one_or_none()

    hotel = await session.get(Hotel, current_user.hotel_id)
    hotel_name = hotel.name if hotel else "Our Hotel"

    stars_label = {1: "very negative", 2: "negative", 3: "neutral", 4: "positive", 5: "very positive"}.get(star_rating, "positive")
    prompt = f"""You are the hotel manager of {hotel_name}. Write a professional, warm reply to this Google review.

Reviewer: {reviewer_name}
Rating: {star_rating}/5 ({stars_label})
Review: {review_text}

Guidelines: Be warm and grateful. Address reviewer by name. For negative reviews, acknowledge concerns and invite direct contact. Keep it 2-4 sentences. End with invitation to return. Make it personal, not generic.

Reply:"""

    try:
        from app.ai_engine.guest_agent import create_guest_agent_graph
        from agno.agent import Message

        effective_provider = (getattr(settings, "ai_provider", None) or getattr(hotel, "ai_provider", None))
        effective_api_key = (getattr(settings, "ai_api_key", None) or getattr(hotel, "ai_api_key", None))
        effective_model = (getattr(settings, "ai_model", None) or getattr(hotel, "ai_model", None))
        effective_base_url = (getattr(settings, "ai_base_url", None) or getattr(hotel, "ai_base_url", None))

        if effective_api_key:
            agent = await create_guest_agent_graph(
                session, current_user.hotel_id,
                effective_provider, effective_api_key,
                effective_model, effective_base_url,
                hotel_name,
            )
            if agent:
                result = await agent.arun([Message(role="user", content=prompt)])
                return {"reply": (result.content or "").strip()}

        config = get_settings()
        if config.GROQ_API_KEY:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {config.GROQ_API_KEY}", "Content-Type": "application/json"},
                    json={"model": "llama-3.1-70b-versatile", "messages": [{"role": "user", "content": prompt}], "max_tokens": 200},
                )
                if resp.status_code == 200:
                    return {"reply": resp.json()["choices"][0]["message"]["content"].strip()}

        raise HTTPException(status_code=500, detail="No AI provider configured.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/google/reviews/{review_id}/reply")
async def post_google_review_reply(
    review_id: str,
    request: Request,
    current_user: CurrentUser,
    session: DbSession,
):
    """Post a reply to a Google Business Profile review."""
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
        "Content-Type": "application/json",
    }
    reply_url = f"https://mybusiness.googleapis.com/v4/accounts/{account_id}/locations/{location_id}/reviews/{review_id}/reply"

    async with httpx.AsyncClient() as client:
        resp = await client.put(reply_url, headers=headers, json={"comment": reply_text})
        if resp.status_code == 401:
            new_token = await _refresh_google_token(settings)
            if new_token:
                settings.google_business_access_token = new_token
                session.add(settings)
                await session.commit()
                headers["Authorization"] = f"Bearer {new_token}"
                resp = await client.put(reply_url, headers=headers, json={"comment": reply_text})

        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=resp.status_code, detail=f"Failed to post reply: {resp.text}")

        return {"status": "success", "message": "Reply posted successfully to Google!", "data": resp.json()}

