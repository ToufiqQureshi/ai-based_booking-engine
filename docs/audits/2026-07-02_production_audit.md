# Staybooker — Production Readiness Audit (2026-07-02)

Full-stack audit of the repository, the live Supabase database, and Sentry production telemetry.
Every issue that was safe to fix automatically **has been fixed** on branch `claude/staybooker-prod-audit-cjqam4`
(17 commits) plus 4 migrations applied to the production database. Evidence and remaining work below.

**Verification baseline at the end of the audit:**
backend `python -m compileall` clean · `pytest` **580 passed, 1 skipped** ·
frontend `npm run build` **passes** · `npm run test` **16/16** ·
Supabase security advisors: **0 warnings** left that code/SQL can fix.

---

## 1. Architecture Report

- **Frontend** `frontend/` — React 18 + Vite 5 + TS + Tailwind + React Query 5, deployed on Cloudflare Pages.
  Routing splits on subdomain (`superadmin.` → SuperAdminDashboard; main app under `DashboardLayout`;
  public guest flow under `/book/:hotelSlug`). All pages lazy-loaded.
- **Backend** `backend/` — FastAPI + SQLModel (asyncpg), gunicorn/uvicorn on Railway, multi-stage
  Dockerfile (python:3.12-slim, non-root, tini, healthcheck).
- **Data** — Supabase Postgres 17 (`ap-south-1`); Redis on Railway for cache/rate-limit/idempotency with a
  transparent in-memory fallback (`app/core/cache/redis_client.py`).
- **Auth** — Supabase JWT verified in `app/core/auth/deps.py`; RBAC via `require_hotel_role()`;
  superadmin via `get_super_admin`/`require_permission()` (`superadmin/hotels/hotels.py`).
- **AI** — Groq Llama (8B for guest/WhatsApp bots, `llama-3.3-70b-versatile` for the hotelier team agent),
  Agno 2.6.20, per-hotel daily token quotas + Redis usage counters (`ai_engine/ai_usage.py`).
- **Payments** — Razorpay; server-computed amounts, HMAC-verified webhooks, Redis idempotency keys.

Architecture is sound for the current scale. The one structural caveat: **schema management is split**
(Alembic in-repo, Supabase MCP migrations out-of-band, plus runtime `create_all`/ALTER stubs at boot) — see §7.

## 2. Production Readiness Report

| Area | Status |
|---|---|
| Backend tests | ✅ 580 pass (was 577 + 8 new regression tests, 5 removed with channel manager) |
| Frontend build/tests | ✅ build green, 16/16 vitest |
| Broken pages/routes | ✅ none found; orphan `/signup` page deleted; SPA `_redirects` added so deep links survive refresh |
| Dead features | ✅ channel manager (localhost mock) fully removed; dead superadmin sessions endpoints deleted |
| Hardcoded prod values | ✅ recovery URL, CORS lists, Meta Graph versions, API base URLs, currency, card-logo CDN — all centralized/config-driven |
| DB advisors | ✅ all fixable security warnings cleared in prod |
| Ops config | ❌ **3 launch blockers below (§17) — all env/dashboard settings, not code** |

## 3. Security Audit Report

**Verified strong (with evidence):**
- **Tenant isolation — now verified.** Two prior in-repo audits flagged it as untested. This audit ran an
  AST sweep over every route handler (63 flagged for manual review) plus a scan for unguarded
  `session.get(Model, id)` and `select().where(Model.id==…)` patterns. **No missing guard was found.**
  Ownership checks confirmed in: AI chat sessions (agno `user_id` scoping), notifications (`user_id`),
  chain endpoints (`chain_id` on every query incl. deletes), superadmin (permission-gated + master-admin
  protection), public cancel flow (booking number + guest email + rate limit), payments (server-side
  amounts), public booking (rate-plan cross-tenant guard `guest_booking/bookings.py`).
- **Webhooks**: Razorpay & WhatsApp HMAC-SHA256 with `compare_digest`, event-id idempotency (Redis SET-NX),
  server-side amount validation on webhook capture.
- **Uploads**: magic-byte validation, size caps, rate-limited, authenticated.
- **Headers**: CSP, HSTS, X-Frame-Options DENY, nosniff; docs/openapi gated behind `DEBUG=False`.
- **Sentry**: `send_default_pii=False` + header scrubbing.

