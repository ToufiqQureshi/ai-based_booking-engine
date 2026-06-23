# Staybooker — Engineering Rules & Architecture A to Z

> **Read this before writing any code in this repo.** Staybooker is a multi-tenant hotel-booking SaaS (FastAPI + React + Supabase Postgres + Redis). It handles real money and guest PII. Every change must keep it **secure, fast, cheap to run, and stable in production**.

---

## 🏗️ 1. System Architecture (A to Z)

### Tech Stack & Locations
- **Frontend (`frontend/`)**: React + Vite + TailwindCSS. Deployed on **Cloudflare Pages**.
- **Backend (`backend/`)**: Python + FastAPI. Deployed on **Railway**.
- **Database**: PostgreSQL hosted on **Supabase**.
- **Caching & Rate Limiting**: **Redis** (hosted on Railway internal network).

### How the System Flows
1. User visits Cloudflare Pages URL (e.g. `staybooker.ai`).
2. Frontend makes API calls to Railway backend (`api.staybooker.ai`).
3. Backend verifies auth headers using Supabase JWTs.
4. Backend checks Redis for Rate Limiting and Caching.
5. If cache miss, Backend queries Supabase Postgres via SQLModel/SQLAlchemy.
6. Backend returns data to Frontend.
7. Frontend caches API responses using **React Query** (TanStack Query) for 5 minutes.

### Authentication & Authorization
- **Identity Provider**: Supabase Auth.
- **Frontend**: Stores JWT token in local storage.
- **Backend**: Every non-public route depends on `CurrentUser` (`app/api/deps.py`). The backend strictly verifies the JWT against Supabase's JWKS.
- **Role-Based Access Control (RBAC)**: We enforce roles (`OWNER`, `MANAGER`, `STAFF`) via `require_hotel_role()`. `STAFF` cannot modify critical settings.
- **Superadmin**: Global platform admins use `get_super_admin` and `require_permission()`.

### Caching Architecture
We use a multi-layered caching system to protect the database and ensure lightning-fast speeds:
1. **Frontend Cache (React Query)**: Caches GET requests for 5 mins (`staleTime: 5 * 60 * 1000`). Garbage collects after 10 mins. Prevents redundant API calls on tab focus or navigation.
2. **Backend Redis Cache**: 
   - Primary data store for public routes (e.g. `public:rooms:hotel_id:*`).
   - Handles DDoS protection, AI token limits, and Rate Limiting.
   - **Resilient Fallback**: If Redis crashes or is offline, `RedisClient` (`app/core/redis_client.py`) transparently falls back to an **in-memory Python dictionary cache** with auto-cooldowns. The app will *never* crash due to a Redis failure.
3. **Database Cache**: Supabase internally buffers PostgreSQL read queries.

### Rate Limiting & DDoS Protection
- Powered by `app/core/limiter.py`.
- **Redis-backed**: Tracks request counts per IP/User over time windows.
- Public AI endpoints have strict IP rate limits PLUS per-hotel quotas (`_enforce_hotel_ai_quota`) to prevent LLM billing exhaustion.

### Security Controls (IDOR & PII)
- **Multi-tenant Isolation**: EVERY DB query must filter by `hotel_id`. Hotel A must never access Hotel B's data.
- **Sanitized Outputs**: The backend never returns raw API keys. Secrets in `hotel.settings` are masked via `app/core/sensitive_fields.py`.
- **Webhooks**: Razorpay and WhatsApp webhook payloads are verified via HMAC SHA-256 signatures before processing.
- **Payments**: Amounts are always server-computed. We never trust the client's `total_amount`.

### Codebase Map
- **`backend/app/<domain>/`** — one folder per business domain: `auth`, `bookings`, `rooms`, `payments`, `guests`, `guest_booking`, `rate_plans`, `rate_shopper`, `revenue`, `channel_manager`, `loyalty`, `marketing`, `analytics`, `dashboard`, `brand_console`, `superadmin`, `integration` (WhatsApp/email/Google), `ai_assistant` / `ai_engine`, `calendar`, `experiences`, `system`. Each domain folder owns its own routes, models, and schemas.
- **`backend/app/core/`** — cross-cutting: `deps.py` (auth/RBAC dependencies), `redis_client.py`, `limiter.py`, `config.py`, `sensitive_fields.py`, `ai_usage.py`, `vault.py`.
- **`frontend/src/<domain>/`** — mirrors the backend: `bookings`, `rooms`, `guest_booking`, `auth`, `dashboard`, `revenue`, `finance`, `analytics`, `marketing`, `chain`, `admin`, `superadmin`, `settings`, `agent`.
- **`frontend/src/components/ui/`** — shadcn/ui primitives, don't hand-roll new ones. `components/common/` and `components/layout/` for shared app components.
- **`frontend/src/core/`** — shared API client, hooks, React Query setup.

### Common Commands
```bash
# Backend
cd backend && uvicorn main:app --reload     # run dev server
cd backend && pytest                        # run tests
cd backend && python -m compileall -q app main.py   # compile check

# Frontend
cd frontend && npm run dev                  # run dev server
cd frontend && npm run lint                 # eslint
cd frontend && npm run test                 # vitest
cd frontend && npm run build                # production build / typecheck
```

---

## 🛑 2. Golden Engineering Rules

1. **Never break multi-tenant isolation.** One hotel must never see/modify another hotel's data.
2. **Never trust the client** for price, role, hotel_id, status, or secrets — recompute/verify server-side.
3. **Bound every cost** — LLM tokens, DB rows returned, connections, background work.
4. **Run the tests** (`cd backend && pytest`) before claiming done. Add tests for new behavior.
5. **No secrets in code, logs, commits, or Sentry.** Use env vars.

