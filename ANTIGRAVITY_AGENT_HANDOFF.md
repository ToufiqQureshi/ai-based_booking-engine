# Antigravity AI — Staybooker Full Codebase Handoff

Product: Staybooker (AI hotel booking engine + light PMS)
Repo: ai-based-booking-engine-for-hotels- / hotelier-hub
Stack: React 18 + Vite + TypeScript | FastAPI + SQLModel + PostgreSQL + Redis | Chrome MV3 extension

Live: staybooker.ai (frontend) + Railway API. Local dev: frontend :8080, backend :8001, Vite proxies /api → 8001.

---

## SAFETY — DO NOT BREAK

- Supabase auth in backend/app/api/deps.py (JWT, Redis cache, auto hotel heal)
- bookings.py with_for_update() on room inventory
- Public routes /book/:slug/* and /api/v1/public/*
- API JSON shapes (BookingRead, PublicRoomSearchResult, ChatResponse, GuestChatResponse)
- No DROP migrations, no editing applied alembic versions
- Production uses VITE_API_URL or staybooker.ai hostname — not localhost:8000

Human wants fixes in ONE PR when possible. Skip unless approved: P0-4 bulk DB flag migration, payment gateway, deps.py auth rewrite.

---

## FILES TO REDUCE (LINE COUNT TARGETS)

Priority = maintainability. Extract only; do not change UX or API contracts.

TIER 1 — Must split (1500+ lines or god-file)

1) frontend/src/pages/public/BookingSelection.tsx — ~1535 lines (repo scan)
   Problem: Entire guest room search, calendar, filters, cart, modals, icons in one file.
   Target: Page under 400 lines. Extract to frontend/src/components/public/booking/:
     - RoomSearchHeader.tsx (dates, guests, search button)
     - RoomCard.tsx
     - RoomFiltersSort.tsx
     - BookingCartSheet.tsx
     - RateSelectDialog.tsx (if inline today)
   Also: Move ICONS map lines 49-79 to frontend/src/lib/amenityIcons.ts
   Keep: state + API calls in BookingSelection or a thin useBookingSearch hook.
   Risk: Med — test /book/{slug}/rooms end-to-end after split.

2) frontend/src/pages/superadmin/SuperAdminDashboard.tsx — ~2551 lines (repo scan, largest file)
   Problem: Largest file in repo. Super admin UI monolith.
   Target: Split by tabs: HotelsList, SubscriptionsPanel, FeatureFlagsPanel, AnalyticsPanel.
   Note: Human may deprioritize — only split if tasked. Do not break superadmin subdomain routing.

3) backend/app/api/v1/public.py — ~989 lines (repo scan)
   Problem: Public search, booking create, promos, guest chat all in one router.
   Target: Split into modules under backend/app/api/v1/public/:
     - search.py (room search)
     - booking.py (create/cancel)
     - chat.py (guest AI)
   Re-export router from public/__init__.py or include sub-routers in main.
   Risk: Med — highest traffic path for guests.

TIER 2 — Should refactor (500-800 lines)

4) backend/app/core/agent.py — 635 lines
   Problem: All LangGraph hotelier tools inline.
   Target: Tools already partially in app/core/tools/ — move remaining @tool functions to tools/operations.py, tools/reporting.py. Keep create_agent_executor in agent.py under 150 lines.

5) frontend/src/pages/public/BookingCheckout.tsx — 629 lines
   Target: Extract GuestForm, PaymentSummary, BookingReview components.

6) backend/app/api/v1/superadmin.py — 772 lines
   Target: Extract plan_features loader to backend/app/core/plan_features_loader.py. Keep routes thin.

7) frontend/src/pages/marketing/RatesShopper.tsx — 545 lines, 22 uses of `any`
   Target: Typed API responses + split chart/table components.

8) backend/app/api/v1/competitors.py — 499 lines
   Target: scrape/ingest logic to services/competitor_service.py

TIER 3 — Smaller cleanups

9) backend/app/api/v1/agent.py — 59 lines route only; logic in agent.py core
10) frontend/src/pages/public/BookingWidget.tsx — 964 lines (repo scan) — split like BookingSelection; embed/widget flow
11) frontend/src/pages/settings/Settings.tsx — 906 lines
12) frontend/src/pages/settings/Integration.tsx — 903 lines
13) frontend/src/components/public/ChatWidget.tsx — 548 lines

---

## BUGS AND GAPS (BY AREA)

### A) Config / Deploy

FILE: frontend/src/api/client.ts lines 7-16
PROBLEM: Local fallback http://localhost:8000/api/v1 — backend is 8001; breaks dev without VITE_API_URL.
FIX: Fallback to /api/v1 (Vite proxy). Keep VITE_API_URL and staybooker.ai / railway blocks.

FILE: backend/Dockerfile line 30
PROBLEM: PORT default 8080 collides with frontend.
FIX: PORT:-8001

FILE: frontend/vite.config.ts lines 10-14
STATUS: Correct — proxy /api → 127.0.0.1:8001. Do not remove.

### B) Security — SaaS feature flags (API not enforced)

UI hides features in DashboardLayout.tsx, AppSidebar.tsx, AgentPage.tsx, Integration.tsx — but API is open.

FILE: backend/app/api/v1/agent.py — POST /agent/chat (lines 18-58)
MISSING: Check hotel.feature_ai_agent before create_agent_executor. Return 403 if false.

FILE: backend/app/api/v1/public.py — POST /chat/guest (lines 771+)
MISSING: After hotel resolved (~795), if not hotel.feature_guest_bot → 403.
NOTE: Docstring line 778 says RAG — incorrect; fix comment only.

FILE: backend/app/api/v1/competitors.py — list/add/scrape routes
MISSING: Load hotel by current_user.hotel_id; if not feature_rate_shopper → 403.
NOTE: Line 74 is ownership 403 only, not plan feature.

FILE: backend/app/models/hotel.py lines 89-95
PROBLEM: feature_* default True; plan_features.json Free tier has false — new hotels over-provisioned.

FILE: backend/app/api/v1/superadmin.py lines 23-51 load_plan_features()
PROBLEM: Duplicate hardcoded Free/Basic/Premium/Enterprise dict when JSON fails — drift from backend/app/core/plan_features.json
FIX: JSON only; on failure return {} or HTTP 500. File path: backend/app/core/plan_features.json

### C) Backend performance / quality

FILE: backend/app/api/v1/payments.py lines 14-52
PROBLEM: N+1 — loop queries Booking and Guest per payment.
FIX: selectinload(Payment.booking).selectinload(Booking.guest) — Payment has no .guest relation.

FILE: backend/app/api/v1/channel_manager.py line 164
PROBLEM: bare except:
FIX: except JSONDecodeError etc + log

FILE: backend/app/api/v1/public.py lines 327, 335-336, 787
PROBLEM: silent pass; line 335 empty loop with pass
FIX: logger.warning; remove dead debug loop

FILE: backend/app/api/v1/agent.py line 57
PROBLEM: print() for errors
FIX: logger.error

FILE: backend/app/api/v1/competitors.py lines 59-64
PROBLEM: print + pass placeholder scrape — document or implement

FILE: backend/app/api/deps.py
STATUS: Critical — do not refactor without tests

FILE: backend/app/api/v1/bookings.py line 277
PROBLEM: pass in except — review if errors swallowed

### D) Frontend types

~90+ `any` usages across src. Worst files:
- BookingSelection.tsx (~10)
- SuperAdminDashboard.tsx (~13)
- RatesShopper.tsx (~22)
- BookingWidget.tsx (~8)
FIX: Use frontend/src/types/api.ts incrementally when touching files.

### E) Payments product gap

FILE: backend/app/api/v1/payments.py + frontend/src/pages/finance/Payments.tsx
REALITY: Manual payment ledger only. No Razorpay/Stripe. Separate epic — do not fake gateway in small PR.

### F) Testing

PROBLEM: Zero pytest / vitest files in repo.
FIX: backend/tests/ with sqlite+aiosqlite:///:memory: in conftest; test /health, 401 protected route, public 404.
Script exists: scripts/e2e_full_check.py — run after changes.

### G) Chrome extension

FILE: chrome_extension/manifest.json — content_scripts all_urls too broad
FILE: host_permissions still gadget4me.in — align to staybooker.ai additively

### H) Docs drift

STAYBOOKER_MASTER_SPECIFICATION.md claims pgvector RAG — not implemented. guest_agent uses tools + LLM only.

---

## WHAT IS GOOD (KEEP)

- Multi-tenant hotel_id scoping
- booking with_for_update
- OWASP headers in main.py
- SlowAPI rate limit
- Redis slug cache in public.py
- LangGraph split hotelier vs guest read-only agent
- docker-compose healthchecks
- plan_features.json exists at backend/app/core/plan_features.json
- superadmin.py exists and is registered in main.py line 164

---

## WORK ORDER (ONE PR)

Step 1  client.ts /api/v1 fallback
Step 2  Dockerfile PORT 8001
Step 3  403 guards agent.py public guest chat competitors.py
Step 4  logging channel_manager public agent
Step 5  payments selectinload
Step 6  superadmin load_plan_features dedupe (remove lines 30-50 fallback dict)
Step 7  backend/tests smoke
Step 8  BookingSelection.tsx split (Tier 1)
Step 9  index.html SEO, extension permissions
Step 10 npm run build + manual checklist

Skip: P0-4 mass DB update, gateway, SuperAdminDashboard split unless asked.

---

## VERIFY AFTER CHANGES

cd backend && uvicorn main:app --port 8001
curl http://127.0.0.1:8001/health
cd frontend && npm run dev  # :8080
npm run build
python scripts/e2e_full_check.py

Manual: login, /book/{slug}/rooms, agent 403 when feature off, booking create from dashboard.

---

## KEY PATHS QUICK MAP

Auth: deps.py, auth.py
Public guest: public.py, BookingSelection.tsx, BookingCheckout.tsx
Hotelier AI: agent.py (route), core/agent.py (graph)
Guest AI: public.py /chat/guest, guest_agent.py, ChatWidget.tsx
Rates: rates.py, availability.py, competitors.py
Admin hotel: admin.py (NOT superadmin plan JSON)
Super admin: superadmin.py, SuperAdminDashboard.tsx, subdomain.ts
Plans: plan_features.json, superadmin.py load_plan_features

---

End of Antigravity handoff. Update when items closed.
