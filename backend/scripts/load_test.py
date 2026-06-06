#!/usr/bin/env python3
"""
Simple async load tester for the Staybooker public API.

Simulates many concurrent guests hitting the read-heavy public endpoints
(hotel details + room availability) and reports latency percentiles, RPS and
error rate — so you can find where it breaks BEFORE go-live.

Usage:
    python scripts/load_test.py \
        --base-url https://api.staybooker.ai \
        --slug my-hotel-slug \
        --concurrency 100 \
        --requests 2000

Tips:
  - Start low (concurrency 20) and ramp up; watch the superadmin health
    `infra.utilization_pct` (DB pool) and Railway CPU/RAM as you go.
  - Run against STAGING, not production. Read-only endpoints by default; pass
    --include-chat to also exercise the (LLM-backed) guest chat — costs tokens.
"""
import argparse
import asyncio
import time
from statistics import median

import httpx


def _percentile(values, pct):
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round((pct / 100) * (len(s) - 1)))))
    return s[k]


async def _worker(client, base, slug, endpoints, n, latencies, errors):
    for i in range(n):
        path = endpoints[i % len(endpoints)]
        url = f"{base}{path.format(slug=slug)}"
        t0 = time.perf_counter()
        try:
            r = await client.get(url)
            latencies.append((time.perf_counter() - t0) * 1000)
            if r.status_code >= 400:
                errors.append(r.status_code)
        except Exception as e:  # noqa: BLE001
            errors.append(type(e).__name__)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True, help="e.g. https://api-staging.staybooker.ai")
    ap.add_argument("--slug", required=True, help="a real public hotel slug")
    ap.add_argument("--concurrency", type=int, default=50)
    ap.add_argument("--requests", type=int, default=1000, help="total requests across all workers")
    ap.add_argument("--include-chat", action="store_true", help="also hit the LLM guest chat (costs tokens)")
    args = ap.parse_args()

    base = args.base_url.rstrip("/")
    endpoints = [
        "/api/v1/public/hotels/slug/{slug}",
        "/api/v1/public/hotels/slug/{slug}/widget-config",
    ]

    per_worker = max(1, args.requests // args.concurrency)
    total = per_worker * args.concurrency
    latencies: list[float] = []
    errors: list = []

    print(f"Load test -> {base}  slug={args.slug}")
    print(f"concurrency={args.concurrency}  total_requests={total}  endpoints={len(endpoints)}")

    limits = httpx.Limits(max_connections=args.concurrency, max_keepalive_connections=args.concurrency)
    async with httpx.AsyncClient(timeout=30, limits=limits) as client:
        t0 = time.perf_counter()
        await asyncio.gather(*[
            _worker(client, base, args.slug, endpoints, per_worker, latencies, errors)
            for _ in range(args.concurrency)
        ])
        elapsed = time.perf_counter() - t0

    ok = len(latencies)
    print("\n--- Results ---")
    print(f"completed:     {ok}/{total}")
    print(f"errors:        {len(errors)} ({(len(errors)/total*100 if total else 0):.1f}%)")
    if errors:
        from collections import Counter
        print(f"error breakdown: {dict(Counter(errors))}")
    print(f"duration:      {elapsed:.2f}s")
    print(f"throughput:    {ok/elapsed:.0f} req/s" if elapsed else "")
    if latencies:
        print(f"latency ms:    p50={median(latencies):.0f}  p90={_percentile(latencies,90):.0f}  "
              f"p99={_percentile(latencies,99):.0f}  max={max(latencies):.0f}")

    if args.include_chat:
        print("\n(chat load test not included in this minimal script — enable carefully; it bills LLM tokens)")


if __name__ == "__main__":
    asyncio.run(main())