**Fixed in this audit:**
- Unmetered platform-key LLM endpoint (`integration/google.py` AI reply) → quota-gated + usage-recorded.
- Anon always-true INSERT/UPDATE RLS policies (`sb_*` tracker tables) → tables dropped (0 rows, 0 code refs).
- 4 RLS helper functions had mutable `search_path` → pinned.
- Duplicate permissive RLS policy generations on 13 tables → consolidated to the multi-hotel-aware `t_*` set.

**Accepted risks / by design (documented):**
- 12 INFO "RLS enabled, no policy" tables — backend accesses them via service role; deny-by-default for
  anon/authenticated is intentional.
- Credentialed CORS wildcard for `*.staybooker.pages.dev` / `*.ai-based-booking-engine.pages.dev` preview
  deployments: anyone who can open a PR gets a credentialed origin. Acceptable pre-launch; consider
  restricting to production origins once launched.
- JWT in localStorage (XSS-readable). `credentials:'include'` is already passed everywhere, so migrating to
  httpOnly cookies later requires no client change (noted in `client.ts` header comment).
- `MASTER_ADMIN_EMAILS` auto-promotes to SUPER_ADMIN inside the auth dependency
  (`core/auth/deps.py:96-207`), which also auto-creates Hotel+OWNER on first login. Powerful implicit
  writes in an auth dep — keep the env var tightly controlled.
- **Enable "leaked password protection" in Supabase Auth dashboard** (advisor WARN; cannot be set via API).

## 4. API Audit Report

- All mounted routers live under `/api/v1`; docs disabled in prod.
- Public surface (by design): `guest_booking/*` (slug-resolved), `analytics/track/*` (rate-limited
  60–120/min), `public_report` (token-scoped, aggregate-only), social proof, SSE rate stream
  (10/min + 30-min lifetime), Google Hotel Ads feeds (only GHA-enabled hotels), webhooks (signature-gated).
- Pagination caps (`le=`) present on all list endpoints checked.
- Dead APIs removed this audit: `/channel-manager/*` (5 endpoints), superadmin `/sessions` (2, never mounted).
- GHA `ari.xml`/`sync/push` are explicit stubs (empty `<Transaction/>` / 501) — intentional, logged.
- Minor: `/admin/stats` returns hardcoded `"active_now": 1` (cosmetic; superadmin-only).

## 5. Dead Code Report (deleted this audit)

Backend: `app/channel_manager/` (entire domain), sessions router endpoints, `CustomDomain` model.
Frontend: `@/` stray dir, `node_modules_old/`, `src/auth/Signup.tsx`, `src/settings/index.ts`,
`check_error*.mjs`, `puppeteer` dependency (was pulling Chromium into every install), channel-settings page.
Root: `test_agy.py`.
Database: 17 dead tables dropped (see §7).

**Kept, flagged (user decision / needs owner input):**
- `landing/` — static marketing+legal site, referenced nowhere in code/CI. Confirm where (if anywhere) it is
  deployed; note the GDPR page filename is misspelled (`datadelelationrequest.html`).
- `GEMINI.md` — second agent-rules doc, redundant with CLAUDE.md.
- `hotelier_api_keys`, `email_templates` tables + models — no routes use them yet; candidates for the next
  cleanup or the features that were planned around them.
- `docs/` contains several overlapping earlier audit docs — this file supersedes them.

## 6. Frontend ↔ Backend Mapping Report

- ~150 distinct API paths called by the frontend were inventoried; all resolve to mounted routers
  (after removing the channel-manager pair on both sides in the same commit).
- The six independent (and drifted) API base-URL resolvers are now one: `src/core/api/baseUrl.ts`.
- No frontend calls to nonexistent endpoints found; no orphan backend domain without a frontend consumer
  remains (rate-shopper is live on both sides; GHA feeds are consumed by Google, not the SPA).
- Contract-audit habit to keep: CLAUDE.md §11.6 grep both directions on every response-shape change.

## 7. Database Audit Report

**State found → state now (all applied to prod via 4 tracked Supabase migrations):**
- 4 hotels carried the decommissioned `llama-3.1-70b-versatile` model id → updated to 3.3.
- 17 dead tables dropped (row counts recorded pre-drop; max residue: 3 test tickets):
  `sb_sessions/sb_pageviews/sb_events/sb_booking_funnel` (abandoned tracker with anon-writable policies),
  `kyc_*`, `payouts`, `bank_accounts`, `support_tickets`, `ticket_messages`, `commission_*`,
  `platform_invoices`, `custom_domains`, `channel_*` (3).
