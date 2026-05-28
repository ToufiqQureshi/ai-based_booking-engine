from jose import jwt, jwk
from jose.utils import base64url_decode
import logging
import httpx
import json
from supabase import create_client, Client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Cache for JWKS keys
_jwks_cache = None

async def get_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    
    jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        _jwks_cache = resp.json()
    return _jwks_cache

def get_supabase() -> Client:
    """Provides a Supabase client using Service Role key for admin actions."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

async def verify_supabase_token(token: str) -> dict | None:
    """
    Verifies a Supabase JWT locally. 
    Tries JWKS (ES256) first, then falls back to Secret (HS256).
    """
    try:
        # 1. Decode without verification first just to see kid/alg
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg")
        logger.info(f"Token Header: alg={alg}, kid={kid}")
        
        # 2. Try JWKS if kid is present and alg is ES256
        if kid and alg == "ES256":
            try:
                jwks = await get_jwks()
                rsa_key = next((key for key in jwks["keys"] if key["kid"] == kid), None)
                
                if rsa_key:
                    payload = jwt.decode(
                        token,
                        rsa_key,
                        algorithms=["ES256"],
                        options={"verify_aud": False, "verify_signature": True}
                    )
                    return payload
            except Exception as e:
                logger.warning(f"JWKS verification failed, trying fallback: {str(e)}")

        # 3. Fallback to Secret (Industry Standard for local dev or if JWKS is flaky)
        for secret in [settings.SUPABASE_JWT_SECRET, settings.SECRET_KEY]:
            if secret:
                try:
                    payload = jwt.decode(
                        token, 
                        secret, 
                        algorithms=["HS256"], 
                        options={"verify_aud": False, "verify_signature": True}
                    )
                    return payload
                except Exception as e:
                    logger.debug(f"Secret verification failed for a key: {str(e)}")
        
        # 4. Emergency: Unverified payload (ONLY for debugging, remove in production!)
        if settings.DEBUG:
            logger.warning("Returning UNVERIFIED payload for debugging!")
            return jwt.get_unverified_claims(token)

    except Exception as e:
        logger.error(f"Complete Token Verification failure: {str(e)}")
        return None
    
    return None

    
    return None
