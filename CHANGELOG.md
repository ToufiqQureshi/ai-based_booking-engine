# Changelog

All modifications made during the dead code & bug audit fix pass (2026-06-25).

---

## [Audit Fix Pass] — 2026-06-25

### HIGH Priority Fixes

**H-1 — Deleted `backend/app/models/` (duplicate SQLModel class landmine)**
- Files deleted: `rates.py`, `loyalty.py`, `channel_manager.py`, `social_proof.py`, `platform.py`, `kyc.py`
- Reason: 6 files defining `table=True` SQLModel classes that already existed in the canonical modules. If ever imported, these would crash SQLAlchemy with `InvalidRequestError: Table 'xyz' is already defined`. Zero active code imported from here.

**H-2 — Fixed `backend/app/rate_plans/rates_model.py` broken `TYPE_CHECKING` imports**
- Changed `from app.models.hotel` → `from app.brand_console.hotel` and `from app.models.room` → `from app.rooms.room`
- Reason: The `app/models/` directory was deleted; these imports pointed to non-existent paths.

**H-3 — Fixed N+1 hotel scan in `backend/app/integration/whatsapp.py`**
- Replaced Python-side loop over all hotels to match `phone_number_id` with a SQL-level `jsonb_extract_path_text()` filter.
- Reason: Every WhatsApp message was loading all active hotels into memory before finding the right one.

**H-4 — Fixed 10 silent `except Exception: pass` blocks in `backend/app/guest_booking/hotels.py`**
- Redis cache read failures now log at DEBUG; write failures log at WARNING with the cache key.
- Reason: Silent failures hid Redis failures and made monitoring impossible.

**H-5 — Fixed 4 silent `except Exception: pass` blocks in `backend/app/guest_booking/rooms.py`**
- Calendar and addons cache GET/SET failures now logged at DEBUG/WARNING respectively.

**H-6 — Fixed broken navigation in `frontend/src/rooms/components/RoomDialog.tsx`**
- `navigate('/amenities')` → `navigate('/addons')` (line 740)
- Reason: `/amenities` route doesn't exist; was a dead link that silently navigated to a 404.

**H-7 — Deleted 5 orphan frontend files**
- `frontend/src/finance/Reports.tsx` — superseded by `reports/HotelReport.tsx`, zero imports
- `frontend/src/analytics/AnalyticsTab.tsx` — zero imports anywhere
- `frontend/src/auth/Onboarding.tsx` — no route in App.tsx
- `frontend/src/dashboard/Amenities.tsx` — functionality moved to `marketing/Addons.tsx`
- `frontend/src/guest_booking/components/public/PriceComparisonWidget.tsx` — zero imports

**H-8 — Fixed `backend/app/marketing/google_ads.py` silent false success**
- `trigger_google_push` was returning 200 OK for unimplemented GHA push sync.
- Fixed to raise `HTTP 501 Not Implemented`.
- Added `logger.warning(...)` on `get_ari_feed` stub so it's visible in prod logs.

### MEDIUM Priority Fixes

**M-1 — Fixed `backend/app/rate_plans/rates_model.py` `TYPE_CHECKING` import paths** *(same as H-2)*

**M-2 — Removed duplicate router registration in `backend/main.py`**
- Removed `from app.analytics import reports` import and `app.include_router(reports.router, ...)` that double-mounted the same router object at `/api/v1/reports/`.
- Reason: The `reports.router` object was the same Python object as `analytics_router` — mounting it twice at different prefixes caused all report endpoints to exist at two paths.

**M-3 — Added multi-worker warning in `backend/app/system/ws.py`**
- On startup, if `WEB_CONCURRENCY > 1`, logs a warning that the in-process WebSocket registry won't broadcast to clients on other workers.
- Reason: Silent production gap — staff on worker 2 would miss events broadcast from worker 1.

