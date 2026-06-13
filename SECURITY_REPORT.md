Severity: HIGH

Issue:
IDOR in Promo Code Validation.

Impact:
Revenue loss. A hotel could potentially apply a promo code from another hotel if neither hotel belonged to a chain (null chain_id comparison).

Location:
backend/app/api/v1/promos.py

Recommendation:
[FIXED] Refactored the validation query to use an explicit list of allowed hotel/chain IDs instead of a broad OR condition that could match null values across tenants.

---

Severity: MEDIUM

Issue:
Redis-backed Rate Limiting Reliability.

Impact:
Rate limit bypass. If Redis is unavailable, the system falls back to in-memory limiting which is reset on process restart and not shared across workers.

Location:
backend/app/core/limiter.py

Recommendation:
Ensure Redis is configured in High Availability (HA) mode for production to ensure consistent rate limiting and payment idempotency.
