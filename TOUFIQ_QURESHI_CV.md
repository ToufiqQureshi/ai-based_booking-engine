# TOUFIQ QURESHI

**+91-9665458841** | **toufiqqureshi651@gmail.com** | **linkedin.com/in/toufiq-qureshi** | **github.com/ToufiqQureshi**

---

## PROFESSIONAL SUMMARY

AI Engineer and Full-Stack Developer who designed, built, and shipped **Staybooker** — a production-grade multi-tenant hotel booking SaaS — end-to-end from database schema to CI/CD pipeline. The platform runs on FastAPI + React 18 + Supabase PostgreSQL + Redis across 49 REST API routers, 33 normalized PostgreSQL tables, and a 3-agent Agno AI system powered by Groq LLMs. Hands-on across agentic LLM engineering, dynamic pricing algorithms, OTA channel management, real payment processing (Razorpay), and cloud-native deployment (Railway + Cloudflare Pages). Strong emphasis on multi-tenant security (IDOR prevention, HMAC webhook verification), production resilience (Redis fallback, idempotent webhooks), and test-driven development (56 pytest files, GitHub Actions CI with SAST).

---

## TECHNICAL PROJECT

### Staybooker — AI-Powered Multi-Tenant Hotel Booking SaaS
**FastAPI · Python · React 18 · TypeScript · Supabase PostgreSQL · Redis · Agno · Groq · Razorpay · WhatsApp Business API · GitHub Actions · Cloudflare Pages · Railway**
**Oct 2024 – Present**

#### Backend Architecture & Multi-Tenancy

- Architected a production multi-tenant SaaS backend across **24 domain modules** and **49 FastAPI routers** backed by **33 PostgreSQL tables** (SQLModel + SQLAlchemy async), enforcing strict per-hotel data isolation (IDOR prevention) across bookings, rooms, guests, payments, loyalty, analytics, and channel management
- Implemented **Supabase JWT authentication** with Redis-cached token validation (TTL-capped at token expiry to prevent replay attacks) and **4-tier RBAC** (SUPER_ADMIN / OWNER / MANAGER / STAFF) enforced via `require_hotel_role()` dependency guards on every protected endpoint
- Engineered a **resilient Redis caching layer** with automatic in-memory dict fallback on Redis failure — zero-downtime on cache outage — covering availability queries, distributed payment idempotency locks (SET NX EX), rate-limit state, and AI tool result caching (300 s TTL); follows the expand-contract migration pattern for zero-downtime schema changes
- Implemented **distributed rate limiting** via SlowAPI backed by Redis with real-IP detection (X-Forwarded-For parsing, configurable trusted proxy count) to block IP-spoofed abuse on public booking and payment endpoints

#### AI Agents & LLM Engineering

- Built a **3-agent AI system** on the Agno framework (`agno.agent.Agent`, `agno.team.Team`): a **30-tool hotelier analytics copilot** (Groq `llama-3.3-70b-versatile`) with dynamic per-query tool selection to minimize token costs; a **guest concierge bot** (`llama-3.1-8b-instant`) for the public booking portal; and a **WhatsApp sales agent** for conversational booking flows — all with per-hotel token quotas enforced via Redis and usage tracked to PostgreSQL via `record_ai_usage()`
- Engineered **8 AI tool modules (40+ tools)** spanning: revenue analytics (RevPAR / ADR trends, occupancy forecasting, revenue forecast), operations (booking search and cancellation), finance (pending payment tracking), smart alerts (at-risk booking detection, VIP guest identification, upsell opportunity scoring), real-time weather + local events API integration for pricing context, and automated PDF report generation
- Implemented Redis-backed AI tool result caching (300 s TTL) cutting redundant LLM tool-call latency and duplicate DB queries on repeated agent requests; applied `tool_call_limit`, `max_tokens`, and `compress_tool_results=True` guards to bound LLM spend per request

#### Revenue Management & Dynamic Pricing

- Built a **deterministic dynamic pricing engine** supporting 4 rule types (occupancy-based, day-of-week, lead-time, seasonal date ranges) with priority-based rule stacking, min/max price guard rails, and a full adjustment audit trail — deterministic and safe for high-frequency availability queries
- Shipped an **abandoned booking recovery module** dispatching WhatsApp + email nudges via Meta Graph API, with idempotency via `recovery_sent_at` timestamp to prevent double-messaging on retry
- Integrated a **Rate Shopper module** (up to 5 competitor hotels per property) with background scraping, rate-comparison endpoints, and status monitoring for competitive pricing intelligence
- Implemented **RevPAR, ADR, occupancy rate, and revenue forecasting** analytics endpoints powering interactive Recharts dashboards consumed by the React frontend

#### Payments, Webhooks & Security