- `search_path` pinned on `get_current_user_id`, `get_current_user_hotel_ids`, `current_hotel_id`,
  `current_chain_id`.
- Duplicate index `idx_report_share_links_hotel` dropped; 5 missing FK indexes created
  (`guest_loyalty.chain_id`, `loyalty_programs.chain_id`, `promo_codes.chain_id`,
  `room_amenity_links.amenity_id`, `user_hotel_links.hotel_id`).
- Old `*_tenant_isolation` policies dropped where the newer `t_*` set exists (13 tables); the 4 tables where
  it is the only policy (`hotels`, `users`, `notifications`, `competitor_rates`) keep it.

**⚠️ Schema-drift finding (important, documented not "fixed"):**
Prod `alembic_version` = `4e49118f6e51` (2026-06-04). Every later Alembic migration in the repo —
including `drop_rate_shopper_tables` — **never ran in prod**; later schema changes were applied out-of-band
via Supabase MCP migrations. Running `alembic upgrade head` against prod would have dropped the *live*
rate-shopper tables. That migration is now neutralized to a no-op in-repo. **Recommendation:** pick ONE
migration channel going forward (suggest: keep using tracked Supabase migrations, stop treating Alembic as
runnable against prod, and remove the runtime `ALTER TABLE` stubs in `core/db/database.py` once stable).

**Report-only:** 65 unused indexes flagged by the advisor — left in place (usage stats are young);
re-check after a month of real traffic. The Supabase performance-advisor endpoint itself currently 500s
(upstream lint bug, not caused by our changes).

## 8. Performance Report

- Frontend entry chunk 706 kB → 562 kB; recharts (556 kB), pdf stack (593 kB), markdown (165 kB) now load
  on demand via `manualChunks`. Next step if needed: split the remaining vendor entry (React Query, Radix).
- Backend N+1s: rate-plan lookup in public booking loop batched (`guest_booking/bookings.py`); recovery
  sweep already batches guests; no other loop-queries found in the sweep.
- SSE rate stream runs Redis polls in a thread to avoid blocking the event loop (verified good).
- React Query 5-min staleTime + Redis public-route caching intact; booking writes bust all dashboards.
- Heavy imports (pandas/reportlab/agno) are function-local (verified in touched files).

## 9. Technical Debt Report

1. **Split schema management** (§7) — the biggest debt; one channel + one head.
2. In-process WebSocket registry doesn't broadcast across gunicorn workers (`system/ws.py`) — known
  architectural gap; fine at current scale, revisit with >1 worker relying on WS pushes.
3. `core/auth/deps.py` auto-registration/auto-promotion side effects inside the auth dependency.
4. Frontend lint: 311 pre-existing errors (mostly `@typescript-eslint/no-explicit-any`) — non-blocking per
  CLAUDE.md but worth burning down; `no-unused-expressions` ones are quick wins.
5. Two `ChatWidget` components with the same name (support vs public) — rename one.
6. CI security scans (`pip-audit`, `bandit`) are `continue-on-error` — make at least high-severity blocking.
7. `docs/` audit-doc sprawl; `.playwright-mcp/` scratch dir at root.
8. Frontend hostname-based env selection (prod Supabase URL + anon key hardcoded as fallbacks in
  `core/lib/supabase.ts`) — works, but a misconfigured non-prod deploy silently points at prod; consider
  failing fast when `VITE_SUPABASE_URL` is unset in non-prod builds.

## 10. Critical Bugs (all fixed in this audit)

1. Channel manager called `http://127.0.0.1:8001/...` mock — feature could never work in prod → removed.
2. Default AI model id decommissioned by Groq (`llama-3.1-70b-versatile`) — every new hotel's first AI call
   would 400 → defaults + 4 prod rows fixed (regression test greps the whole backend).
3. Google-review AI reply endpoint bypassed token quota + usage metering (platform-key cost leak) → gated.
4. Anon-writable `sb_*` tracker tables in prod (data-poisoning surface) → dropped.
5. Stale `drop_rate_shopper_tables` migration would destroy live prod tables if Alembic ever ran → neutralized.

## 11. Medium Bugs (fixed)

- Recovery emails linked hardcoded `https://staybooker.ai/book` regardless of environment → `FRONTEND_URL`.
- CORS origin lists drifted across 3 files → single config source.
- Meta Graph API pinned at v17 in two senders (past deprecation) → one `META_GRAPH_API_VERSION=v21.0`.
- Agent SSE stream: no abort on unmount/resend; expired token killed the chat → AbortController + one
  refresh-retry.
