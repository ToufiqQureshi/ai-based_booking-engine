Severity: HIGH

Issue:
Incorrect availability logic for consecutive bookings.

Impact:
Loss of revenue. The system incorrectly marked rooms as sold-out when multiple non-conflicting bookings existed within a requested date range (e.g., Guest A stays Day 1-2, Guest B stays Day 2-3, Guest C searches for Day 1-3).

Location:
backend/app/api/v1/public/rooms.py

Recommendation:
[FIXED] Implemented day-by-day availability checking with pre-aggregated booked/blocked counters.

---

Severity: MEDIUM

Issue:
Missing pagination on Super Admin hotel and user lists.

Impact:
System instability/OOM at scale. Fetching 100+ hotels or 1000+ users in a single query would lead to slow responses and potential worker crashes.

Location:
backend/app/api/v1/superadmin/hotels.py, backend/app/api/v1/superadmin/users.py

Recommendation:
[FIXED] Added limit/offset pagination to both endpoints with a maximum cap of 500 records per page.
