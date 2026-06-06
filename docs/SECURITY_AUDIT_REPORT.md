# Staybooker — End-to-End Project Audit Report

**Date:** 2026-06-05
**Scope:** Backend (FastAPI), Frontend (React/Vite), Chrome extension, Infra (Railway + Supabase Postgres + Redis), AI/LLM features.
**Method:** Static code review of the full repository (auth/core read first-hand; six parallel deep-dive reviews across multi-tenancy, RBAC/superadmin, AI cost, injection/payments/public API, infra/DB-scale, dead-code). Findings below are code-verified with `file:line` references — speculative items are marked as such.

> This is an **analysis report only**. No application code was modified. Every fix is a recommendation.

---

## 1. Executive Summary

The codebase is, overall, **better-engineered than typical** for a product at this stage: tenant scoping is the consistent norm, payment **webhook** signatures (Razorpay + WhatsApp/Meta) are correctly HMAC-verified, SQL is parameterized throughout (no injection found), caching is tenant-keyed, security headers are OWASP-complete, and there is almost no dead code or unused dependency.

However, the audit found **one Critical** issue (a per-hotel payment **secret key leaked to anonymous users**) and a cluster of **High** issues that fall into three themes:

1. **Authorization controls that are *defined but not enforced*** — granular super-admin sub-roles, intra-tenant role tiers (STAFF/MANAGER), and subscription feature-gating all exist in code but are wired into almost nothing. The UI hides things the API still allows.
2. **Cost/abuse exposure on anonymous surfaces** — the public AI chat (70B model) and SSE streams have no per-tenant budget and a rate-limiter that is trivially bypassed via a spoofed `X-Forwarded-For` header.
3. **Deploy/DB drift** — Alembic migrations are never run in production (schema is built by `create_all` + fragile runtime `ALTER`s), so the intended composite performance indexes don't exist, and one unbounded list endpoint plus a broken background-task helper create real crash/functional bugs.

### Severity tally

| Severity | Count |
|---|---|
| 🔴 Critical | 1 |
| 🟠 High | 12 |
| 🟡 Medium | 14 |
| 🟢 Low | 9 |

### Top issues to fix first (P0 / P1)

| ID | Issue | Severity |
|---|---|---|
| SEC-01 | Per-hotel **Razorpay secret key** returned by anonymous `GET /public/hotels/slug/{slug}` | 🔴 Critical |
| SEC-02 | `POST /hotels/{id}/test-email-connection` is **unauthenticated** — open mail relay / SMTP-cred probe / SSRF | 🟠 High |
| PAY-01 | `POST /public/razorpay/create-order` trusts **client `amount`** → guest pays ₹1, booking marked fully paid | 🟠 High |
| AZ-01 | Super-admin **sub-role permissions not enforced** on payouts/revenue/commissions/PII-exports (dead control) | 🟠 High |
| AZ-02 | **No intra-tenant role tiers** — any STAFF user has full hotel-admin via direct API | 🟠 High |
| AUTH-01 | Auth payload cached 10 min keyed on raw token → **expired token still valid ≤10 min** | 🟠 High |
| AUTH-02 | Impersonation JWT has **no `exp`** + verifier doesn't require expiry → permanent owner token | 🟠 High |
| AI-01 | Public AI chat: IP-only limit (XFF-spoofable) + **no per-hotel token budget** → unbounded LLM cost | 🟠 High |
| AI-02 | Guest/global agents have **no `tool_call_limit`** → unbounded tool-loop spend on anonymous endpoint | 🟠 High |
| DB-01 | **Alembic migrations never run** in deploy → composite perf indexes missing in prod | 🟠 High |
| DB-02 | `GET /guests` returns **unbounded** result set → OOM/timeout at scale | 🟠 High |
| BUG-01 | `safe_background` passes a **called coroutine** to `add_task` → post-payment emails/sync silently fail | 🟠 High |

---

## 2. Findings by Category

Each finding: **Description · Severity · Impact · Recommended Fix · Priority**. Priority is P0 (now), P1 (this sprint), P2 (next), P3 (backlog).

---

### A. Authentication

