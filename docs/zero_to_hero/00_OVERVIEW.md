# 00 — OVERVIEW: Staybooker Kya Hai?

> Ye poori "Zero to Hero" series 8 files mein hai. Ye pehli file hai — bird's-eye view. Baaki files isi ke upar build karti hain.

---

## 1. Project Kya Hai?

**Staybooker** ek **multi-tenant hotel-booking SaaS** hai — matlab ek hi platform pe **multiple independent hotels** apna booking engine chala sakte hain, bilkul jaise Shopify pe multiple stores chalte hain.

**Problem jo ye solve karta hai:** Chhote-medium hotels ke paas apna khud ka booking website + admin panel + payment system + AI chatbot banane ke resources nahi hote. Staybooker unhe ek **ready-made hotel booking engine** deta hai:
- Ek public booking page (guests room search karke book kar sakte hain, jaise `staybooker.ai/book/hotel-name`)
- Ek admin dashboard (hotelier rooms, rates, bookings, payments manage karta hai)
- Ek Super Admin panel (Staybooker ki apni team saare hotels manage karti hai)

**Sabse important concept — Multi-tenancy:** Har hotel ka data (`hotel_id` se) poori tarah alag rehta hai. Hotel A kabhi bhi Hotel B ka data nahi dekh sakta. Ye poore codebase ka सबसे बड़ा security rule hai (Golden Rule #1 in CLAUDE.md).

---

## 2. Poora Tech Stack — Kya Use Hua Aur Kyun

### Frontend
| Tool | Kyun Chuna Gaya |
|---|---|
| **React 18** | Component-based UI, industry standard — reusable pieces (RoomCard, BookingsPage) bana sakte hain |
| **TypeScript** | Runtime error se pehle hi type-mismatch pakad leta hai (e.g. `booking.total_amount` ko string maan lena) |
| **Vite** | Fast dev server + fast production build (Webpack se bahut tez) |
| **TailwindCSS** | Utility classes se seedha JSX mein styling — alag CSS file nahi likhni padti |
| **shadcn/ui + Radix UI** | Pre-built accessible components (Dialog, Dropdown) jo customize kiye ja sakte hain — from scratch nahi banane padte |
| **TanStack Query (React Query)** | Server data ka caching + auto-refetch — bina isके हर page load पर redundant API calls lagte |
| **react-hook-form + zod** | Form state + validation ek saath, kam boilerplate |
| **Supabase JS SDK** | Login/signup/session Supabase Auth handle karta hai, frontend seedha use karta hai |
| **Recharts** | Analytics dashboard ke charts |
| **Framer Motion** | Smooth animations/transitions |
| **Sentry** | Frontend crash tracking |

### Backend
| Tool | Kyun Chuna Gaya |
|---|---|
| **Python 3.12 + FastAPI** | Async-first, auto-generated `/docs` (Swagger), bahut fast for I/O-heavy apps (DB/Redis/external API calls) |
| **SQLModel** | SQLAlchemy (DB ORM) + Pydantic (validation) ek hi class mein — do baar model nahi likhna padta |
| **asyncpg** | Async PostgreSQL driver — DB query ke time event loop block nahi hota |
| **Gunicorn + Uvicorn** | Production ASGI server, multiple worker processes |
| **Supabase Auth (JWT)** | Login/password Staybooker khud store nahi karta — Supabase karta hai, hum sirf JWT verify karte hain |
| **Redis** | Speed ke liye caching + rate limiting + idempotency keys. **Resilient fallback**: Redis down ho toh in-memory Python dict use hota hai (`RedisClient` class, `backend/app/core/cache/redis_client.py`) — app kabhi crash nahi hota |
| **Agno** (LLM agent framework) | Teeno AI agents isी pe bane hain — *nahi* LangChain pe (codebase mein LangChain ka koi trace nahi mila) |
| **Groq** (primary LLM provider) | Sabse sasta + fast LLM hosting; `llama-3.1-8b-instant` cheap tasks ke liye, `llama-3.3-70b-versatile` hotelier analytics agent ke liye |
| **Razorpay** | Indian payment gateway (UPI, cards, netbanking) |
| **Brevo (Sendinblue)** | Transactional emails (booking confirmation) |
| **slowapi** | Rate limiting (per-IP, per-user) |
| **Sentry** | Backend error tracking |

### Database & Infra
| Tool | Role |
|---|---|
| **PostgreSQL (Supabase-hosted)** | Primary database — 42 tables |
| **Supabase Auth** | Identity provider — JWT issue karta hai |
| **Supabase Vault** | AES-256-GCM encrypted secrets storage (Razorpay secret, WhatsApp key, SMTP password) |
| **Redis (Railway)** | Cache + rate-limit + session tracking |
| **Railway** | Backend hosting |
| **Cloudflare Pages** | Frontend hosting |

---

## 3. Folder Structure — Poora Tree

> ⚠️ Important: Purani docs (`STAYBOOKER_DOCS.md`) mein `backend/app/api/v1/<domain>.py` wala structure likha hai — **wo purana/stale hai**. Asli current structure neeche hai (verified by reading actual files).

### Backend (`/backend`)
```
backend/
├── main.py                     ← FastAPI app yahan se start hota hai. Saare routers yahan register hote hain (main.py:187-221)
├── app/
│   ├── auth/                   ← Onboarding endpoint (login khud Supabase karta hai, backend route nahi)
│   ├── guests/                 ← User model (users.py) aur guest-facing team-member endpoints
│   ├── brand_console/          ← Hotel model, hotel settings, multi-property switching, marketing leads
│   ├── rooms/                  ← Room types, amenities
│   ├── bookings/               ← Booking model, guest model, booking CRUD, timeline (audit trail)
│   ├── payments/               ← Payment records, refunds
│   ├── rate_plans/             ← Rate plans, daily room rates, promo codes
│   ├── calendar/               ← Availability grid, room blocks, bulk rate upload (split: helpers.py/read.py/write.py)
│   ├── dashboard/               ← Dashboard stats, in-app notifications
│   ├── analytics/              ← Visitor tracking, revenue/occupancy dashboards, public shareable reports
│   ├── revenue/                ← Dynamic pricing rules, abandoned-booking recovery
│   ├── rate_shopper/            ← Competitor price scraping
│   ├── loyalty/                ← Loyalty program, points wallet, stay-offers
│   ├── channel_manager/         ← OTA (Channex) sync settings
│   ├── integration/             ← Widget config, API keys, Google OAuth/Reviews, WhatsApp webhook
│   ├── experiences/              ← Add-on services (breakfast, spa)
│   ├── marketing/                ← Google Hotel Ads XML feeds
│   ├── google_reviews/           ← Google review sync + social-proof widget data
│   ├── guest_booking/             ← 🌍 PUBLIC guest-facing endpoints — NO auth. Hotels/rooms search, bookings, payments, AI chat, SSE
│   ├── ai_assistant/              ← Hotelier-facing AI agent's HTTP routes + usage accounting
│   ├── ai_engine/                 ← The actual 3 AI agents' brains (guest_agent.py, global_agent.py, agent.py) + their tools
│   ├── superadmin/                ← 🔒 SUPER_ADMIN only — hotels list, users, chain dashboard (much of this folder's sub-routers were trimmed/unmounted in June 2026, see 03_ALL_API_ENDPOINTS.md)
│   ├── system/                    ← Legacy admin routes, file upload, WebSocket (real-time dashboard push)
│   ├── services/                  ← Email service (Brevo)
│   └── core/                      ← Cross-cutting infra (see below)
│       ├── auth/                  ← deps.py (JWT verify + RBAC), security.py, sensitive_fields.py (masking), vault.py (Supabase Vault)
│       ├── cache/                  ← redis_client.py (resilient Redis+fallback), cache.py (@cache_response decorator)
│       ├── db/                     ← database.py (init_db + migrations), supabase.py (JWT/JWKS verify)
│       └── utils/                  ← config.py (env vars), limiter.py (rate limiting), exceptions.py, feature_flags.py, scheduler.py, tasks.py
├── alembic/ + database/alembic/    ← Migration history (mostly historical — actual deploys run ALTER TABLE patches inside init_db(), see 04_DATABASE_SCHEMA.md)
└── tests/                          ← pytest test suite
```

### Frontend (`/frontend/src`)
```
frontend/src/
├── App.tsx                     ← SAARE ROUTES yahan defined hain (50 <Route> tags). Yahin se start karo.
├── main.tsx                    ← React app entry point
├── core/
│   ├── api/client.ts            ← apiClient — HAR API call yahan se guzarta hai, auto token attach karta hai
│   ├── api/auth.ts               ← authApi — login/signup/user helpers
│   ├── contexts/AuthContext.tsx  ← WHO IS LOGGED IN — user, hotel, login(), logout()
│   └── hooks/                    ← useHotelWebSocket, use-toast, use-mobile, etc.
├── auth/                        ← Login, RequestAccess (signup nahi — see 05_AUTH_AND_SECURITY.md), ForgotPassword, ResetPassword
├── dashboard/                   ← Main hotelier dashboard
├── rooms/                       ← Room type management + RoomCard component
├── bookings/                    ← Bookings list + guest database
├── finance/                     ← Rates, payments, taxes
├── revenue/                     ← Dynamic pricing, abandoned-booking recovery
├── marketing/                   ← Add-ons, rate shopper, Google reviews, loyalty program
├── analytics/                   ← AnalyticsDashboard
├── reports/                     ← Occupancy/revenue reports, PublicReport (shareable, no login)
├── chain/                       ← Multi-property chain dashboard
├── admin/                       ← Legacy simple admin page
├── superadmin/                  ← Super Admin panel (hotels/users/provisioning)
├── settings/                    ← Hotel settings tabs
├── agent/                       ← AI chatbot test page
├── guest_booking/                ← 🌍 GUEST-FACING pages — room search, checkout, confirmation, cancel, embeddable widget/chat
├── components/
│   ├── ui/                       ← shadcn/ui primitives (33 files) — don't hand-roll new ones
│   ├── common/                    ← ImageUpload, VideoUploader (reused ~21 files)
│   └── layout/                    ← DashboardLayout (auth-gate + role-gate lives HERE, not a separate ProtectedRoute), AppSidebar, AppHeader, PageShell
```

---

## 4. Counts (Verified From Actual Code)

| Metric | Count | Source |
|---|---|---|
| **Total backend API endpoints** | **198** route decorators (`@router.get/post/put/patch/delete/websocket`) | grep across `backend/app/` |
| — of which actually reachable | **196** (2 are dead code in `superadmin/platform/sessions.py`, router never mounted) | `main.py` include_router audit |
| **Total database tables** | **42** SQLModel tables with `table=True` | see `04_DATABASE_SCHEMA.md` |
| **Total frontend routes** | **50** `<Route>` entries in `App.tsx` (26 authenticated hotelier + 5 auth + 4 superadmin-subdomain + ~9 guest-booking + a few fallback/redirect) | `frontend/src/App.tsx` |
| **Page-level frontend components** | **~40** across domain folders (not counting `components/ui` primitives) | frontend research |
| **AI agents** | **3** — Guest Concierge, Global (WhatsApp router), Hotelier Team agent | see `06_AI_AGENTS_EXPLAINED.md` |

---

## 5. Next Files Mein Kya Hai

1. `01_FASTAPI_FUNDAMENTALS_FROM_MY_CODE.md` — FastAPI zero se, apne code ke examples se
2. `02_REACT_FUNDAMENTALS_FROM_MY_CODE.md` — React zero se, apne code ke examples se
3. `03_ALL_API_ENDPOINTS.md` — Har endpoint ki table
4. `04_DATABASE_SCHEMA.md` — Har table, columns, relationships
5. `05_AUTH_AND_SECURITY.md` — Login flow, JWT, RBAC, webhook security
6. `06_AI_AGENTS_EXPLAINED.md` — Teeno AI agents
7. `07_LEARNING_ROADMAP.md` — Kya seekhna hai, kis order mein, interview Q&A
