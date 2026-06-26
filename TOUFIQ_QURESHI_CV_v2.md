TOUFIQ QURESHI
+91-9665458841 · toufiqqureshi651@gmail.com · linkedin.com/in/toufiq-qureshi · github.com/ToufiqQureshi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY

AI Engineer and full-stack developer with hands-on experience building and deploying a multi-tenant SaaS platform handling real payments, guest PII, and LLM-powered agents. Focused on secure backend architecture, agentic AI systems, and production resilience over prototype-level demos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STAYBOOKER — Founding Engineer, Multi-Tenant Hotel Booking SaaS          Oct 2024 – Present
Python · FastAPI · PostgreSQL · SQLModel · Redis · Agno · Groq · React 18 · TypeScript · Razorpay · WhatsApp Business API · Railway · Cloudflare Pages

- Architected a multi-tenant FastAPI backend across 24 domain modules, 49 routers, and 33 PostgreSQL tables (SQLModel + async SQLAlchemy); enforced per-hotel row-level isolation at every query layer to prevent cross-tenant data exposure (IDOR).

- Designed a Redis caching layer with automatic in-memory dict fallback on cache failure, covering availability queries, distributed payment idempotency locks (SET NX EX), rate-limit counters, and AI tool result caching (300 s TTL) — cache outage degrades gracefully without crashing the application.

- Built a 3-agent AI system on Agno (agno.agent.Agent + agno.team.Team): a hotelier analytics copilot (Groq llama-3.3-70b-versatile, 30 tools spanning revenue analytics, occupancy forecasting, smart alerts, and pricing actions) and a guest concierge + WhatsApp sales bot (llama-3.1-8b-instant), with per-hotel token quotas enforced via Redis and LLM usage persisted to PostgreSQL.

- Secured the payment pipeline by computing booking amounts server-side (never from client input), verifying Razorpay webhook signatures via HMAC-SHA256, enforcing idempotent event processing with a unique transaction ID constraint, and applying the same HMAC pattern to WhatsApp Business API webhooks (Meta X-Hub-Signature-256).

- Implemented Supabase JWT authentication with Redis-cached token validation (TTL-capped at token expiry) and 4-tier RBAC (SUPER_ADMIN / OWNER / MANAGER / STAFF) enforced via FastAPI dependency injection; all secrets masked through a centralized sensitive_fields sanitizer before any API response is returned.

- Built a deterministic rule-based pricing engine (4 rule types: occupancy %, day-of-week, lead-time, seasonal date range) with priority-ordered rule stacking and min/max guard rails — same inputs always produce the same price, safe for high-frequency availability queries.

- Configured GitHub Actions CI: pytest (56 test files — auth guards, IDOR isolation, 422 input validation, empty-state safety), Bandit SAST, pip-audit CVE scanning on backend; TypeScript tsc --noEmit, Vitest, and Vite build on frontend. Every PR also runs a Cloudflare Pages preview deploy and a Railway environment deploy.

- Built a React 18 + TypeScript SPA (Cloudflare Pages) with TanStack Query v5 (5-min staleTime), shadcn/ui + Radix UI, Recharts dashboards for RevPAR / ADR / occupancy analytics, and i18next internationalization.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TECHNICAL SKILLS

Languages:        Python, TypeScript, JavaScript, SQL, Bash
AI & Agents:      Agno, LangChain, CrewAI, Groq, OpenAI API, Prompt Engineering, RAG, Multi-Agent Tool Use
Backend:          FastAPI, SQLModel, SQLAlchemy (async), PostgreSQL, Redis, Alembic, SlowAPI, WebSockets
Frontend:         React 18, TanStack Query, shadcn/ui, Radix UI, Recharts, Tailwind CSS, Vite, Zod
DevOps & CI/CD:   GitHub Actions, Bandit SAST, pip-audit, pytest-cov, Cloudflare Pages, Railway, Docker
Security:         JWT / OAuth2, RBAC, HMAC-SHA256 webhook verification, IDOR prevention, Cloudflare Turnstile
Payments & Comms: Razorpay, WhatsApp Business API (Meta Graph API), Sentry

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EDUCATION & CERTIFICATIONS

R.V. Junior College of Commerce, Mumbai — June 2024
Google Data Analytics Professional Certificate — Coursera (ID: 9b9f253c-2756)
Complete Data Science, ML & Deep Learning Bootcamp — KRISHAI Technologies (Nov 2024)
