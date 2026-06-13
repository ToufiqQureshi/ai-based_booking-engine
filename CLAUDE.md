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

## 🔄 5. Workflow & Repo Conventions
- Run backend tests from `backend/` with `pytest`.
- Match existing style; comment **why**, not what.
- Don't leave dead/scratch code.
- New env vars: add to `app/core/config.py` with a safe default.
- Background work: use `safe_background(bg, lambda: coro(), task_name=...)` — pass a factory.

---

## ✅ 6. Definition of Done
- [ ] Tenant-scoped & authz-gated (role/permission/feature as applicable)
- [ ] Inputs validated; amounts/roles/ids verified server-side
- [ ] Paginated + indexed; no N+1; caches invalidated
- [ ] LLM calls bounded & usage-tracked (if AI)
- [ ] No PII/secret in logs
- [ ] `cd backend && pytest` green; frontend builds if touched
- [ ] Updated `work_log_tracker.csv` at the project root.

---

## 📋 7. Work Log Tracker Maintenance
- If you add, modify, or delete features or endpoints, you **must** document it in `work_log_tracker.csv`.
- Maintain fields: `"Timestamp","Task Name","File Path","Category","API Calls Count","Caching & Database Details","Security Controls / IDOR Prevention"`.
- Always wrap each field in double quotes (`"`) to ensure clean parsing.
