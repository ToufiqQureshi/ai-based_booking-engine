# Comprehensive Project Analysis & Audit

## 1. API Spam & Security Issues
- **Frontend Button Spam:** Found in `Integration.tsx`, `Dashboard.tsx`, and `GoogleReviews.tsx`. Multiple clicks on "Save", "Generate AI", or "Connect" buttons trigger multiple API requests.
  - **Proposed Fix:** Add `isLoading` states to all primary action buttons and disable them until the request completes.
- **Payment Double Charging:** `BookingCheckout.tsx` doesn't prevent multiple clicks on the "Pay" button.
  - **Proposed Fix:** Add a global `isSubmitting` state to the checkout flow and implement backend idempotency using a `payment_intent_id` or similar.
- **Missing Rate Limiting:** While `SlowAPI` is initialized, it's missing on several high-risk endpoints:
  - `google/reviews` (spam potential)
  - `chat/guest` (LLM cost/abuse protection)
  - `whatsapp/webhook` (Meta webhook stability)
- **Feature Flag Enforcement:** Backend needs to strictly check `hotel.feature_*` flags before executing logic (e.g., Guest AI, Rate Shopper).

## 2. Redis & Caching Strategy
- **Redis Connectivity:** Issues reported with caching "not working".
  - **Findings:** `RedisClient` has a local memory fallback, but many routes are missing `@cache_response` or manual `redis_client.get_value` calls.
  - **Inconsistency:** Some routes use `redis_client`, others don't. Some use `cache_response` decorator, others manual JSON serialization.
  - **Fix:** Standardize caching across `Dashboard`, `Analytics`, and `Integration` routes. Ensure `hotel_id` is always part of the key.
- **Accurate Public Data:** `public/rooms.py` has caching removed for "instant updates," which is good for accuracy but bad for performance.
  - **Proposed Fix:** Implement short-lived (e.g., 30s) caching or smarter invalidation when bookings/blocks are created.

## 3. Razorpay Integration
- **Broken State:** User reported Razorpay is not working.
- **Findings:**
  - Python 3.12+ header patch is present but might not be correctly applied in all contexts.
  - Verification logic in `backend/app/api/v1/public/payments.py` needs a thorough test.
  - Frontend checkout flow might be failing during script load or order creation.

## 4. Dead Code & Refactoring
- **Monolithic Files:**
  - `SuperAdminDashboard.tsx` (2500+ lines) -> Needs splitting into Tabs/Components.
  - `Integration.tsx` (1100+ lines) -> Split into Widget, API, WhatsApp, AI components.
- **Backend Cleanup:**
  - `public.py` (if it still exists in old form) or split modules have redundant resolve logic.
  - Unused imports and commented-out debugging code found in `integration.py` and `dashboard.py`.
- **Typing:** Extensive use of `any` in `AnalyticsDashboard.tsx` and `BookingSelection.tsx`.

## 5. Feature Audit
- **WhatsApp Agent:** Needs verification of session mapping (Central vs. Hotel specific) and credit checks.
- **Analytics:** Data fetching for "Live Events" might be too aggressive (polling every 12s).
- **Google Reviews:** OAuth flow needs to ensure absolute isolation between different hotel accounts.

---
*Created by Jules — Senior Software Engineer*
