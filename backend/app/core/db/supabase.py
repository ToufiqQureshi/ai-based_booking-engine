# Migrated from python-jose to PyJWT in P4.7 — jose has known CVEs and is
# unmaintained. PyJWT provides equivalent functionality with a similar API.
import jwt
import logging
import httpx
import json
from supabase import create_client, Client
from app.core.utils.config import get_settings

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
                jwk_dict = next((key for key in jwks["keys"] if key["kid"] == kid), None)

                if jwk_dict:
                    # PyJWT 2.4+ exposes a PyJWK helper that knows how to
                    # turn a JWK dict into a cryptography key. This is the
                    # supported way to verify ES256 tokens against a JWKS.
                    py_jwk = jwt.PyJWK(jwk_dict)
                    payload = jwt.decode(
                        token,
                        py_jwk.key,
                        algorithms=["ES256"],
                        options={"verify_aud": False, "verify_signature": True}
                    )
                    return payload
            except Exception as e:
                logger.warning(f"JWKS verification failed, trying fallback: {str(e)}")

        # 3. Fallback to the Supabase HS256 JWT secret. We deliberately do NOT
        #    fall back to the app's own SECRET_KEY here: SECRET_KEY signs our
        #    internally-minted tokens, and mixing it into the Supabase
        #    verification path widens the forgery surface (a leaked SECRET_KEY
        #    would let an attacker mint "Supabase" identities). Supabase tokens
        #    must verify against Supabase keys only.
        if settings.SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    # require=["exp"] ensures a token without an expiry is rejected.
                    options={"verify_aud": False, "verify_signature": True, "require": ["exp"]},
                )
                return payload
            except Exception as e:
                logger.debug(f"Supabase secret verification failed: {str(e)}")

        # NOTE: There is intentionally NO "unverified claims" debug fallback.
        # Returning unverified claims (even gated on DEBUG) is a complete auth
        # bypass if DEBUG ever leaks into production — any forged token, incl.
        # role=SUPER_ADMIN, would be accepted. Removed for safety.

    except Exception as e:
        logger.warning(f"Complete Token Verification failure: {str(e)}")
        return None

    return None