---

## ⚙️ 3. Performance & Scale
- **Pagination is mandatory** on list endpoints: `limit: int = Query(<default>, le=<cap>)` + `offset`.
- **Index hot columns**: foreign keys, `hotel_id`, dates, status, slug, email. 
- **No N+1 Queries**: Batch with `selectinload` / a single `GROUP BY`.
- **DB pool** is per-worker and env-driven. Keep `DB_POOL_SIZE × WEB_CONCURRENCY × replicas ≤ Supabase connection limit`.
- **Heavy imports** (pandas/matplotlib/reportlab) must be **lazy** (import inside the function), never at module top.

---

## 🤖 4. AI / LLM Cost Rules
- Default to the **cheap model** (`llama-3.1-8b-instant`). Reserve large models only for the hotelier analytics agent.
- Every agent: set `tool_call_limit`, `max_tool_calls_from_history`, `compress_tool_results=True`, and a `max_tokens` cap.
- Use `cache_response=True` (short TTL) on sales/guest bots; **not** on the live analytics agent.
- Record usage after every run with `app/core/ai_usage.record_ai_usage(hotel_id, result)`.

---

## 🏭 5. Production Discipline (How Big Tech Avoids Outages)
- **Design for failure.** Every call to an external dependency (Supabase, Redis, Groq/OpenAI, Razorpay, WhatsApp) must have a timeout and a fallback path. A third-party outage must degrade the feature, never crash the request (see `RedisClient`'s in-memory fallback as the reference pattern).
- **Expand-contract schema migrations.** Never add a column, make it required, and drop the old one in the same migration. Step 1: add the new column nullable. Step 2 (separate PR, after backend is deployed): backfill + start writing to it. Step 3 (separate PR, later): drop the old column. This keeps old and new code deployable at the same time.
- **Idempotent webhooks.** Razorpay/WhatsApp can and will retry a webhook delivery. Every handler must check a `processed_event_id`-style record before acting, or a retry causes a double-charge or double-booking.
- **Canary your own changes.** Every PR gets a Cloudflare Pages preview URL — click through the actual feature there before merging. A green build is not the same as a working feature.
- **Write the regression test first, then fix the bug** (ties into §8 Bug Fix Protocol) — a fix without a test that would have caught it isn't verified, it's hoped.
- **Feature-flag risky changes.** Anything touching payments, pricing, or multi-tenant data should be guardable behind a simple on/off toggle (env var or a `hotel.settings` flag) so it can be killed instantly without a redeploy.

---

## 🔄 6. Workflow & Repo Conventions
- Run backend tests from `backend/` with `pytest`.
- Match existing style; comment **why**, not what.
- Don't leave dead/scratch code.
- New env vars: add to `app/core/config.py` with a safe default.
- Background work: use `safe_background(bg, lambda: coro(), task_name=...)` — pass a factory.

---

## ✅ 7. Definition of Done
- [ ] Tenant-scoped & authz-gated (role/permission/feature as applicable)
- [ ] Inputs validated; amounts/roles/ids verified server-side
- [ ] Paginated + indexed; no N+1; caches invalidated
- [ ] LLM calls bounded & usage-tracked (if AI)
- [ ] No PII/secret in logs
- [ ] `cd backend && pytest` green
- [ ] `cd frontend && npm run lint` and `npm run test` green if frontend touched; `npm run build` succeeds
- [ ] Updated `work_log_tracker.csv` at the project root.

---

## 📋 8. Work Log Tracker Maintenance
- If you add, modify, or delete features or endpoints, you **must** document it in `work_log_tracker.csv`.
- Maintain fields: `"Timestamp","Task Name","File Path","Category","API Calls Count","Caching & Database Details","Security Controls / IDOR Prevention"`.
- Always wrap each field in double quotes (`"`) to ensure clean parsing.

---

## 🛡️ 9. Bug Fix Protocol (Regression Prevention)

Every bug fix must follow this checklist before committing:

### Before touching code
1. **Read the full file** — understand the whole context, not just the broken line.
2. **Find all callers** — grep every function/endpoint being modified. Check what else depends on it.
3. **Check model definitions** — verify the actual schema before assuming field names, types, or constraints.

### While fixing
4. **Minimal blast radius** — change only what is broken. No cleanups or refactors in the same commit.
5. **One bug = one commit** — if a second bug is found while fixing, put it in a separate commit.
6. **Never swallow exceptions silently** — no bare `except: pass`. Always log or re-raise.

### After fixing
7. **Compile check** — `cd backend && python -m compileall -q app main.py` before pushing.
8. **Run tests** — `cd backend && pytest tests/ -x -q --tb=short` must be green.
9. **Check related tests** — read any test file that covers the changed endpoint, verify assertions still hold.
10. **Grep for the same pattern** — if a bug exists in one place, search the whole codebase for the same anti-pattern and fix all instances.

### General traps to check on every change
- **DB model fields** — always read the actual model definition before accessing fields. Nested data may be stored as JSON dicts, not direct attributes. Use `.get()` on dicts.
- **Query result cardinality** — if a query uses `OR` conditions across multiple rows, `scalar_one_or_none()` will crash. Use `.scalars().first()` when multiple results are possible.
- **Object creation** — when creating any DB record, check if it needs to inherit context fields (e.g. tenant ID, chain ID, hotel ID) from the current user.
- **Auth on read endpoints** — GET endpoints need the same role/permission guards as write endpoints.
- **Silent failures** — broad `except` blocks that return generic responses hide real bugs. Check for them near any code you touch.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