**M-4 — Added WhatsApp message idempotency guard in `backend/app/integration/whatsapp.py`**
- Uses `wamid` (Meta's message ID) as a Redis dedup key with 24h TTL.
- Reason: Meta retries webhook delivery on non-200. Without this, a retry ran the AI agent twice and double-decremented WhatsApp credits.

**M-5 — Fixed silent exception swallow on `ACTION:BOOKING_LINK` parse failure in `backend/app/integration/whatsapp.py`**
- Changed bare `except Exception: pass` to `logger.warning(...)` with hotel/phone context.

**M-6 — Added missing fields to `LoyaltyProgram` interface in `frontend/src/marketing/LoyaltyProgram.tsx`**
- Added `points_enabled`, `points_per_currency`, `point_value` to the TypeScript interface.
- Removed `as any` type casts that masked type errors.

**M-7 — Updated `backend/app/core/utils/scheduler.py` docstring**
- Removed never-implemented `rate_shopper_auto_scrape` from the Jobs list.
- Added `orphan_media` (IS implemented) and a "Not yet implemented" section.

**M-8 — Fixed broken import in `backend/scripts/rate_shopper_matrix.py`**
- `from app.models.competitor` → `from app.rate_shopper.competitor`
- Reason: `app/models/` deleted; import pointed to non-existent path.

**M-9 — Fixed `backend/app/core/db/database.py` silent migration failures (M-10 in audit)**
- Added `logger.debug(...)` to all 14 bare `except Exception: pass` blocks guarding `ALTER TABLE ... ADD COLUMN` migration stubs.
- Reason: A real DB boot failure (e.g., DB unreachable at startup) was being silently swallowed, making the app appear to start normally while all DB operations would fail.

**M-10 — Fixed `backend/app/ai_assistant/agent.py` redundant module-level import (M-12 in audit)**
- Removed module-level `from app.ai_engine.agent import create_agent_executor`.
- The lazy import inside the handler (line 142) is preserved and is the correct pattern.
- Reason: The module-level import loaded pandas + matplotlib (~150MB RSS) at worker boot even when the agent endpoint was never called, defeating the lazy-import optimization.

### LOW Priority Fixes

**L-1 — Deleted `backend/check_db.py`**
- Dev scratch file with hardcoded PII/credentials. Not imported anywhere.

**L-2 — Deleted `backend/test_reply.py`**
- Dev scratch file with hardcoded email addresses. Not imported anywhere.

**L-3 — Deleted `backend/generate_tests.py`**
- One-shot test generator that had already served its purpose. Not imported anywhere.

**L-4 — Deleted 3 one-shot refactoring scripts from `backend/scripts/`**
- `fix_imports.py`, `fix_overwritten_models.py`, `refactor_tests.py`
- Reason: All were already-completed one-shot utilities with no ongoing purpose.

**L-5 — Deleted 2 unused re-export shim files**
- `backend/app/bookings/models.py` and `backend/app/rate_plans/models.py`
- Both were `from <canonical_module> import *` shims with zero importers in the codebase.

**L-6 — Deleted `backend/app/analytics/tracking.py` dead router**
- Router was never mounted in `main.py`. All tracking endpoints already exist in `analytics.py`.

**L-7 — Removed stale `least_booked_rooms` from `AnalyticsData` interface**
- `frontend/src/analytics/AnalyticsDashboard.tsx`
- Field was declared in the TypeScript interface but the backend does not return it in the dashboard endpoint (it's only in the public share report).

**L-8 — Removed unused icon imports**
- `Dashboard.tsx`: Removed `ExternalLink`, `MoreHorizontal`, `Sparkles` from lucide-react import
- `Bookings.tsx`: Removed `Filter` from lucide-react import
- `Rooms.tsx`: Removed `Package` from lucide-react import

**L-9 — Fixed silent Redis failures in `backend/app/revenue/rate_signals.py`**
- `bump_rate_version` and `bump_hotel_version` both had bare `except Exception: pass`.
- Changed to `logger.warning(...)` with hotel_id context explaining the SSE impact.

**L-10 — Added explanatory comment to Sentry `except Exception: pass` in `backend/app/core/auth/deps.py`**
- The bare `pass` on Sentry SDK failure was intentional (never block auth) but undocumented.
- Added `# Sentry context is best-effort; never block auth on SDK failure`.

### FALSE POSITIVES (not fixed)

**M-11 — `rooms_booked`, `channel_mix`, `city_stats` in `analytics.py`**
- Audit incorrectly flagged these as "never used by frontend".
- They ARE used in `frontend/src/reports/ReportView.tsx` and `PublicReport.test.tsx` (the public share report feature). Not removed.