- Checkout card logos hotlinked from wikimedia (third-party outage breaks payment page) → local assets.
- Cloudflare Pages deep links 404'd on refresh (no SPA fallback) → `public/_redirects`.
- CI tested on Python 3.11 while prod image is 3.12 → aligned.
- N+1 rate-plan query per room in public booking → single `IN()` query (tenant guard preserved).

## 12. Low Priority Bugs (fixed unless noted)

- Silent `except: pass` on booking cache-bust + Google status email lookup → now logged.
- Pydantic v1 `class Config` deprecation warning on webhook payload → `ConfigDict`.
- `.gitignore` `.env` negation had a stray space (no-op) → fixed; `frontend/.env.example` now tracked.
- Duplicate `formatCurrency`×8 pinned to INR → shared hotel-currency-aware util.
- Exchange-rate fetch had no timeout → 5s bound + graceful degrade.
- Open (cosmetic): `/admin/stats` `active_now` hardcoded to 1; passlib `crypt` deprecation warning on 3.13+.

## 13. Improvements (recommended, not done)

- httpOnly-cookie session migration (client is already compatible).
- Real Channex (or other CM) integration when business-ready — regression tests pin today's removal.
- Burn down `any` types; enable stricter tsconfig per domain folder.
- Add `docs/RUNBOOK.md` for the ops env vars (Redis/webhook secret rotation, MASTER_ADMIN_EMAILS policy).
- Consider Cloudflare Turnstile on `/public/bookings` (BOOKING_TOKEN_REQUIRED exists but is off).

## 14. Files Safe To Delete (already deleted — see §5)

Remaining candidates needing an owner decision: `landing/` (if not deployed anywhere), `GEMINI.md`,
`work_log_summary.csv`, `.playwright-mcp/`, `Staybooker_Architecture.excalidraw` (move to docs/ if wanted).

## 15. Refactoring Suggestions

- Merge `ai_engine/ai_usage.py` (logic) and `ai_assistant/ai_usage.py` (tables) into one module.
- Extract superadmin hotel-deletion raw-SQL cascade into a reviewed helper with a table list that fails
  loudly when a new tenant-scoped table is added (today: forgetting = FK error at delete time).
- Rename one of the two `ChatWidget`s; move `frontend/src/lib/tracker.ts` remnants fully into `core/`.

## 16. Final Production Score: **82 / 100**

Code is in genuinely good shape: strong payment/webhook security, verified tenant isolation, green suites,
no dead surface left. Points held back by: ops configuration not production-ready (Redis auth failing for
13 days, webhook secret missing — §17), split schema management (§7), and untested service layers
(email/WhatsApp senders have no direct tests).

## 17. Remaining Blockers Before Launch (none are code)

1. **Fix Redis credentials on Railway — NOW.** Sentry `STAYBOOKERAI-20`: 860 events over 13 days, still
   firing ("invalid username-password pair or user is disabled"). The app is silently running on the
   in-memory fallback: rate limits and webhook idempotency are per-process (weaker), caches don't survive
   deploys. Set a valid `REDIS_URL` / password.
2. **Set `RAZORPAY_WEBHOOK_SECRET` on Railway.** Sentry `STAYBOOKERAI-2T/2S`: real webhook deliveries are
   being rejected with "Webhook secret not configured" — payment capture confirmation currently relies
   solely on the client-side `/razorpay/verify` path.
3. **Fix Supabase SMTP** (Sentry `STAYBOOKERAI-2Q/2P`: invite emails failing) and **enable leaked-password
   protection** in the Supabase Auth dashboard.
4. Redeploy backend so the last AI-stream fixes ship (Sentry `3E/3D/33/3G` all trace to code already fixed
   in commits `a20fbb7`/`b696833`/`1d5d463` — resolve them in Sentry after the deploy proves quiet), then
   spot-check: hotelier AI chat, guest widget booking with payment, Google-review AI reply (its model id
   was one of the fixes).
5. Merge this PR and verify the Cloudflare Pages preview of the booking flow end-to-end before promoting.

---

*Audit performed 2026-07-02 on branch `claude/staybooker-prod-audit-cjqam4`. DB changes applied as Supabase
migrations: `update stale groq model ids` (data), `drop_dead_feature_tables`,
`fix_function_search_path_and_indexes`, `consolidate_duplicate_permissive_policies`.*
