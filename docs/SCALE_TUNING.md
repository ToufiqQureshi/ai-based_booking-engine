# Go-Live & Scale Tuning Guide

Practical settings for running Staybooker reliably. The hotel *count* matters
less than **concurrent traffic**. 100 low-traffic hotels are light; 10 hotels
all taking bookings during a sale is the real test.

## The #1 crash risk: database connections

Postgres/Supabase has a hard connection limit. The app opens:

```
total_connections = DB_POOL_SIZE × WEB_CONCURRENCY × replicas        (+ overflow)
```

**Rule:** keep `(DB_POOL_SIZE + DB_MAX_OVERFLOW) × WEB_CONCURRENCY × replicas`
**below** your Supabase connection limit (and leave headroom for migrations,
the SQL editor, and other clients).

Defaults (per worker): `DB_POOL_SIZE=5`, `DB_MAX_OVERFLOW=5` → up to 10/worker.

| Supabase pooler limit | WEB_CONCURRENCY | replicas | DB_POOL_SIZE | DB_MAX_OVERFLOW | peak conns |
|---|---|---|---|---|---|
| ~15 (free)   | 1 | 1 | 5  | 5  | 10 |
| ~60 (small)  | 2 | 1 | 8  | 6  | 28 |
| ~60 (small)  | 2 | 2 | 5  | 5  | 40 |
| 200+ (pro)   | 4 | 2 | 8  | 6  | 112 |

> Use the **Supabase connection pooler (pgbouncer, transaction mode)** URL. The
> app already disables prepared-statement caching for it.

All env vars (set in Railway):
- `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_RECYCLE` (default 300s), `DB_POOL_TIMEOUT`
- `WEB_CONCURRENCY` — gunicorn workers (root Dockerfile), default 2
- `PORT` — set by Railway automatically

**Watch it live:** Super Admin → Health → `infra` block shows
`checked_out / capacity` and `utilization_pct`. Startup logs print the
effective pool config. If utilization sits near 100%, lower concurrency or
raise the plan — don't just enlarge the pool past the Supabase limit.

## Memory (RAM)

- Heavy libs (pandas/matplotlib/reportlab) are **lazy-loaded** now, so idle
  RSS is small. Each gunicorn worker is a full process — more workers = more RAM.
- 1 GB Railway box: `WEB_CONCURRENCY=1–2`. Bigger box: scale up workers, then
  add replicas. Both are env-driven; no code change.

## Throughput knobs (no code change)
- Vertical: raise `WEB_CONCURRENCY` (bounded by RAM and the DB-connection math).
- Horizontal: add Railway replicas (then re-check the DB-connection math).
- Redis: a single instance is fine for 100s of hotels; make it HA before
  relying on it for payment idempotency.

## Background jobs
- The scheduler (`ENABLE_SCHEDULER=true`, default) runs social-proof refresh
  (15 min) and subscription-expiry (24 h), guarded by a Redis lock so only one
  instance runs each tick. Safe with multiple workers/replicas.
- Set `ENABLE_SCHEDULER=false` on replicas if you prefer an external cron
  hitting `POST /api/v1/superadmin/cron/check-expiry`.

## AI / LLM cost
- Cheap model by default; `tool_call_limit`, `compress_tool_results`,
  `cache_response`, output caps, and a **per-hotel daily quota** are in place.
- Monitor per-hotel spend via Redis keys `ai_tokens:{hotel_id}:{YYYYMMDD}`.

## Logging / monitoring
- `LOG_LEVEL=WARNING` in production (less PII, less egress cost).
- `DEBUG=false` in production (also hides `/docs`).
- Configure `SENTRY_DSN`; PII scrubbing is already on.

## Pre-go-live checklist
- [ ] Supabase **pooler** URL in `DATABASE_URL`; pool math under the limit
- [ ] `DEBUG=false`, `LOG_LEVEL=WARNING`, `SENTRY_DSN` set
- [ ] Each active hotel has its **own Razorpay keys** (Super Admin → Integrations)
- [ ] `RAZORPAY_KEY_ID/SECRET` removed from env (strict per-hotel); keep `RAZORPAY_WEBHOOK_SECRET`
- [ ] `MASTER_ADMIN_EMAILS` set; Supabase signup restricted as intended
- [ ] Run `scripts/load_test.py` against **staging** at expected peak concurrency
- [ ] Watch Health `infra.utilization_pct` + Railway CPU/RAM during the load test

## Load testing
```bash
cd backend
python scripts/load_test.py --base-url https://api-staging.staybooker.ai \
    --slug <real-slug> --concurrency 100 --requests 3000
```
Ramp concurrency up gradually; stop when p99 latency or DB utilization spikes —
that's your ceiling for the current settings.
