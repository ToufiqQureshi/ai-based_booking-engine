"""
Database Configuration
SQLModel + Async SQLAlchemy setup.
Development mein SQLite, Production mein PostgreSQL use karo.
"""
import logging

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.utils.config import get_settings

_migration_logger = logging.getLogger(__name__)

# Bump this integer whenever new inline patches are added below.
# First boot after a bump re-runs the full patch loop; all subsequent boots
# read this version from _staybooker_schema_version and return in < 1 s.
_SCHEMA_PATCH_VERSION = 13


def _is_idempotent_migration_error(err: Exception) -> bool:
    """Return True only for 'already exists' / duplicate-column DB errors."""
    orig = getattr(err, "orig", None)
    # PostgreSQL: duplicate_column=42701, duplicate_table/index=42P07
    if getattr(orig, "pgcode", None) in {"42701", "42P07"}:
        return True
    # SQLite and generic fallback
    msg = str(err).lower()
    return "duplicate column" in msg or "already exists" in msg

settings = get_settings()

is_sqlite = "sqlite" in settings.DATABASE_URL

if is_sqlite:
    connect_args = {"check_same_thread": False}
    engine_args = {"echo": False, "future": True}
else:
    connect_args = {
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0,
        "server_settings": {"jit": "off"}
    }
    engine_args = {
        "echo": False,
        "future": True,
        # DB-03: pool sizing is env-driven (DB_POOL_SIZE/DB_MAX_OVERFLOW) so it
        # can be tuned per Railway plan without a code change. Keep
        # DB_POOL_SIZE * WEB_CONCURRENCY * replicas <= Supabase connection limit.
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_pre_ping": True,
        "pool_recycle": settings.DB_POOL_RECYCLE,
    }

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_args
)


