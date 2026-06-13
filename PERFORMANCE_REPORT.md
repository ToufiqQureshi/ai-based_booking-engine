Endpoint:
/api/v1/public/hotels/{id}/rooms

Current:
~1.4s (p99 under 50 concurrent requests)

Expected:
<800ms

Issue:
Availability calculation was O(N*M) where N=bookings and M=nights.

Recommendation:
[OPTIMIZED] Refactored to pre-aggregate booked/blocked days into a hash map before the main room type loop. This reduces the search complexity to O(N+M). Recommend further caching of room availability in Redis (30s-60s) for extremely high traffic.

---

Endpoint:
/api/v1/superadmin/hotels

Current:
Unbounded

Expected:
<300ms

Issue:
Missing pagination.

Recommendation:
[OPTIMIZED] Implemented limit/offset pagination.