- Integrated **Razorpay** with server-side amount computation (never derived from client input), full and partial refund APIs, **HMAC-SHA256 webhook signature verification**, and idempotent event processing (unique transaction ID DB constraint) to prevent double-charges on webhook retries
- Verified **WhatsApp Business API webhooks** via Meta X-Hub-Signature-256 HMAC before processing; built inbound message pipeline routing guest queries to the AI agent for automated concierge responses
- Enforced that payment amounts, booking statuses, hotel IDs, and user roles are always **server-computed** — never derived from client input — across all 49 endpoints; secrets in `hotel.settings` masked via `sensitive_fields.py` and never returned raw

#### Integrations & Channel Management

- Built **Channel Manager** with OTA room-type mappings (Channex integration), inventory sync, and channel logging — enabling multi-platform distribution from a single room inventory
- Integrated **Google Business Profile** (OAuth token management, location sync), **Google Hotel Ads** (ARI availability and rates sync), and **Google Reviews** aggregation for social proof display
- Wired **WhatsApp Business API** for booking confirmations, payment reminders, and guest concierge with both template and free-form message support; wired transactional email for booking and recovery flows

#### Frontend & React Engineering

- Built a **React 18 + TypeScript 5.8 SPA** (153 components) deployed on Cloudflare Pages with **TanStack Query v5** (5-min staleTime, 10-min GC for zero-redundant API calls), **shadcn/ui + Radix UI** (30+ accessible headless components), **Recharts** analytics dashboards, Framer Motion animations, React Hook Form + Zod validation, and **i18next** internationalization
- Implemented client-side PDF export (jsPDF + jspdf-autotable) and Puppeteer-based server-side report generation; integrated **Sentry** with PII scrubbing for frontend error tracking and **Cloudflare Turnstile** CAPTCHA on public booking forms
- Built a **Loyalty Program** module (configurable points wallet, milestone rewards, chain-wide broadcast offers, guest redemption flows) and a **Brand Console** for multi-property chain management from a single dashboard

#### Testing & CI/CD

- Shipped **56 pytest test files** covering auth guards (401 enforcement), tenant isolation IDOR tests, happy paths, empty-state safety, and 422 input validation across all 24 domains; achieved test-first regression discipline — every bug fix ships with a failing test committed before the fix
- Configured **GitHub Actions CI** (Backend: Python 3.11, pytest-cov coverage reports, Bandit SAST code scanning, pip-audit CVE dependency auditing; Frontend: Node.js 20, TypeScript `tsc --noEmit`, Vitest, Vite production build) running on every PR with concurrency cancellation on new pushes

---

## TECHNICAL SKILLS

| Category | Technologies |
|---|---|
| **Languages** | Python (Advanced), TypeScript, JavaScript, SQL, Bash |
| **AI & LLM** | Agno, LangChain, CrewAI, Groq, OpenAI, Prompt Engineering, Tool Use, Multi-Agent Orchestration, RAG, Fine-Tuning (LoRA/QLoRA) |
| **Backend** | FastAPI, SQLModel, SQLAlchemy (async), PostgreSQL, Redis, WebSockets, REST APIs |
| **Frontend** | React 18, TypeScript, TanStack Query, shadcn/ui, Radix UI, Recharts, Tailwind CSS, Vite, i18next |
| **DevOps & CI/CD** | GitHub Actions, Docker, Bandit SAST, pip-audit, pytest-cov, Cloudflare Pages, Railway |
| **Databases** | PostgreSQL (Supabase), Redis, SQLite, MongoDB, FAISS, ChromaDB, Pinecone |
| **Payments & Messaging** | Razorpay, WhatsApp Business API (Meta Graph API), HMAC Webhook Verification |
| **Security** | JWT/OAuth2, RBAC, IDOR Prevention, HMAC-SHA256, Sentry, Cloudflare Turnstile |
| **ML & Data** | PyTorch, Scikit-learn, XGBoost, Transformers, NumPy, Pandas, NLTK, SpaCy |
| **Web Automation** | Playwright, Selenium, SeleniumBase, BeautifulSoup, Scrapy |

---

## EDUCATION

**R.V. Junior College of Commerce** | Graduated: June 2024
Commerce Stream | Mumbai, India

---

## CERTIFICATIONS

- Complete Data Science, ML, Deep Learning & NLP Bootcamp — KRISHAI Technologies (Nov 2024)
- Google Data Analytics Professional Certificate — Coursera | ID: 9b9f253c-2756
- Data Science Orientation — IBM | ID: 8393af30-a756

---

## KEY ACHIEVEMENTS

- Shipped a fully production-grade multi-tenant hotel SaaS with real payments, PII handling, and AI-powered features end-to-end as a solo engineer within 6 months
- Designed a zero-downtime Redis caching architecture with automatic in-memory fallback — third-party cache failure degrades gracefully and never crashes the application
- Built a 3-agent Agno AI system with 40+ tools, per-hotel token quotas, and Redis tool-result caching — keeping LLM costs bounded at scale
- Achieved full CI/CD discipline: Bandit SAST + pip-audit CVE scanning + 56 test files running on every PR with TypeScript and Vite build validation