# Session factory - har request ke liye new session
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """
    Database tables create karta hai agar exist nahi karte.
    App startup par call hota hai.
    """
    if not is_sqlite:
        import logging as _logging
        _logging.getLogger(__name__).info(
            "DB pool config: pool_size=%s max_overflow=%s recycle=%ss timeout=%ss "
            "(keep pool_size * WEB_CONCURRENCY * replicas <= Supabase limit)",
            settings.DB_POOL_SIZE, settings.DB_MAX_OVERFLOW,
            settings.DB_POOL_RECYCLE, settings.DB_POOL_TIMEOUT,
        )

    # Fast-path: skip the 40+ ALTER TABLE statements on boots after the first.
    # Creates the version table if missing, then returns early when already up to date.
    if not is_sqlite:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(
                    "CREATE TABLE IF NOT EXISTS _staybooker_schema_version "
                    "(id INTEGER PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0)"
                ))
                row = (await conn.execute(
                    text("SELECT version FROM _staybooker_schema_version LIMIT 1")
                )).fetchone()
                applied = row[0] if row else 0
            if applied >= _SCHEMA_PATCH_VERSION:
                _migration_logger.info(
                    "Schema already at v%s — skipping inline patches (fast startup)",
                    applied,
                )
                return
        except Exception as _ve:
            _migration_logger.warning(
                "Schema version check failed, running all patches: %s", _ve
            )

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Run table migrations for new columns in separate transaction blocks to avoid transaction aborts in PostgreSQL
    for col, col_type in [
        ("feature_new_booking", "BOOLEAN DEFAULT TRUE"),
        ("feature_color_palette", "BOOLEAN DEFAULT TRUE"),
        ("feature_custom_logo", "BOOLEAN DEFAULT TRUE"),
        ("feature_custom_widget", "BOOLEAN DEFAULT TRUE")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE hotels ADD COLUMN {col} {col_type}"))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise
    
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN cancellation_policy TEXT"))
    except DBAPIError as _e:
        if _is_idempotent_migration_error(_e):
            _migration_logger.debug("Migration already applied: %s", _e)
        else:
            raise

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE room_types ADD COLUMN rate_plan_overrides JSON"))
    except DBAPIError as _e:
        if _is_idempotent_migration_error(_e):
            _migration_logger.debug("Migration already applied: %s", _e)
        else:
            raise

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE hotels ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL"))
    except DBAPIError as _e:
        if _is_idempotent_migration_error(_e):
            _migration_logger.debug("Migration already applied: %s", _e)
        else:
            raise

    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE users ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL"))
    except DBAPIError as _e:
        if _is_idempotent_migration_error(_e):
            _migration_logger.debug("Migration already applied: %s", _e)
        else:
            raise

    for col, col_type in [
        ("cancellation_fee", "NUMERIC DEFAULT 0.00"),
        ("refund_amount", "NUMERIC DEFAULT 0.00"),
        ("refund_status", "VARCHAR(50) DEFAULT 'none'")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    for col, col_type in [
        ("subtotal_amount", "NUMERIC DEFAULT 0.00"),
        ("tax_amount", "NUMERIC DEFAULT 0.00"),
        ("discount_amount", "NUMERIC DEFAULT 0.00"),
        ("tax_details", "JSON DEFAULT '{}'")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    for col, col_type in [
        ("transaction_id", "VARCHAR(255)"),
        ("reference_number", "VARCHAR(255)")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE payments ADD COLUMN {col} {col_type}"))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise



    # Chain-wide features migrations
    for table_alter in [
        "ALTER TABLE chains ADD COLUMN primary_color VARCHAR(50) DEFAULT '#4f46e5'",
        "ALTER TABLE chains ADD COLUMN widget_layout VARCHAR(50) DEFAULT 'modern'",
        "ALTER TABLE chains ADD COLUMN widget_bg_color VARCHAR(50) DEFAULT '#FFFFFF'",
        "ALTER TABLE chains ADD COLUMN widget_theme VARCHAR(50) DEFAULT 'light'",
        "ALTER TABLE chains ADD COLUMN widget_show_price BOOLEAN DEFAULT TRUE",
        "ALTER TABLE chains ADD COLUMN widget_show_loyalty BOOLEAN DEFAULT TRUE",
        "ALTER TABLE chains ADD COLUMN widget_show_property_count BOOLEAN DEFAULT TRUE",
        "ALTER TABLE loyalty_programs ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL",
        "ALTER TABLE loyalty_programs ALTER COLUMN hotel_id DROP NOT NULL",
        "ALTER TABLE guest_loyalty ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL",
        "ALTER TABLE guest_loyalty ALTER COLUMN hotel_id DROP NOT NULL",
        "ALTER TABLE guest_loyalty ADD COLUMN points_balance NUMERIC DEFAULT 0.00",
        "ALTER TABLE promo_codes ADD COLUMN chain_id VARCHAR(255) REFERENCES chains(id) ON DELETE SET NULL",
        "ALTER TABLE promo_codes ALTER COLUMN hotel_id DROP NOT NULL",
        # Points wallet config on loyalty_programs (create_all won't add columns
        # to an existing table, so add them explicitly; idempotent via except).
        "ALTER TABLE loyalty_programs ADD COLUMN points_enabled BOOLEAN DEFAULT FALSE",
        "ALTER TABLE loyalty_programs ADD COLUMN points_per_currency NUMERIC DEFAULT 0.00",
        "ALTER TABLE loyalty_programs ADD COLUMN point_value NUMERIC DEFAULT 0.00",
    ]:
        if is_sqlite and "ALTER COLUMN" in table_alter.upper():
            _migration_logger.debug("Skipping PostgreSQL-only migration on SQLite: %s", table_alter)
            continue
        try:
            async with engine.begin() as conn:
                await conn.execute(text(table_alter))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    for col, col_type in [
        ("loyalty_points_earned", "NUMERIC DEFAULT 0.00"),
        ("loyalty_points_redeemed", "NUMERIC DEFAULT 0.00")
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE bookings ADD COLUMN {col} {col_type}"))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    # SystemBroadcast scheduling + targeting columns
    # JSON DEFAULT must be cast for Postgres ('[]'::json), but SQLite tolerates plain '[]'.
    json_default = "'[]'::json" if not is_sqlite else "'[]'"
    for col, col_type in [
        ("scheduled_at", "TIMESTAMP"),
        ("expires_at", "TIMESTAMP"),
        ("is_published", "BOOLEAN DEFAULT TRUE"),
        ("target_plans", f"JSON DEFAULT {json_default}"),
        ("target_hotel_ids", f"JSON DEFAULT {json_default}"),
        ("created_by", "VARCHAR(255)"),
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE system_broadcasts ADD COLUMN {col} {col_type}"))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    # Backfill any NULL values left over from a partial earlier ALTER attempt.
    for sql in [
        "UPDATE system_broadcasts SET is_published = TRUE WHERE is_published IS NULL",
        "UPDATE system_broadcasts SET target_plans = " + json_default + " WHERE target_plans IS NULL",
        "UPDATE system_broadcasts SET target_hotel_ids = " + json_default + " WHERE target_hotel_ids IS NULL",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    # DB-02: columns added after initial table creation — create_all won't add
    # them to existing tables, so we do it explicitly here (idempotent; the
    # except block swallows the "column already exists" error from Postgres).
    for col_sql in [
        "ALTER TABLE hotels ADD COLUMN ai_max_tokens INTEGER",
        "ALTER TABLE hotels ADD COLUMN ai_api_key_vault_id VARCHAR(255)",
        "ALTER TABLE integration_settings ADD COLUMN ai_max_tokens INTEGER",
        "ALTER TABLE integration_settings ADD COLUMN ai_api_key_vault_id VARCHAR(255)",
        "ALTER TABLE integration_settings ADD COLUMN webhook_secret_vault_id VARCHAR(255)",
        "ALTER TABLE chains ADD COLUMN primary_color VARCHAR(50) DEFAULT '#4f46e5'",
        "ALTER TABLE chains ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
        # DB-03: hotel pause fields (added 2026-06-01 — Alembic migration
        # 20260601_1230 exists but deploys use create_all, not alembic upgrade)
        "ALTER TABLE hotels ADD COLUMN is_paused BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE hotels ADD COLUMN pause_reason TEXT",
        "ALTER TABLE hotels ADD COLUMN paused_at TIMESTAMPTZ",
        # DB-04: per-agent AI daily token limits (added 2026-06-11 to the
        # Subscription model). The subscriptions table already existed, so
        # create_all never added these columns — every /agent/usage read and
        # every quota check threw "column ... does not exist" in production.
        # Defaults mirror the model (50k hotelier / 100k guest / 100k whatsapp).
        "ALTER TABLE subscriptions ADD COLUMN ai_hotelier_daily_limit INTEGER NOT NULL DEFAULT 50000",
        "ALTER TABLE subscriptions ADD COLUMN ai_guest_chat_daily_limit INTEGER NOT NULL DEFAULT 100000",
        "ALTER TABLE subscriptions ADD COLUMN ai_whatsapp_daily_limit INTEGER NOT NULL DEFAULT 100000",
        # DB-05: abandoned-booking recovery (added 2026-06-14). bookings table
        # predates the column, so create_all won't add it — every recovery
        # sweep would otherwise fail with "column recovery_sent_at does not exist".
        "ALTER TABLE bookings ADD COLUMN recovery_sent_at TIMESTAMPTZ",
        # DB-06: schema drift fixes (added 2026-06-15). Two features shipped a
        # model change with no matching migration; create_all never adds columns
        # to an existing table, so production threw "column ... does not exist".
        #  * loyalty_programs.milestones — multiple-milestones config (JSON array).
        f"ALTER TABLE loyalty_programs ADD COLUMN milestones JSON DEFAULT {json_default}",
        #  * competitor_rates — Rate Shopper was refactored from a single price to
        #    per-meal-plan base/total rates (EP/CP/MAP/AP) plus a status string.
        "ALTER TABLE competitor_rates ADD COLUMN status VARCHAR(50) DEFAULT 'Available'",
        "ALTER TABLE competitor_rates ADD COLUMN ep_base DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN ep_total DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN cp_base DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN cp_total DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN map_base DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN map_total DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN ap_base DOUBLE PRECISION",
        "ALTER TABLE competitor_rates ADD COLUMN ap_total DOUBLE PRECISION",
        # The legacy NOT NULL columns the refactored model no longer writes — relax
        # them so new scrapes can insert. Kept (not dropped) to preserve old data.
        "ALTER TABLE competitor_rates ALTER COLUMN price DROP NOT NULL",
        "ALTER TABLE competitor_rates ALTER COLUMN currency DROP NOT NULL",
        "ALTER TABLE competitor_rates ALTER COLUMN is_sold_out DROP NOT NULL",
        # DB-07: nudge_from_nights on loyalty_offers (added 2026-06-15).
        # Hotelier-controlled gate: nudge only shows when guest nights >= this value.
        # Default 1 keeps existing offers behaving as before (show to all guests).
        "ALTER TABLE loyalty_offers ADD COLUMN nudge_from_nights INTEGER NOT NULL DEFAULT 1",
        # DB-08: broadcast_id on loyalty_offers (added 2026-06-15).
        # Groups the per-hotel copies created by a chain-wide upsell broadcast so
        # the brand console can list/delete a broadcast as one unit. NULL for
        # ordinary single-hotel offers.
        "ALTER TABLE loyalty_offers ADD COLUMN broadcast_id VARCHAR(255)",
        "CREATE INDEX IF NOT EXISTS idx_loyalty_offers_broadcast ON loyalty_offers (broadcast_id)",
        # DB-09: optional package validity window on rate_plans (added 2026-06-15).
        # Lets a package run only for a season/date range; NULL = always available.
        "ALTER TABLE rate_plans ADD COLUMN valid_from DATE",
        "ALTER TABLE rate_plans ADD COLUMN valid_to DATE",
        # DB-10: seasonal auto-apply promotions on promo_codes (added 2026-06-15).
        # auto_apply=TRUE deals apply server-side within their date window with no
        # code; `name` is the banner label shown to guests.
        "ALTER TABLE promo_codes ADD COLUMN auto_apply BOOLEAN DEFAULT FALSE",
        "ALTER TABLE promo_codes ADD COLUMN name VARCHAR(255)",
        "CREATE INDEX IF NOT EXISTS idx_promo_codes_auto_apply ON promo_codes (auto_apply)",
        # DB-11: hotelier-controlled stay-offer presentation on loyalty_offers
        # (added 2026-06-16). Lets the hotelier choose how an unlocked offer
        # applies and renders on the public room card. Defaults preserve prior
        # behaviour (auto-apply, banner style, generic upsell copy).
        "ALTER TABLE loyalty_offers ADD COLUMN apply_mode VARCHAR(50) NOT NULL DEFAULT 'auto'",
        "ALTER TABLE loyalty_offers ADD COLUMN display_style VARCHAR(50) NOT NULL DEFAULT 'banner'",
        "ALTER TABLE loyalty_offers ADD COLUMN unlocked_message TEXT DEFAULT 'Book this room for {nights} nights to unlock {reward}!'",
        # DB-12: room/property showcase videos (added 2026-06-19). `photos`
        # already existed; `videos` is a new JSON array column that create_all
        # won't add to the existing room_types/hotels tables. Postgres backfills
        # existing rows with the default ([]), so reads stay safe.
        f"ALTER TABLE room_types ADD COLUMN videos JSON DEFAULT {json_default}",
        f"ALTER TABLE hotels ADD COLUMN videos JSON DEFAULT {json_default}",
        # DB-13: city-level visitor geo on analytics_sessions (added 2026-06-22).
        # The table predates these columns; create_all won't add them to an
        # existing table, so every geo-enriched track/start would otherwise fail.
        "ALTER TABLE analytics_sessions ADD COLUMN city VARCHAR(255)",
        "ALTER TABLE analytics_sessions ADD COLUMN region VARCHAR(255)",
    ]:
        if is_sqlite and "ALTER COLUMN" in col_sql.upper():
            _migration_logger.debug("Skipping PostgreSQL-only migration on SQLite: %s", col_sql)
            continue
        try:
            async with engine.begin() as conn:
                await conn.execute(text(col_sql))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    # DB-01: composite performance indexes + unique constraints. These live in
    # Alembic migration 08_performance_indexes.py, but deploys run create_all
    # (not `alembic upgrade`), so create_all only emits single-column indexes
    # and these were missing in production. CREATE INDEX IF NOT EXISTS applies
    # them idempotently on every boot until the deploy switches to Alembic.
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at)",
        "CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings (hotel_id, check_in, check_out)",
        # Availability is the hottest public query (overlap by hotel + status +
        # date range). Adding status to the composite lets Postgres filter on the
        # active statuses inside the index instead of scanning then filtering.
        "CREATE INDEX IF NOT EXISTS idx_bookings_hotel_status_dates ON bookings (hotel_id, status, check_in, check_out)",
        "CREATE INDEX IF NOT EXISTS idx_room_rates_lookup ON room_rates (room_type_id, date_from, date_to)",
        # Enforce DB-level uniqueness on users — the model declares unique=True
        # but create_all won't retroactively add the index to an existing table.
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_supabase_id ON users (supabase_id) WHERE supabase_id IS NOT NULL",
        # Visitor city breakdown groups analytics_sessions by city.
        "CREATE INDEX IF NOT EXISTS idx_analytics_sessions_city ON analytics_sessions (city)",
        # Public report lookups hit report_share_links by token on every view.
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_report_share_links_token ON report_share_links (token)",
        "CREATE INDEX IF NOT EXISTS idx_report_share_links_hotel ON report_share_links (hotel_id)",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(idx_sql))
        except DBAPIError as _e:
            if _is_idempotent_migration_error(_e):
                _migration_logger.debug("Migration already applied: %s", _e)
            else:
                raise

    # Auto-heal: Sync AI fields from hotels table to integration_settings table if missing or not set
    try:
        async with engine.begin() as conn:
            import secrets
            from datetime import datetime
            
            # Select all hotels that have an AI key set
            result = await conn.execute(
                text("SELECT id, ai_provider, ai_api_key, ai_model, ai_base_url, ai_max_tokens FROM hotels WHERE ai_api_key IS NOT NULL")
            )
            hotels_with_keys = result.fetchall()
            for row in hotels_with_keys:
                hotel_id, ai_prov, ai_key, ai_mod, ai_base, ai_max = row
                
                # Check if integration settings exist for this hotel
                sett_res = await conn.execute(
                    text("SELECT id, ai_api_key FROM integration_settings WHERE hotel_id = :h_id"),
                    {"h_id": hotel_id}
                )
                sett_row = sett_res.fetchone()
                
                if not sett_row:
                    # Create new IntegrationSettings row
                    new_id = secrets.token_urlsafe(8)
                    await conn.execute(
                        text(
                            "INSERT INTO integration_settings (id, hotel_id, ai_provider, ai_api_key, ai_model, ai_base_url, ai_max_tokens, created_at, updated_at) "
                            "VALUES (:id, :hotel_id, :ai_provider, :ai_api_key, :ai_model, :ai_base_url, :ai_max_tokens, :now, :now)"
                        ),
                        {
                            "id": new_id,
                            "hotel_id": hotel_id,
                            "ai_provider": ai_prov or "groq",
                            "ai_api_key": ai_key,
                            "ai_model": ai_mod or "llama-3.1-8b-instant",
                            "ai_base_url": ai_base,
                            "ai_max_tokens": ai_max,
                            "now": datetime.utcnow()
                        }
                    )
                else:
                    sett_id, sett_key = sett_row
                    if not sett_key:
                        # Update existing IntegrationSettings with hotel's AI config
                        await conn.execute(
                            text(
                                "UPDATE integration_settings SET "
                                "ai_provider = COALESCE(ai_provider, :ai_provider), "
                                "ai_api_key = :ai_api_key, "
                                "ai_model = COALESCE(ai_model, :ai_model), "
                                "ai_base_url = COALESCE(ai_base_url, :ai_base_url), "
                                "ai_max_tokens = COALESCE(ai_max_tokens, :ai_max_tokens), "
                                "updated_at = :now "
                                "WHERE id = :id"
                            ),
                            {
                                "id": sett_id,
                                "ai_provider": ai_prov or "groq",
                                "ai_api_key": ai_key,
                                "ai_model": ai_mod or "llama-3.1-8b-instant",
                                "ai_base_url": ai_base,
                                "ai_max_tokens": ai_max,
                                "now": datetime.utcnow()
                            }
                        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Database auto-heal for AI integration settings failed: {e}")

    # All inline patches done — persist version so next boot skips this entire block.
    if not is_sqlite:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(
                    "INSERT INTO _staybooker_schema_version (id, version) VALUES (1, :v) "
                    "ON CONFLICT (id) DO UPDATE SET version = :v"
                ), {"v": _SCHEMA_PATCH_VERSION})
            _migration_logger.info("Schema patched to v%s", _SCHEMA_PATCH_VERSION)
        except Exception as _ve:
            _migration_logger.warning("Failed to save schema version: %s", _ve)

    # Vault: enable supabase_vault extension (idempotent, Postgres only)
    if not is_sqlite:
        try:
            async with engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE"))
        except Exception as e:
            import logging
            logging.getLogger(__name__).info(
                "supabase_vault extension not available (ok in local dev): %s", e
            )

    # Vault migration: migrate existing plaintext hotel secrets to Vault (best-effort)
    if not is_sqlite:
        try:
            await _migrate_secrets_to_vault()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Vault secret migration skipped: %s", e)


async def _migrate_secrets_to_vault() -> None:
    """
    One-time best-effort migration: for each hotel that still has plaintext
    secrets in hotel.settings or ai_api_key column, move them to Vault.
    Safe to run repeatedly — skips hotels that already have vault_ids.
    """
    import logging
    import json
    _log = logging.getLogger(__name__)

    async with async_session() as session:
        # Check if Vault is available before doing anything
        try:
            await session.execute(text("SELECT 1 FROM vault.secrets LIMIT 1"))
        except Exception:
            _log.info("Vault not available — skipping secret migration")
            return

        # Fetch hotels with at least one plaintext secret that lacks a vault_id
        result = await session.execute(text("""
            SELECT id, settings, ai_api_key, ai_api_key_vault_id
            FROM hotels
            WHERE is_active = TRUE
              AND (
                (settings->>'razorpay_key_secret' IS NOT NULL AND settings->>'razorpay_key_secret_vault_id' IS NULL)
                OR (settings->>'whatsapp_api_key' IS NOT NULL AND settings->>'whatsapp_api_key_vault_id' IS NULL)
                OR (settings->>'smtp_password' IS NOT NULL AND settings->>'smtp_password_vault_id' IS NULL)
                OR (ai_api_key IS NOT NULL AND ai_api_key_vault_id IS NULL)
              )
        """))
        rows = result.fetchall()
        if not rows:
            return

        _log.info("Vault migration: migrating secrets for %d hotel(s)", len(rows))
        migrated = 0

        for row in rows:
            hotel_id, raw_settings, ai_api_key, ai_api_key_vault_id = row
            try:
                settings = raw_settings if isinstance(raw_settings, dict) else (json.loads(raw_settings) if raw_settings else {})
                settings_changed = False

                _SECRETS_TO_MIGRATE = {
                    "razorpay_key_secret": "razorpay_key_secret_vault_id",
                    "whatsapp_api_key": "whatsapp_api_key_vault_id",
                    "smtp_password": "smtp_password_vault_id",
                }
                for plaintext_key, vault_id_key in _SECRETS_TO_MIGRATE.items():
                    plaintext = settings.get(plaintext_key)
                    if plaintext and not settings.get(vault_id_key):
                        vault_res = await session.execute(
                            text("SELECT vault.create_secret(:secret, :name, :desc)"),
                            {"secret": plaintext, "name": f"hotel_{hotel_id}_{plaintext_key}",
                             "desc": f"Migrated from hotel.settings: {plaintext_key}"},
                        )
                        vault_id = str(vault_res.scalar())
                        settings[vault_id_key] = vault_id
                        settings[plaintext_key] = None
                        settings_changed = True

                if settings_changed:
                    await session.execute(
                        text("UPDATE hotels SET settings = :s WHERE id = :id"),
                        {"s": json.dumps(settings), "id": hotel_id},
                    )

                # Migrate ai_api_key column
                if ai_api_key and not ai_api_key_vault_id:
                    vault_res = await session.execute(
                        text("SELECT vault.create_secret(:secret, :name, :desc)"),
                        {"secret": ai_api_key, "name": f"hotel_{hotel_id}_ai_api_key",
                         "desc": f"Migrated from hotels.ai_api_key"},
                    )
                    new_vault_id = str(vault_res.scalar())
                    await session.execute(
                        text("UPDATE hotels SET ai_api_key = NULL, ai_api_key_vault_id = :vid WHERE id = :id"),
                        {"vid": new_vault_id, "id": hotel_id},
                    )

                migrated += 1
            except Exception as e:
                _log.warning("Vault migration failed for hotel %s: %s", hotel_id, e)
                continue

        # Migrate integration_settings.ai_api_key
        int_result = await session.execute(text("""
            SELECT id, hotel_id, ai_api_key
            FROM integration_settings
            WHERE ai_api_key IS NOT NULL AND ai_api_key_vault_id IS NULL
        """))
        int_rows = int_result.fetchall()
        for int_row in int_rows:
            int_id, int_hotel_id, int_ai_key = int_row
            try:
                vault_res = await session.execute(
                    text("SELECT vault.create_secret(:secret, :name, :desc)"),
                    {"secret": int_ai_key, "name": f"hotel_{int_hotel_id}_int_ai_api_key",
                     "desc": "Migrated from integration_settings.ai_api_key"},
                )
                new_vault_id = str(vault_res.scalar())
                await session.execute(
                    text("UPDATE integration_settings SET ai_api_key = NULL, ai_api_key_vault_id = :vid WHERE id = :id"),
                    {"vid": new_vault_id, "id": int_id},
                )
            except Exception as e:
                _log.warning("Vault migration failed for integration_settings %s: %s", int_id, e)
                continue

        await session.commit()
        _log.info("Vault migration complete: %d hotel(s) migrated", migrated)


async def get_session() -> AsyncSession:
    """
    Dependency injection ke liye session provide karta hai.
    FastAPI routes mein use hota hai.
    """
    async with async_session() as session:
        yield session