#### AUTH-01 — Expired token accepted for up to 10 minutes (Redis auth cache)
- **Description:** `get_current_user` caches the *decoded JWT payload* in Redis for 600s keyed on the raw token (`backend/app/api/deps.py:39-57`). On a cache hit it returns the cached payload and **skips `verify_supabase_token` entirely**, which is the only place signature **and `exp`** are checked. A token that expires within the 10-minute window keeps authenticating.
- **Severity:** 🟠 High
- **Impact:** Token lifetime is effectively extended by up to 10 min beyond its real `exp`. (Note: super-admin *revocation* still works — it's checked separately per-request in `get_current_active_user`. Only natural expiry is bypassed.)
- **Fix:** Cache by a hash of the token and set the Redis TTL to `min(600, token_exp - now)`; or cache only the DB-user lookup, not the token validity, and always re-check `exp` cheaply.
- **Priority:** P1

#### AUTH-02 — Impersonation token never expires
- **Description:** Super-admin "impersonate hotel" mints a hand-crafted JWT with **no `exp` claim** (`backend/app/api/v1/superadmin/hotels.py:370-377`), and the verifier decodes HS256 without `require=["exp"]`/`verify_exp` (`backend/app/core/supabase.py:68-73`). The token impersonates the hotel OWNER and is audit-logged, but it is a **permanent** owner-level credential if leaked.
- **Severity:** 🟠 High
- **Impact:** A captured impersonation token grants indefinite owner access to a tenant.
- **Fix:** Add a short `exp` (15–30 min) and an `"impersonation": true` marker to the payload; enforce `require=["exp","iat"]` in the verifier; gate the impersonate endpoint behind a dedicated permission.
- **Priority:** P1

#### AUTH-03 — DEBUG fallback returns *unverified* JWT claims
- **Description:** When `settings.DEBUG` is true, `verify_supabase_token` returns `jwt.get_unverified_claims(token)` (`backend/app/core/supabase.py:78-81`) — signature verification fully bypassed. (Also note: `get_unverified_claims` is a *python-jose* API; under PyJWT this line would raise, but the intent/branch is dangerous either way.)
- **Severity:** 🟡 Medium (🔴 Critical **if** `DEBUG=true` ever reaches production — any forged token, including `role=SUPER_ADMIN`, is accepted)
- **Impact:** Complete auth bypass if DEBUG is enabled in prod.
- **Fix:** Delete the DEBUG-unverified branch entirely. Never trust unverified claims, even in dev.
- **Priority:** P1

#### AUTH-04 — HS256 fallback signs/verifies with `SECRET_KEY`
- **Description:** `verify_supabase_token` falls back to HS256 verification against `SUPABASE_JWT_SECRET` **and** the app's own `SECRET_KEY` (`backend/app/core/supabase.py:64-76`). `SECRET_KEY` is also used to sign internal access/refresh/reset tokens (`backend/app/core/security.py`). Mixing the app secret into the Supabase-token verification path widens the trust surface.
- **Severity:** 🟡 Medium
- **Impact:** If `SECRET_KEY` is weak or leaks, attacker-forged HS256 tokens authenticate as any user.
- **Fix:** Verify Supabase tokens **only** against the Supabase keys (JWKS/ES256 or `SUPABASE_JWT_SECRET`). Keep `SECRET_KEY` strictly for internally-minted tokens. Ensure `SECRET_KEY` is high-entropy and env-provided (it is required in config — good).
- **Priority:** P2

#### AUTH-05 — Open auto-registration: any valid Supabase token becomes a hotel OWNER
- **Description:** On first login, `get_current_user` auto-creates a `User` (role `OWNER`) + a new `Hotel` for any Supabase identity not yet in the app DB (`backend/app/api/deps.py:122-176`). This is by design, but it means tenant creation is governed entirely by Supabase's signup policy.
- **Severity:** 🟢 Low (design note)
- **Impact:** If Supabase signups are open, anyone can self-provision a tenant (resource/cost growth, spam tenants).
- **Fix:** Confirm Supabase email-confirmation + signup restrictions are on; consider an invite/approval gate before tenant creation.
- **Priority:** P3

---

### B. Authorization / RBAC

#### AZ-01 — Super-admin granular sub-roles are a dead control
- **Description:** `get_effective_permissions` / `require_permission` and the tier matrix (`finance`/`support`/`ops`/`viewer`) exist (`backend/app/api/v1/superadmin/hotels.py:48-100`, `backend/app/models/platform.py:114-167`) but `require_permission` is wired into only **3** endpoints (delete hotel, delete ticket, delete user). Every financially-sensitive endpoint — **all of payouts, revenue, commissions, PII exports, invoices, KYC-approve, broadcasts, platform api-keys** — checks only the base `get_super_admin` (role==SUPER_ADMIN).
- **Severity:** 🟠 High
- **Impact:** A `support`- or `viewer`-tier employee (whose tier explicitly excludes finance) can call `POST /superadmin/payouts/generate`, `mark-paid`, read revenue, and export guest PII directly. Least-privilege is illusory; the tab-hiding (`TAB_PERMISSIONS`) is cosmetic.
- **Fix:** Replace `Depends(get_super_admin)` with `Depends(require_permission("superadmin.payouts.execute"))` etc. on each write/financial route. Treat `get_super_admin` as the floor and layer `require_permission` on top.
- **Priority:** P1

#### AZ-02 — No intra-tenant role tiers (STAFF == OWNER via API)
- **Description:** `UserRole` = OWNER/MANAGER/STAFF/SUPER_ADMIN (`backend/app/models/user.py:17-22`). Only `users.py` enforces tiers (who can create whom). **Every other tenant router** (rooms, bookings, rates, availability, payments, settings, integrations, channel-manager, …) gates solely on `CurrentUser` + `hotel_id`, with **zero** OWNER/MANAGER/STAFF checks. The per-role sidebar in the frontend (`AppSidebar.tsx`) is the only "enforcement."
- **Severity:** 🟠 High
- **Impact:** Any authenticated hotel user — including STAFF — can create/delete rooms, change rates, edit settings, and touch payments by calling the API directly. Privilege escalation within a tenant.
- **Fix:** Add a backend `require_hotel_role(min_tier)` dependency and apply it to mutating endpoints per the intended permission map. Don't rely on client-side menu filtering.
- **Priority:** P1

#### AZ-03 — Subscription feature-gating (`require_feature`) is defined but never used
- **Description:** `backend/app/core/feature_flags.py` provides `require_feature` / `require_any_feature` / `require_not_paused` (well-designed, fail-closed). Grep across `app/api/` shows **0 usages**. Premium features (AI agent, rate-shopper, guest bot, Google Ads) are not gated server-side despite per-plan boolean flags on the Hotel model.
- **Severity:** 🟠 High (revenue/business-logic)
- **Impact:** Any hotel can hit premium endpoints regardless of plan → revenue leakage; AI cost incurred for hotels not paying for it.
- **Fix:** Apply `require_feature("feature_ai_agent")` to the agent/chat routers, `feature_rate_shopper` to competitors, etc. (`require_not_paused` to the public booking flow).
- **Priority:** P1

#### AZ-04 — Panel/tab access control is client-side only
- **Description:** Whether the super-admin app renders is decided by **hostname** (`isSuperAdminSubdomain()`), and the role check + tab visibility live in `SuperAdminDashboard.tsx` (client). Real protection is the backend `get_super_admin`. This is acceptable *only because* every superadmin endpoint is gated (verified) — but combined with AZ-01 (unenforced per-tab permissions) the tab-hiding is bypassable by direct API/URL.
- **Severity:** 🟡 Medium
- **Impact:** Limited employees can reach data the UI hides.
- **Fix:** Enforce per-tab permissions server-side (see AZ-01); keep client checks as UX only.
- **Priority:** P2

> ✅ **Verified good:** *Every* endpoint under `backend/app/api/v1/superadmin/*` requires `get_super_admin` (no missing gate). The legacy `admin.py` is gated by `check_admin_access`. Impersonation is audit-logged. `users.py` correctly prevents a MANAGER from creating an OWNER.

---

### C. Multi-Tenancy / Data Isolation

> ✅ **The dominant pattern is correct.** Property switching is gated (`POST /properties/switch/{hotel_id}` validates a `UserHotelLink` exists before changing `user.hotel_id` — `backend/app/api/v1/properties.py:121-143`), and bookings/rooms/rates/addons/amenities/promos/leads/dashboard/reports/analytics/notifications/chain-dashboard all filter by `current_user.hotel_id`. Caching is tenant-keyed and **refuses to cache** when it can't identify the tenant (`backend/app/core/cache.py:31-47`). Browser caching is disabled on `/api/v1` to prevent stale cross-tenant data on switch. The exceptions below are the gaps.

#### TEN-01 — `POST /hotels/{id}/test-email-connection` is unauthenticated (see SEC-02)
Cross-referenced in §E.

#### TEN-02 — `create_booking` trusts foreign `room_type_id` / `rate_plan_id`
- **Description:** `backend/app/api/v1/bookings.py:140-164` loads `RoomType`/`RatePlan` by id **without** a `hotel_id` filter (`select(RoomType).where(RoomType.id == rt_id).with_for_update()`; `session.get(RatePlan, rp_id)`).
- **Severity:** 🟡 Medium
- **Impact:** A caller can reference another hotel's room type/rate plan: (a) cross-tenant config disclosure (cancellation policy, refundability, overrides get frozen into the booking/response), (b) corrupt bookings, (c) a `FOR UPDATE` lock on another tenant's inventory row. The booking row itself is stamped with the caller's `hotel_id`, so no cross-tenant *write*.
- **Fix:** Add `RoomType.hotel_id == current_user.hotel_id` and `RatePlan.hotel_id == current_user.hotel_id`; 404 if not owned.
- **Priority:** P1

#### TEN-03 — `POST /competitors/check_freshness` unauthenticated cross-tenant oracle
- **Description:** `backend/app/api/v1/competitors.py:492-553` has no `CurrentUser` and no `hotel_id` scoping; the caller supplies arbitrary `competitor_id`s and learns whether fresh rate data exists for any tenant's competitor. (Sibling `/rates/ingest` correctly authenticates and validates ownership.)
- **Severity:** 🟡 Medium
- **Impact:** Anonymous oracle over another hotel's rate-shopping activity.
- **Fix:** Add `CurrentUser`; constrain `comp_ids` to competitors owned by the caller's hotel.
- **Priority:** P2

#### TEN-04 — Google OAuth callback trusts unsigned `state` as `hotel_id`
- **Description:** `backend/app/api/v1/integration/google.py:65-97` writes the returned Google tokens onto `IntegrationSettings(hotel_id=state)` where `state` is an opaque, unsigned, unauthenticated value.
- **Severity:** 🟡 Medium
- **Impact:** An attacker who completes Google OAuth and replays the callback with `state=<victim_hotel_id>` writes *their* Google tokens onto the victim's integration (review-management takeover). Requires a valid Google `code`, raising the bar.
- **Fix:** Sign/HMAC the `state` or store a server-side nonce→hotel_id map at connect time and verify on callback.
- **Priority:** P2

#### TEN-05 — Calendar/inventory writes don't verify `room_type` ownership
- **Description:** `availability.py` `create_block` (188-203), `update_daily_rates` (245-330), `update_weekends` (486-534) accept a `room_type_id` and persist rows stamped with the caller's own `hotel_id` without checking the room type belongs to them. (`copy_calendar` *does* check — apply that pattern.)
- **Severity:** 🟢 Low (integrity only; no cross-tenant leak/write)
- **Impact:** Dangling references to a foreign `room_type_id` within your own hotel.
- **Fix:** Load the `RoomType` and assert ownership before writing.
- **Priority:** P3

---

### D. Injection

#### INJ-01 — No SQL/NoSQL injection found ✅
- **Description:** All `text()` raw-SQL usages were reviewed and are either static or use bound parameters: `deps.py:128` (`:sub_id`), `database.py:165-202` (bound `:h_id`), superadmin `hotels.py:308-319` (`{table}` from a hardcoded list, `hotel_id` bound). The `ALTER TABLE f"...{col} {col_type}"` strings in `database.py` interpolate **only hardcoded literals**, never user input. No `eval`/`exec` on user input. Frontend has no `eval`; `dangerouslySetInnerHTML` appears only in the shadcn chart component (generated CSS, safe).
- **Severity:** 🟢 Low (informational)
- **Fix:** None required. As hygiene, avoid f-string DDL even with constants; prefer Alembic (ties to DB-01).

---

### E. Payments & Public/Unauthenticated API

#### SEC-01 — 🔴 Per-hotel Razorpay **secret key** leaked to anonymous users
- **Description:** Hotels can store their own Razorpay keys in `hotel.settings` (`razorpay_key_id`, `razorpay_key_secret` — read at `backend/app/api/v1/public/payments.py:189-190`). The anonymous endpoint `GET /api/v1/public/hotels/slug/{slug}` returns `mask_hotel_for_hotelier(hotel)` (`backend/app/api/v1/public/hotels.py:130-170`), and the masker only strips keys in `HOTEL_SETTINGS_SENSITIVE_KEYS` (`backend/app/core/sensitive_fields.py:37-49`) — which **does not include `razorpay_key_secret`/`razorpay_key_id`**. Non-denylisted settings keys pass straight through (`masked[k] = v`). The response is even cached in Redis for 300s.
- **Severity:** 🔴 **Critical**
- **Impact:** Any internet user hitting a hotel's public booking page URL obtains that hotel's **payment-gateway secret** → issue refunds, read transactions, full gateway compromise — for every hotel using per-hotel Razorpay keys.
- **Fix (immediate):** Add `razorpay_key_secret`, `razorpay_key_id` (and any other secret stored in `settings`) to the denylist. **Better:** convert `_mask_settings_for_hotelier` to an **allowlist** that returns only known-safe keys. Then **rotate** any per-hotel Razorpay keys that were live, and purge the `public:hotel-details:*` cache.
- **Priority:** **P0**

#### SEC-02 — `POST /hotels/{id}/test-email-connection` is unauthenticated
- **Description:** `backend/app/api/v1/hotels.py:154-189` has **no `CurrentUser`** dependency. The caller supplies arbitrary SMTP `settings` + `test_email`, and the server dispatches an email through them. The `hotel_id` path param is unused.
- **Severity:** 🟠 High
- **Impact:** Open email relay (spam/phishing from your infra), SMTP-credential probing, and outbound-connection/SSRF primitive — usable by anyone.
- **Fix:** Require `CurrentUser`, enforce `hotel_id == current_user.hotel_id` (or drop the param), and rate-limit.
- **Priority:** P0/P1

#### PAY-01 — `create-order` trusts client `amount` → underpaid bookings marked fully paid
- **Description:** `POST /public/razorpay/create-order` builds the Razorpay order from the **client-supplied** `data.amount` (`backend/app/api/v1/public/payments.py:152,206`) rather than `booking.total_amount`. `/verify` and the webhook then set `paid_amount = booking.total_amount` and flip status to CONFIRMED on a valid signature regardless of the amount actually charged.
- **Severity:** 🟠 High
- **Impact:** A guest can create an order for ₹1, pay it, and the booking is recorded as **paid in full** — direct revenue loss / payment fraud.
- **Fix:** Set `amount_in_paise = int(booking.total_amount * 100)` from the DB; ignore client amount (or 400 on mismatch).
- **Priority:** P1

#### PAY-02 — Webhook & amount integrity (mostly secure) ✅
- **Description:** Razorpay webhook verifies `X-Razorpay-Signature` via HMAC-SHA256 + `hmac.compare_digest` using `RAZORPAY_WEBHOOK_SECRET` (`public/payments.py:384-443`). Public booking creation **recalculates price server-side** and rejects mismatches >5.0, re-validates promos server-side (`public/bookings.py:197-357`). Idempotency via Redis `set_nx_ex` locks + `status != CONFIRMED` guards. Refunds are ownership-checked.
- **Severity:** 🟢 Low (informational — keep it this way)
- **Note:** The Redis idempotency lock degrades to per-process when Redis is unavailable (`redis_client.py` in-memory fallback) → theoretical double-charge if Redis is down. Ensure Redis is HA.

#### PUB-01 — Booking-number enumeration + PII via unthrottled cancel endpoints
- **Description:** `public/bookings.py:693,744` look up bookings by predictable `booking_number` (`BK{YYYYMMDD}{6 hex}`) with **no rate limit**; differing responses (404/403/"already cancelled") allow enumerating valid booking numbers. `cancel-request` returns guest name/dates/amounts (gated by an email check).
- **Severity:** 🟡 Medium
- **Impact:** Booking enumeration; limited PII exposure.
- **Fix:** Add `@limiter.limit`, return uniform responses, and consider an unguessable cancel token in the confirmation email.
- **Priority:** P2

#### PUB-02 — File upload: client content-type trusted, no magic-byte check, public bucket
- **Description:** `backend/app/api/v1/upload.py` requires auth and enforces an extension allowlist + 5MB cap + UUID filename (good), but never validates file **bytes** (PIL imported, unused) and passes the **client** `content-type` straight to a **public** Supabase bucket. The whole file is `read()` into memory before the size check.
- **Severity:** 🟡 Medium / 🟢 Low
- **Impact:** Polyglot/`text/html` content served inline from a public bucket (limited stored-XSS; SVG is blocked — good); memory DoS from large multipart bodies.
- **Fix:** Derive content-type from validated magic bytes, force a safe `Content-Disposition`, and enforce a body-size limit at the proxy/ASGI layer.
- **Priority:** P2/P3

#### PUB-03 — `widget-config` exposes `widget_custom_js`/`css` unauthenticated
- **Description:** `public/hotels.py:211` returns the hotel's configured custom JS/CSS without an auth/domain check.
- **Severity:** 🟢 Low
- **Fix:** Restrict to the configured `allowed_domains`/origin.
- **Priority:** P3

> ✅ **WhatsApp webhook secure:** POST verifies `X-Hub-Signature-256` (HMAC + constant-time) before any work; GET verify-token is constant-time compared (`integration/whatsapp.py:25-84`). No payment mass-assignment (status/amount forced server-side). No role mass-assignment in signup/profile (`auth.py`, `users.py:132-150`). Note: the local `change_password` path (`users.py:157-179`) is effectively **dead** for Supabase users whose `hashed_password` is the literal `"SUPABASE_AUTH"`.

---

### F. AI / LLM Cost & Tokens

#### AI-01 — Public AI chat: spoofable IP limit + no per-hotel token budget
- **Description:** `public/chat.py` guest chat/stream are limited `5/minute` keyed on the **first `X-Forwarded-For` hop** (`limiter.py:11-13`), and the server runs with `--forwarded-allow-ips='*'` (`backend/Dockerfile:30`) so the header is fully client-controlled. There is **no per-hotel quota/budget** on the public REST/SSE chat path (the WhatsApp path *does* check `whatsapp_credits`).
- **Severity:** 🟠 High
- **Impact:** An anonymous attacker rotating `X-Forwarded-For` (or IPs) burns a hotel's Groq/OpenAI spend on a **70B** model with no ceiling — cost-DoS.
- **Fix:** Key the limiter on `hotel_slug` (and the *trusted* proxy hop, not the first); add a per-hotel daily token budget checked before and decremented after `agent.arun`.
- **Priority:** P1

#### AI-02 — Guest & global agents have no `tool_call_limit`
- **Description:** Only the hotelier agent bounds tool calls (`agent.py:894-895`). `create_guest_agent_graph` (`guest_agent.py:519-524`) and `create_global_concierge_graph` (`global_agent.py:106-111`) build `Agent(...)` with **no** `tool_call_limit`.
- **Severity:** 🟠 High
- **Impact:** A model looping on `check_availability`/`search_hotels` runs unbounded billed LLM round-trips — on the *unauthenticated* endpoint. Highest-risk cost path.
- **Fix:** Add `tool_call_limit` (≈4) to both.
- **Priority:** P1

#### AI-03 — No per-tenant token/spend tracking
- **Description:** No code reads `usage`/`input_tokens`/`output_tokens` from any `agent.arun` result. The only metering is WhatsApp credits, unrelated to actual tokens.
- **Severity:** 🟠 High (cost visibility)
- **Impact:** Impossible to attribute LLM spend to a tenant, detect a runaway hotel, or bill accurately.
- **Fix:** Capture `RunResponse` usage after each `arun`; persist per-hotel counters in Redis/DB; enforce a budget (ties to AI-01).
- **Priority:** P1

#### AI-04 — 70B model is the default for the scripted guest concierge
- **Description:** Guest concierge defaults to `llama-3.3-70b-versatile` (`guest_agent.py:511`) for a scripted sales/booking flow. The WhatsApp router already uses the cheap `llama-3.1-8b-instant`.
- **Severity:** 🟠 High (cost)
- **Impact:** ~10× per-token cost vs the 8B model for a task that doesn't need 70B.
- **Fix:** Default guest/global agents to an 8B/Haiku-class model; reserve 70B for hotelier analytics.
- **Priority:** P1

#### AI-05 — No LLM response caching
- **Description:** Rich Redis cache layer exists, but **no AI response is cached**. Identical guest greetings ("hi", "show me rooms") hit the 70B model every time (`public/chat.py`, `guest_agent.py`).
- **Severity:** 🟡 Medium (cost)
- **Fix:** Cache deterministic early-stage/short-prompt responses keyed on `(hotel_id, normalized_message, history_hash)` with a short TTL.
- **Priority:** P2

#### AI-06 — Full room catalog + amenities re-sent in every guest prompt
- **Description:** `guest_agent.py:211-243` injects all room types + amenities into the system prompt on every call.
- **Severity:** 🟡 Medium (token bloat)
- **Fix:** Move the catalog behind a tool for large properties (the hotelier agent already does dynamic tool selection — good).
- **Priority:** P2

#### AI-07 — Retry-without-tools fallback doubles spend on any error; client-supplied history; hardcoded models
- **Description:** Any agent exception triggers a second full run with the whole history (`public/chat.py:242-295`). History is capped at 20 messages but the **client supplies** the array with no per-message length cap. Model/base-URL/token defaults are duplicated across 4 files.
- **Severity:** 🟡 Medium / 🟢 Low
- **Fix:** Only retry on tool errors; cap per-message chars and total history tokens; centralize model config in `config.py`.
- **Priority:** P2/P3

> ✅ **API keys handled safely:** keys come from env/per-hotel settings, are masked in responses, and are never logged. (But see LOG-01 re: Sentry PII — verify request bodies with raw keys are scrubbed.)

---

### G. Database Architecture & Scale

#### DB-01 — Alembic migrations never run; schema built by `create_all` + runtime `ALTER`s
- **Description:** Deploy entrypoints (`Dockerfile`, `backend/Dockerfile`) run no `alembic upgrade`. Schema is created by `SQLModel.metadata.create_all` plus ~30 manual `ALTER TABLE ... ADD COLUMN` blocks wrapped in `try/except: pass` (`backend/app/core/database.py:50-224`). The 28 Alembic migrations — including the composite indexes in `08_performance_indexes.py` (`idx_bookings_dates (hotel_id, check_in, check_out)`, `idx_bookings_created_at`, `idx_room_rates_lookup`, `idx_competitor_rates_lookup`) — are **never applied in prod**. `create_all` only emits single-column `index=True` indexes.
- **Severity:** 🟠 High
- **Impact:** Range/date queries (availability, analytics) and `ORDER BY created_at` run without the intended composite indexes → slow at scale. `try/except: pass` migrations silently hide schema-drift failures.
- **Fix:** Run `alembic upgrade head` on deploy; move the composite indexes into the models' `__table_args__`; drop the runtime-ALTER hack. Add `index=True` to `Booking.created_at` (`booking.py:135`), `Lead.status`/`Lead.created_at`, and `UserHotelLink.hotel_id`.
- **Priority:** P1

#### DB-02 — `GET /guests` returns an unbounded result set
- **Description:** `backend/app/api/v1/bookings.py:355-360` does `select(Guest).where(hotel_id==...)` with **no limit/offset**. `get_guest_stats` does `len(result.all())` over a `GROUP BY ... HAVING` to count.
- **Severity:** 🟠 High
- **Impact:** A hotel with 100k+ guests serializes the entire table to JSON → OOM/timeout/crash.
- **Fix:** Paginate (`limit`/`offset`, `le=` cap); count with `func.count` over a subquery.
- **Priority:** P1

#### DB-03 — Connection pool over-sized; no `pool_recycle`
- **Description:** `pool_size=20, max_overflow=10` = 30 connections **per worker** (`backend/app/core/database.py:29-32`), `pool_pre_ping=True` (good) but **no `pool_recycle`**. With the root `Dockerfile` gunicorn `--workers 2` that's 60; across replicas it multiplies. (Prepared statements correctly disabled for pgbouncer — good.)
- **Severity:** 🟠 High
- **Impact:** `FATAL: too many connections` against Supabase's pooler at any horizontal scale; stale connections accumulate without recycle.
- **Fix:** `pool_size=5, max_overflow=5, pool_recycle=300`, sized as `supabase_limit / (workers × replicas)`.
- **Priority:** P1

#### DB-04 — Social-proof refresh is N+1 over all hotels
- **Description:** `social_proof_refresh._refresh_one_hotel` runs in a Python loop over every active hotel, firing 3–4 aggregate queries each (`backend/app/core/social_proof_refresh.py:48,126-127`).
- **Severity:** 🟡 Medium
- **Fix:** Single `GROUP BY hotel_id` aggregate.
- **Priority:** P2

#### DB-05 — `KEYS`-based scans in session listing/revocation
- **Description:** `_parse_sessions` / `revoke_user_sessions` use `redis.keys(pattern)` (`superadmin/sessions.py:52,98`), an O(N) blocking call.
- **Severity:** 🟢 Low
- **Fix:** Use `SCAN`, or index session keys per user in a Redis set.
- **Priority:** P3

---

### H. Infrastructure / Cloud Cost / Caching / Jobs

#### INF-01 — Conflicting Dockerfiles + heavy eager imports per worker
- **Description:** Root `Dockerfile` runs `gunicorn --workers 2`; `backend/Dockerfile` runs a **single** uvicorn *because* "Pandas + Langchain × 2 workers exceeds Railway's 1GB (OOM)." Worker count is fixed (no autoscale). `app.core.agent` eagerly imports `tools.weather` (pandas) and `tools.reporting` (matplotlib) at module load (registered in `main.py`), adding ~150–250MB RSS/worker before serving a request.
- **Severity:** 🟠 High
- **Impact:** OOM risk on 1GB (gunicorn path) or zero parallelism (uvicorn path); higher Railway plan cost.
- **Fix:** Pick one Dockerfile; make worker count an env var; **lazy-import** pandas/matplotlib inside the agent functions.
- **Priority:** P1

#### INF-02 — `analytics_*` caches never invalidated on booking writes (stale revenue)
- **Description:** `_clear_booking_caches` (`bookings.py:25-32`) busts dashboard/reports caches but **not** the `analytics_*` prefixes (cached 600s). Only `availability.py:27` busts `analytics_dashboard`.
- **Severity:** 🟠 High (data consistency)
- **Impact:** After a new/cancelled booking, revenue & analytics dashboards show stale numbers for up to 10 minutes.
- **Fix:** Add all `analytics_*` patterns to `_clear_booking_caches`.
- **Priority:** P1

#### INF-03 — No scheduler is actually wired
- **Description:** `main.py` lifespan only calls `init_db()`. Despite docstrings promising a "5-minute cadence," there is **no** APScheduler/asyncio beat. Social-proof refresh and subscription-expiry only run via manual super-admin endpoints.
- **Severity:** 🟡 Medium
- **Impact:** Cached social proof goes stale indefinitely; expiry notifications never fire automatically.
- **Fix:** Add a single-instance scheduler (APScheduler with a Redis lock, or an external cron hitting the existing endpoints). When added, guard against per-worker double-run.
- **Priority:** P2

#### INF-04 — Uncached external API calls in agent tools; unbounded SSE
- **Description:** `tools/events.py` calls DuckDuckGo on **every** agent invocation with no caching (ban/latency risk). Public rate-update SSE (`public/sse.py:23-40`) is a `while True` with no max lifetime and **no connection cap**; each open tab holds a coroutine.
- **Severity:** 🟡 Medium
- **Impact:** Latency/ban + event-loop starvation/cost under many open booking pages.
- **Fix:** Cache events in Redis; add a max-duration + per-hotel/IP connection cap to SSE (also helps AI-02).
- **Priority:** P2

#### INF-05 — Local-memory cache/idempotency fallback is per-worker
- **Description:** If Redis is down, each worker caches independently and `set_nx_ex` idempotency locks become per-process (`redis_client.py`).
- **Severity:** 🟡 Medium
- **Impact:** Double-charge/duplicate-action risk during a Redis outage.
- **Fix:** Treat Redis as a hard dependency for payment idempotency (fail closed), or use a DB unique constraint as the source of truth.
- **Priority:** P2

#### INF-06 — Public `/docs` & `/redoc`; broad CORS verbs/headers
- **Description:** `docs_url="/docs"`, `redoc_url="/redoc"` are exposed unauthenticated (`main.py:77-78`), publishing the full API surface. CORS origins are a correct explicit allowlist with credentials (good), but `allow_methods=["*"]` and `allow_headers=["*"]` are broad (`main.py:104-105`).
- **Severity:** 🟢 Low
- **Fix:** Gate `/docs` behind auth or disable in prod; tighten CORS methods/headers to those used.
- **Priority:** P3

> ✅ **Good:** OWASP security headers incl. HSTS/CSP/X-Frame DENY; `Cache-Control: no-store` on all `/api/v1`; tenant-keyed cache with fail-closed tenant identification; upload size cap.

---

### I. Logging, Monitoring & Privacy

#### LOG-01 — Sentry `send_default_pii=True` with no scrubber
- **Description:** `sentry_sdk.init(..., send_default_pii=True)` and **no `before_send`** (`main.py:64-70`). Request bodies, headers (incl. `Authorization` bearer tokens), cookies, and emails ship to Sentry — and integration-update payloads contain **raw API/payment keys**.
- **Severity:** 🟠 High (privacy + secret leakage to a third party)
- **Fix:** Set `send_default_pii=False` and add a `before_send` that scrubs tokens/keys/emails/passwords.
- **Priority:** P1

#### LOG-02 — PII logged at INFO on every authenticated request
- **Description:** `deps.py:64` logs `email` + `supabase_id` on **every** auth, plus emails at lines 73/80/98/105/139/176/196; email-service logs recipients. Global level is `INFO` (`main.py:13`).
- **Severity:** 🟡 Medium (privacy/GDPR + Railway log-egress cost)
- **Fix:** Default to `WARNING` in prod via `LOG_LEVEL`; drop or hash emails/ids in auth logs.
- **Priority:** P2

---

### J. Dead Code / Unused Dependencies / Dead Tables

> Overall **very clean** — no dead DB tables, no dead routers, no genuinely-unused first-party Python imports, no `.bak`/commented-route blocks.

| ID | Item | Severity | Fix |
|---|---|---|---|
| DEAD-01 | `frontend/replace_checkout.py` + `frontend/update_checkout.py` — spent one-off migration scripts (Python in a React dir); the refactor is already applied | 🟡 Medium | Delete both |
| DEAD-02 | `chrome_extension/` is **orphaned** — zero references in app/docs; host-permissions point at a **foreign domain** `api.gadget4me.in`/`app.gadget4me.in` and it scrapes OTAs (MakeMyTrip/Goibibo/Agoda) | 🟡 Medium | Remove or move to its own repo; review manifest before publishing — unmaintained scraper w/ host perms is a supply-chain/legal (OTA ToS) liability |
| DEAD-03 | `remarkable` npm dep unused (only `react-markdown` is used) | 🟢 Low | `npm remove remarkable` |
| DEAD-04 | `openai` / `groq` pip packages not imported by first-party code (agno talks via `OpenAILike` + base_url); likely transitive | 🟢 Low | Confirm transitive; drop explicit pins if redundant |
| DEAD-05 | `change_password` local path dead for Supabase users (`hashed_password == "SUPABASE_AUTH"`) | 🟢 Low | Remove or route through Supabase |
| DEAD-06 | `SECURITY.md` is the unedited GitHub template ("Tell them where to go…") | 🟢 Low | Write a real vuln-disclosure policy |

---

### K. Functional Bugs / Data Consistency

#### BUG-01 — `safe_background` breaks every task it wraps
- **Description:** `backend/app/core/tasks.py:70` calls `bg.add_task(_runner())` — it **invokes** the coroutine and passes the coroutine *object* as the callable. Starlette then tries to call that object in a threadpool → `TypeError`/"coroutine was never awaited". Used for **post-payment** tasks in `public/payments.py:317,332` (confirmation emails / sync) and the social-proof helper.
- **Severity:** 🟠 High (functional)
- **Impact:** Guests/hotels silently never receive post-payment confirmation emails; background sync silently fails. Payment still succeeds, so it's invisible.
- **Fix:** `bg.add_task(_runner)` (pass the function, not its call).
- **Priority:** P1

#### BUG-02 — Stale analytics after booking writes
Cross-ref **INF-02** (🟠 High, data consistency).

#### BUG-03 — `create_order` underpayment marks booking paid
Cross-ref **PAY-01** (🟠 High).

#### BUG-04 — Auto-heal seed uses a decommissioned model name
- **Description:** `database.py:191,216` defaults `ai_model` to `llama-3.1-70b-versatile`, a Groq model name that has been decommissioned (current: `llama-3.3-70b-versatile` / `llama-3.1-8b-instant`).
- **Severity:** 🟢 Low
- **Fix:** Use a current model id; centralize in config.
- **Priority:** P3

---

## 3. Page / Module Coverage Matrix

Every hotelier dashboard page, super-admin tab, and public page was enumerated from the routes and cross-checked against its backing API for the security/RBAC/tenancy properties above.

### Hotelier Dashboard (`/dashboard` tree)
| Page (route) | Backing API | Tenant-scoped? | Notes |
|---|---|---|---|
| Dashboard `/dashboard` | dashboard.py | ✅ | Stale-cache caveat (INF-02) |
| Rooms `/rooms` | rooms.py | ✅ | No role tier (AZ-02) |
| Rates `/rates` | rates.py | ✅ | No feature gate (AZ-03) |
| Availability `/availability` | availability.py | ✅ | TEN-05 (room_type ownership) |
| Analytics `/analytics/:tab` | analytics.py | ✅ | Cached 600s; INF-02 staleness |
| Bookings `/bookings` | bookings.py | ✅ | TEN-02 (create), paginated ✅ |
| Guests `/guests` | bookings.py | ✅ | **DB-02 unbounded** |
| Rate Shopper `/rate-shopper` | competitors.py | ✅ (admin ops) | TEN-03 (`check_freshness` anon) |
| Payments `/payments` | payments.py | ✅ | No role tier (AZ-02) |
| Add-ons `/addons` | addons.py | ✅ | — |
| Taxes `/taxes` | (settings) | ✅ | — |
| Channel Settings `/channel-settings` | channel_manager.py | ✅ | — |
| Settings `/settings/:tab` | hotels.py, integration | ✅ | SEC-02 (test-email **anon**), masking |
| Integration `/integration/:tab` | integration/* | ✅ | TEN-04 (OAuth state) |
| Admin `/admin/:section` | admin.py | ✅ super-admin only | UI clutter for non-admins |
| Reviews `/reviews` | integration/google | ✅ | TEN-04 |
| Loyalty `/loyalty` | loyalty.py | ✅ | No feature gate |
| AI Agent `/agent` | agent.py | ✅ | No feature gate; cost (AI-*) |
| Profile `/settings/profile` | users.py | ✅ | No role mass-assign ✅ |
| Chain Dashboard `/chain/dashboard` | chain/dashboard.py | ✅ chain-scoped | `get_chain_admin` ✅ |

### Super Admin Panel (tabs — all backend-gated ✅; per-tab perms NOT enforced — AZ-01)
Overview · Properties (Hotels) · Users · Brand Groups · Plan Features · **KYC** · **Commissions** · **Payouts** · Support Tickets · Analytics · Revenue · Health Monitor · Broadcasts · Audit Trail · Sessions · Cache · Platform Settings.
→ Finance/System tabs are reachable by any SUPER_ADMIN regardless of sub-role (AZ-01); impersonation token issue (AUTH-02); session revoke works but uses `KEYS` (DB-05).

### Public Pages
Landing · `/book/:slug` (rooms/checkout/confirmation/cancel) · `/book/:slug/widget` · `/book/chain/:slug/widget` · `/book/:slug/chat` · legal pages.
→ SEC-01 (razorpay leak via hotel-details), PAY-01 (create-order), AI-01/02 (chat cost), PUB-01 (cancel enumeration), PUB-03 (widget-config).

---

## 4. Prioritized Remediation Roadmap

**P0 — do immediately**
1. **SEC-01** — denylist/allowlist `razorpay_key_secret`/`razorpay_key_id` in `sensitive_fields.py`; purge `public:hotel-details:*` cache; **rotate** exposed per-hotel Razorpay keys.
2. **SEC-02** — add auth to `test-email-connection`.

**P1 — this sprint**
- **PAY-01** server-side order amount · **BUG-01** `add_task(_runner)` · **AZ-01** enforce superadmin sub-role perms · **AZ-02** intra-tenant role tiers · **AZ-03** apply `require_feature` · **AUTH-01/02/03** token-cache expiry, impersonation `exp`, remove DEBUG-unverified · **AI-01/02/03/04** chat budget + `tool_call_limit` + usage tracking + cheaper guest model · **DB-01/02/03** run Alembic + composite indexes, paginate `/guests`, shrink pool + `pool_recycle` · **INF-01/02** one Dockerfile + lazy heavy imports + bust `analytics_*` cache · **LOG-01** Sentry PII scrub.

**P2 — next**
- TEN-02/03/04 · PUB-01/02 · AI-05/06/07 · DB-04 · INF-03/04/05 · LOG-02 · AZ-04.

**P3 — backlog**
- AUTH-04/05 · TEN-05 · PUB-03 · DB-05 · INF-06 · DEAD-01..06 · BUG-04.

---

## 5. What's Already Done Well (for balance)

- Consistent tenant scoping by `hotel_id`; gated property switching via `UserHotelLink`.
- Parameterized SQL everywhere — **no injection**.
- Razorpay **and** WhatsApp/Meta **webhook signatures** correctly HMAC-verified (constant-time).
- Server-side price recalculation + promo re-validation on public booking; payment idempotency locks.
- Tenant-keyed caching that fails closed; browser-cache disabled on APIs.
- Full OWASP security-header set; argon2 password hashing; PyJWT (CVE-free) over python-jose; secrets gitignored (none committed).
- Sensitive-field masking layer for hotelier views (just incomplete — see SEC-01).
- Clean codebase: no dead tables/routers, minimal unused deps.

---

---

## 6. Remediation Status (implemented in this branch)

The following fixes were implemented, tested (113 backend tests green), and
committed on `claude/project-security-audit-jH1Jc`. Items marked ⚠️ need an
operational follow-up beyond code.

| ID | Status | Notes |
|---|---|---|
| SEC-01 | ✅ Fixed | Razorpay **secret** masked in settings (denylist + secret-substring heuristic); `razorpay_key_id` stays exposed (publishable). ⚠️ **Rotate any live per-hotel Razorpay secrets** and purge `public:hotel-details:*` cache. |
| SEC-02 | ✅ Fixed | `test-email-connection` now requires auth + own-hotel scope. |
| PAY-01 | ✅ Fixed | create-order charges server-side `booking.total_amount`. |
| AUTH-01 | ✅ Fixed | Auth cache TTL capped at token `exp`. |
| AUTH-02 | ✅ Fixed | Impersonation token gets 30-min `exp`; verifier requires `exp`. |
| AUTH-03 | ✅ Fixed | DEBUG unverified-claims fallback removed. |
| AUTH-04 | ✅ Fixed | Supabase verify no longer falls back to `SECRET_KEY`. |
| AZ-01 | ✅ Fixed | `require_permission` enforced on payouts/revenue/commissions/exports/invoices/kyc/platform. |
| AZ-02 | ✅ Fixed | `require_hotel_role` on config mutations (rooms/rates/addons/amenities/payments/channel/integration/hotel-settings). |
| AZ-03 | ✅ Fixed | `feature_ai_agent` gate on AI agent endpoint (competitors already gated inline). |
| TEN-02/03/04/05 | ✅ Fixed | Booking room/rate ownership; check_freshness auth+scope; signed OAuth state; availability room-type ownership. |
| AI-01..05, AI-07 | ✅ Fixed | Per-hotel daily quota; `tool_call_limit`; 8B default; Redis-backed limiter; `cache_response`+`compress_tool_results`; output caps; per-hotel token tracking (`app/core/ai_usage.py`). |
| DB-01/02/03 | ✅ Fixed | Composite indexes via `CREATE INDEX IF NOT EXISTS` + model `index=True`; `/guests` paginated; pool 5+5+recycle. |
| INF-01/02/04/06 | ✅ Fixed | Lazy heavy imports + env-driven workers; analytics cache busting; SSE lifetime cap; docs gated to DEBUG. |
| LOG-01/02 | ✅ Fixed | Sentry `send_default_pii=False` + scrubber; `LOG_LEVEL` env; auth PII log → DEBUG. |
| BUG-01/04 | ✅ Fixed | `safe_background` callable bug; decommissioned model id. |
| PUB-01/02 | ✅ Fixed | Cancel endpoints rate-limited; upload magic-byte validation + safe content-type. |
| DEAD-01/03/06 | ✅ Fixed | Removed spent scripts + `remarkable`; real SECURITY.md. |
| INF-03 | ⚠️ Deferred | No scheduler wired. Recommend external cron hitting existing endpoints, or APScheduler with a Redis lock (avoid per-worker double-run). Not changed to limit risk. |
| DB-01 (Alembic) | ⚠️ Partial | Indexes now applied at boot; switching deploys to `alembic upgrade head` is still recommended as the long-term fix. |
| DEAD-02 | ℹ️ Kept | The Chrome extension is the **rate-shopper scraping client** (feeds `/rates/ingest`), so it was intentionally NOT deleted. |
| AUTH-05 | ℹ️ Note | Open auto-registration is by design; confirm Supabase signup restrictions. |

*End of report.*
