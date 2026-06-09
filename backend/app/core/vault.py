"""
Supabase Vault integration — AES-256-GCM encrypted secrets storage.

All functions gracefully fall back to plain-text when Vault is unavailable
(SQLite dev, non-Supabase Postgres, or extension not yet enabled). This
ensures the app stays functional in all environments while production data
is always encrypted.

Usage pattern for hotel.settings secrets:
    resolved = await resolve_settings_secrets(session, hotel.settings)
    smtp_password = resolved.get("smtp_password")  # decrypted from Vault

Usage pattern for model column secrets:
    key = await get_hotel_ai_key(session, integration_settings, hotel)
"""
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_VAULT_AVAILABLE: Optional[bool] = None

# Maps: plain-text settings key → vault_id settings key
_SETTINGS_VAULT_MAP = {
    "razorpay_key_secret": "razorpay_key_secret_vault_id",
    "whatsapp_api_key": "whatsapp_api_key_vault_id",
    "smtp_password": "smtp_password_vault_id",
}


async def _is_vault_available(session: AsyncSession) -> bool:
    global _VAULT_AVAILABLE
    if _VAULT_AVAILABLE is not None:
        return _VAULT_AVAILABLE
    try:
        await session.execute(text("SELECT 1 FROM vault.secrets LIMIT 1"))
        _VAULT_AVAILABLE = True
    except Exception:
        _VAULT_AVAILABLE = False
        logger.warning("Supabase Vault not available — secrets stored as plain text (enable supabase_vault extension)")
    return _VAULT_AVAILABLE


async def vault_store(session: AsyncSession, name: str, secret: str) -> Optional[str]:
    """Store a new secret in Vault. Returns the UUID, or None if Vault unavailable."""
    if not await _is_vault_available(session):
        return None
    try:
        result = await session.execute(
            text("SELECT vault.create_secret(:secret, :name, :desc)"),
            {"secret": secret, "name": name, "desc": f"Staybooker managed: {name}"},
        )
        return str(result.scalar())
    except Exception as e:
        logger.error("vault_store failed for %s: %s", name, e)
        return None


async def vault_get(session: AsyncSession, vault_id: str) -> Optional[str]:
    """Fetch and decrypt a secret by its vault UUID. Returns None on any failure."""
    if not vault_id:
        return None
    if not await _is_vault_available(session):
        return None
    try:
        result = await session.execute(
            text("SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = :id"),
            {"id": vault_id},
        )
        row = result.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.error("vault_get failed for id %s: %s", vault_id, e)
        return None


async def vault_update(session: AsyncSession, vault_id: str, new_secret: str) -> bool:
    """Update an existing Vault secret. Returns True on success."""
    if not vault_id or not await _is_vault_available(session):
        return False
    try:
        await session.execute(
            text("SELECT vault.update_secret(:id, :secret)"),
            {"id": vault_id, "secret": new_secret},
        )
        return True
    except Exception as e:
        logger.error("vault_update failed for id %s: %s", vault_id, e)
        return False


async def vault_delete(session: AsyncSession, vault_id: str) -> bool:
    """Delete a secret from Vault by its UUID."""
    if not vault_id or not await _is_vault_available(session):
        return False
    try:
        await session.execute(
            text("DELETE FROM vault.secrets WHERE id = :id"),
            {"id": vault_id},
        )
        return True
    except Exception as e:
        logger.error("vault_delete failed for id %s: %s", vault_id, e)
        return False


async def resolve_settings_secrets(session: AsyncSession, settings: dict) -> dict:
    """
    Return a copy of hotel.settings with Vault references resolved.
    For each <key>_vault_id entry found, fetches the decrypted value and
    puts it back under the original <key>. Non-vault values are unchanged.
    """
    if not settings or not isinstance(settings, dict):
        return settings or {}
    resolved = dict(settings)
    for plaintext_key, vault_id_key in _SETTINGS_VAULT_MAP.items():
        vault_id = resolved.get(vault_id_key)
        if vault_id:
            secret = await vault_get(session, vault_id)
            if secret is not None:
                resolved[plaintext_key] = secret
    return resolved


async def store_settings_secret(
    session: AsyncSession,
    settings: dict,
    key: str,
    new_value: Optional[str],
    hotel_id: str,
) -> dict:
    """
    Store/update a hotel.settings secret in Vault.
    Writes the vault_id into settings and clears the plaintext key.
    If Vault is unavailable, stores plaintext (backward compat).
    Empty string / None = delete from Vault and clear.
    """
    vault_id_key = _SETTINGS_VAULT_MAP.get(key)
    if not vault_id_key:
        settings[key] = new_value or None
        return settings

    if not new_value:
        existing_vault_id = settings.get(vault_id_key)
        if existing_vault_id:
            await vault_delete(session, existing_vault_id)
        settings[vault_id_key] = None
        settings[key] = None
        return settings

    existing_vault_id = settings.get(vault_id_key)
    vault_name = f"hotel_{hotel_id}_{key}"

    if existing_vault_id:
        success = await vault_update(session, existing_vault_id, new_value)
        if not success:
            settings[key] = new_value
    else:
        new_vault_id = await vault_store(session, vault_name, new_value)
        if new_vault_id:
            settings[vault_id_key] = new_vault_id
            settings[key] = None
        else:
            settings[key] = new_value

    return settings


async def store_column_secret(
    session: AsyncSession,
    obj,
    column: str,
    vault_id_column: str,
    new_value: Optional[str],
    vault_name: str,
) -> None:
    """
    Store/update a direct model column secret in Vault.
    Sets obj.<vault_id_column>, clears obj.<column>.
    Falls back to plaintext if Vault unavailable.
    """
    if not new_value:
        existing_vault_id = getattr(obj, vault_id_column, None)
        if existing_vault_id:
            await vault_delete(session, existing_vault_id)
        setattr(obj, vault_id_column, None)
        setattr(obj, column, None)
        return

    existing_vault_id = getattr(obj, vault_id_column, None)
    if existing_vault_id:
        success = await vault_update(session, existing_vault_id, new_value)
        if not success:
            setattr(obj, column, new_value)
    else:
        new_vault_id = await vault_store(session, vault_name, new_value)
        if new_vault_id:
            setattr(obj, vault_id_column, new_vault_id)
            setattr(obj, column, None)
        else:
            setattr(obj, column, new_value)


async def resolve_column_secret(
    session: AsyncSession,
    obj,
    column: str,
    vault_id_column: str,
) -> Optional[str]:
    """
    Read a model column secret, preferring Vault when a vault_id exists.
    Falls back to the plaintext column.
    """
    vault_id = getattr(obj, vault_id_column, None)
    if vault_id:
        secret = await vault_get(session, vault_id)
        if secret is not None:
            return secret
    return getattr(obj, column, None)


async def get_hotel_ai_key(
    session: AsyncSession,
    integration_settings,
    hotel,
) -> Optional[str]:
    """
    Resolve the effective AI API key for a hotel, checking Vault first.
    Priority: integration_settings vault → integration_settings plaintext
              → hotel vault → hotel plaintext
    """
    if integration_settings:
        key = await resolve_column_secret(
            session, integration_settings, "ai_api_key", "ai_api_key_vault_id"
        )
        if key:
            return key

    if hotel:
        key = await resolve_column_secret(
            session, hotel, "ai_api_key", "ai_api_key_vault_id"
        )
        if key:
            return key

    return None
