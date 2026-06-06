# Staybooker — Engineering Rules for AI & Humans

> **Read this before writing any code in this repo.** Staybooker is a
> multi-tenant hotel-booking SaaS (FastAPI + React + Supabase Postgres +
> Redis, deployed on Railway). It handles real money and guest PII. Every
> change must keep it **secure, fast, cheap to run, and stable in
> production**. When a change conflicts with these rules, stop and flag it.

These rules are derived from a full security/performance audit
(`docs/SECURITY_AUDIT_REPORT.md`). Don't regress them.

---

## 0. Golden rules
1. **Never break multi-tenant isolation.** One hotel must never see/modify another hotel's data.
2. **Never trust the client** for price, role, hotel_id, status, or secrets — recompute/verify server-side.
3. **Bound every cost** — LLM tokens, DB rows returned, connections, background work.
4. **Run the tests** (`cd backend && pytest`) before claiming done. Add tests for new behavior.
5. **No secrets in code, logs, commits, or Sentry.** Use env vars.

---

## 1. Security & Auth (non-negotiable)
- **Auth:** every non-public route depends on `CurrentUser` (`app/api/deps.py`). Public routes live under `app/api/v1/public/` and must assume an anonymous, hostile caller.
- **Authorization within a tenant:** mutating/config endpoints must gate role with `require_hotel_role("OWNER", "MANAGER")` (see `deps.py`). STAFF is operational-only (bookings/availability/guests).
- **Super-admin endpoints:** gate with `get_super_admin`; sensitive/financial ones with `require_permission("superadmin.<area>.<action>")`. Never leave a superadmin route on bare `get_super_admin` if it's financial/PII.
- **Subscription features:** gate premium endpoints with `require_feature("feature_x")`.
- **JWT:** Supabase tokens verify against Supabase keys only; always require `exp`. Never add an "unverified claims" path. Internally-minted tokens (e.g. impersonation) must be short-lived with `exp`.
- **Secrets in `hotel.settings`:** add any new secret key to the denylist/heuristic in `app/core/sensitive_fields.py`. Prefer an **allowlist** mindset — never return a settings blob to a public endpoint without masking. (A leaked Razorpay secret was a real Critical bug — don't repeat it.) `razorpay_key_id` is publishable; `razorpay_key_secret` is write-only.
- **Webhooks:** verify HMAC signatures (Razorpay `X-Razorpay-Signature`, Meta `X-Hub-Signature-256`) with `hmac.compare_digest` before doing any work.
- **Uploads:** validate magic bytes, derive content-type server-side, cap size, randomize filename.
- **OAuth `state`** and any value that round-trips through a third party must be HMAC-signed and verified.

## 2. Multi-tenancy (IDOR prevention)
- Every query that reads/writes tenant data **must** filter by `current_user.hotel_id` (or validate ownership of a path/body id against it). This includes `RoomType`, `RatePlan`, `Booking`, `Competitor`, etc. fetched by id.
- When switching active property, validate the target against `UserHotelLink`.
- Cache keys **must** include `hotel_id`. Never cache tenant data under a tenant-agnostic key (`app/core/cache.py` already enforces fail-closed tenant identification — keep it).

## 3. Injection & input
- Use SQLModel/SQLAlchemy `select()` (parameterized). If you must use `text()`, **always** bind params (`:name`) — never f-string user input into SQL.
- Validate request bodies with Pydantic; never mass-assign `role`, `status`, `is_paid`, `total_amount`, `hotel_id` from the client.

## 4. Payments
- Amounts are **server-computed** from the booking (`booking.total_amount`), never from the client.
- Razorpay is **strict per-hotel** (no platform-global fallback). Missing keys → `503` and a clear guest-facing message.
- Keep idempotency (Redis `set_nx_ex`) on order-create/verify and guard on `status != CONFIRMED`.

## 5. Performance & scale
- **Pagination is mandatory** on list endpoints: `limit: int = Query(<default>, le=<cap>)` + `offset`. Never `select(...).all()` an unbounded tenant table.
- **Index hot columns**: foreign keys, `hotel_id`, dates, status, slug, email. Composite indexes for range queries (see `idx_bookings_dates`). Add via model `index=True` AND `CREATE INDEX IF NOT EXISTS` in `init_db` (deploys use `create_all`, not Alembic — keep both in sync).
- **No N+1**: batch with `selectinload` / a single `GROUP BY` / an `id IN (...)` map. Don't query inside a loop.
- **DB pool** is per-worker and env-driven (`DB_POOL_SIZE`/`DB_MAX_OVERFLOW`). Keep `DB_POOL_SIZE × WEB_CONCURRENCY × replicas ≤ Supabase connection limit`. Don't hardcode large pools.
- **Heavy imports** (pandas/matplotlib/reportlab) must be **lazy** (import inside the function), never at module top of an always-loaded router.
- Cache expensive aggregations in Redis with a sane TTL **and** invalidate them on writes (e.g. `_clear_booking_caches` must cover dashboard + `analytics_*` + reports).

## 6. AI / LLM cost (this is a real bill)
- Default to the **cheap model** (`llama-3.1-8b-instant` / Haiku-class). Reserve large models only for the hotelier analytics agent.
- Every agent: set `tool_call_limit`, `max_tool_calls_from_history`, `compress_tool_results=True`, and a `max_tokens` cap.
- Use `cache_response=True` (short TTL) on sales/guest bots; **not** on the live analytics agent.
- Public AI endpoints need a **per-hotel quota** (`_enforce_hotel_ai_quota`) on top of the IP limit (IP limit is spoofable).
- Record usage after every run with `app/core/ai_usage.record_ai_usage(hotel_id, result)`.
- Never stuff full DB dumps into the prompt; expose data via tools.

## 7. Reliability
- Background work: use `safe_background(bg, lambda: coro(), task_name=...)` — pass a **factory**, and remember `bg.add_task` takes a callable (not a called coroutine).
- Periodic jobs go through `app/core/scheduler.py` and **must** acquire the Redis lock (`_run_locked`) so they run on one instance only.
- Rate limiting is Redis-backed (`app/core/limiter.py`); use the trusted proxy hop, and add per-resource quotas for cost-bearing endpoints.
- SSE/streaming endpoints need a max lifetime and disconnect checks.

## 8. Logging, monitoring, privacy
- Log level is `LOG_LEVEL` env (prod: `WARNING`). **Never log PII** (emails, tokens, phone) at INFO; use DEBUG and prefer hashing/omission.
- Sentry: `send_default_pii=False` + the `before_send` scrubber. Don't ship request bodies/headers with secrets.
- `DEBUG` must be **false** in production. Docs (`/docs`, `/redoc`, `/openapi.json`) are DEBUG-only.

## 9. Workflow & repo conventions
- Backend: `backend/` (FastAPI). Frontend: `frontend/` (Vite/React). Run backend tests from `backend/` with `pytest`; build frontend with `npx vite build` to typecheck.
- Match existing style; comment **why**, not what. Keep the bilingual (Hinglish) comment style where present.
- Don't add dependencies unless needed; remove unused ones. Don't leave dead/scratch code.
- Don't delete the Chrome extension (`chrome_extension/`) — it's the rate-shopper scraping client.
- New env vars: add to `app/core/config.py` with a safe default and document them.

## 10. Definition of done
- [ ] Tenant-scoped & authz-gated (role/permission/feature as applicable)
- [ ] Inputs validated; amounts/roles/ids verified server-side
- [ ] Paginated + indexed; no N+1; caches invalidated
- [ ] LLM calls bounded & usage-tracked (if AI)
- [ ] No PII/secret in logs; no new lint/test failures
- [ ] `cd backend && pytest` green; frontend builds if touched

See also: `docs/SCALE_TUNING.md` (go-live sizing) and `docs/SECURITY_AUDIT_REPORT.md`.
