# Staybooker.ai — Complete Enterprise Technical Documentation

## Executive Summary
**Staybooker.ai** is an enterprise-grade, multi-tenant AI-powered Hotel Booking Engine, Property Management Suite, and Channel Management Hub. Designed to replace outdated booking engines, Staybooker empowers hoteliers with fully customizable direct booking widgets, automated rate shopping, multi-channel distribution synchronization, and deep AI concierge automation (via LangGraph and DeepSeek/OpenAI LLMs).

---

## Table of Contents
1. **[System Architecture & Core Technologies](#1-system-architecture--core-technologies)**
2. **[Database Schema & Entity-Relationship Details](#2-database-schema--entity-relationship-details)**
3. **[Comprehensive API Reference & Endpoints](#3-comprehensive-api-reference--endpoints)**
4. **[Frontend Structure, Pages & State Flow](#4-frontend-structure-pages--state-flow)**
5. **[AI Architecture, LangGraph Agents & Security](#5-ai-architecture-langgraph-agents--security)**
6. **[Deployment & Infrastructure Blueprint](#6-deployment--infrastructure-blueprint)**

---

## 1. System Architecture & Core Technologies

```mermaid
graph TD
    subgraph Frontend [Frontend Tier - React / Vite]
        A1[Hotelier Admin Portal<br>Dashboard, Rate Shopper, CRM]
        A2[Direct Booking Engine<br>Web App & Embeddable Widget]
        A3[AI Concierge Widget<br>Website Chat & Guest Bot]
    end

    subgraph CDN [Security & API Gateway]
        CF[Cloudflare / API Gateway<br>SSL, Rate Limiting, CORS]
    end

    subgraph Backend [Backend Service - FastAPI / Python]
        B1[Public Booking Engine API]
        B2[Admin & Property Management API]
        B3[Channel Manager Sync Engine]
        B4[AI Agent Graph - LangGraph]
    end

    subgraph Database Tier
        DB[(Supabase PostgreSQL<br>PgBouncer & Asyncpg)]
        ST[Supabase Object Storage<br>S3 - Hotel Photos & Assets]
    end

    subgraph External Integrations
        EX1[Payment Gateways<br>Razorpay, Stripe, CashFree]
        EX2[OTAs & Channels<br>Agoda, Booking.com, Airbnb]
        EX3[LLM Providers<br>Groq, DeepSeek, OpenAI]
    end

    Frontend -->|HTTPS / REST| CDN
    CDN --> Backend
    Backend <-->|SQL / Asyncpg| DB
    Backend <-->|HTTPS| ST
    Backend <-->|API / Webhooks| External Integrations
    B4 <-->|LangGraph Stream| EX3
```

### Core Technology Stack
- **Frontend Framework**: React 18 with TypeScript, built on Vite for lightning-fast bundling.
- **Styling & UI Design System**: Tailwind CSS paired with Radix UI primitives and Lucide Icons, organized under Shadcn UI standards for premium, accessible, and responsive user experiences.
- **State Management**: Asynchronous data querying and caching managed via TanStack Query (React Query) and native Context API.
- **Backend API**: Python 3.11+ using FastAPI, fully typed with Pydantic v2 and SQLModel (SQLAlchemy 2.0 async engine).
- **Database Engine**: Supabase hosted PostgreSQL with connection pooling via PgBouncer and asynchronous driver (`asyncpg`).
- **AI Automation Engine**: LangChain & LangGraph orchestrating multi-agent state machines, connected to Groq, DeepSeek, and OpenAI APIs.

---

## 2. Database Schema & Entity-Relationship Details

Staybooker uses a highly normalized PostgreSQL schema with explicit foreign keys and indexing optimized for high-concurrency multi-tenant operations.

```mermaid
erDiagram
    HOTELS ||--o{ ROOM_TYPES : has
    HOTELS ||--o{ RATE_PLANS : has
    HOTELS ||--o{ BOOKINGS : manages
    HOTELS ||--o{ INTEGRATION_SETTINGS : configures
    HOTELS ||--o{ COMPETITORS : benchmarks
    ROOM_TYPES ||--o{ ROOM_BLOCKS : allocates
    ROOM_TYPES ||--o{ ROOM_RATES : overrides
    ROOM_TYPES ||--o{ ROOM_AMENITY_LINKS : includes
    USERS ||--o{ USER_HOTEL_LINKS : owns
    HOTELS ||--o{ USER_HOTEL_LINKS : links
    GUESTS ||--o{ BOOKINGS : books
    HOTELS ||--o{ GUESTS : registers

    HOTELS {
        uuid id PK
        string name
        string slug UK
        string primary_color
        json settings
        boolean is_active
        timestamp created_at
    }
    USERS {
        uuid id PK
        string email UK
        string name
        string role
    }
    ROOM_TYPES {
        uuid id PK
        uuid hotel_id FK
        string name
        decimal base_price
        int total_inventory
        int base_occupancy
        int max_occupancy
    }
    RATE_PLANS {
        uuid id PK
        uuid hotel_id FK
        string name
        string meal_plan
        decimal price_adjustment
        boolean is_refundable
    }
    BOOKINGS {
        uuid id PK
        uuid hotel_id FK
        uuid guest_id FK
        string booking_number UK
        date check_in
        date check_out
        decimal total_amount
        string status
    }
```

### Key Schema Entities & Responsibilities

#### 1. Core Multi-Tenant & Identity
- `hotels`: Central property table storing brand identity (name, unique slug, logo, primary brand color), operational policies (check-in times, cancellation rules), and feature enablement flags (`feature_ai_agent`, `feature_rate_shopper`).
- `users`: Supabase Auth synchronized user accounts. Roles include `SUPER_ADMIN`, `OWNER`, `MANAGER`, and `STAFF`.
- `user_hotel_links`: Junction table enabling a single user account to manage multiple hotel branches with distinct role permissions per property.

#### 2. Inventory & Rate Engine
- `room_types`: Defines physical room categories, base capacities, base prices, extra person charges, and total available inventory.
- `rate_plans`: Defines meal plans (EP, CP, MAP, AP), price adjustments (+/- base markup), cancellation windows, and bundle package inclusions.
- `room_rates`: Granular daily override table storing specific date-range pricing for specific room types and rate plans.
- `room_blocks`: Tracks out-of-order rooms or manual channel manager allotments.

#### 3. Guest CRM & Bookings
- `guests`: Normalized guest profiles storing identity verification, email, phone number, and stay history across hotel properties.
- `bookings`: Master reservation table tracking stay dates, financial breakdown (room charges, taxes, add-ons), guest association, status (`PENDING`, `CONFIRMED`, `CHECKED_OUT`, `CANCELLED`), and payment settlement references.

#### 4. Ecosystem & Distribution
- `integration_settings`: Stores hotelier-specific widget customizations (custom domain CNAME mappings, embedded widget colors/layouts, Google Analytics tags, and custom AI API keys).
- `channel_settings` & `channel_logs`: Configuration and audit trails for real-time iCal / XML sync with Booking.com, Airbnb, and Agoda.
- `analytics_events`: High-frequency event tracking for conversion rate optimization across booking funnels.

---

## 3. Comprehensive API Reference & Endpoints

The backend exposes a highly structured REST API divided into unauthenticated public endpoints (for guest widgets) and authenticated admin endpoints (secured via OAuth2 / JWT).

### Public Endpoints (Booking Engine & Widgets)
```http
GET  /api/v1/public/hotels/slug/{slug}              # Fetch public hotel details & branding
GET  /api/v1/public/hotels/slug/{slug}/widget-config # Fetch widget layout, custom domain, and color configuration
GET  /api/v1/public/hotels/{identifier}/rooms       # Execute real-time availability search across room types & rate plans
GET  /api/v1/public/hotels/{identifier}/addons      # List available upsell add-ons
POST /api/v1/public/bookings                        # Create new guest booking (Generates secure Booking Reference ID)
POST /api/v1/public/chat/guest                      # Stream AI Concierge RAG chat interactions
POST /api/v1/public/loyalty-check                   # AI-powered repeat guest identification & coupon unlock
```

### Hotelier Management API (Secured)
```http
# Authentication & Multi-Property Navigation
GET  /api/v1/auth/me                                # Get active user profile & session claims
GET  /api/v1/properties                             # List all properties linked to active user
POST /api/v1/properties/switch/{hotel_id}           # Switch active property session context

# Inventory & Rate Shopper
GET  /api/v1/rooms                                  # Get room types & occupancy stats
POST /api/v1/rooms                                  # Create new room category
GET  /api/v1/rates/plans                            # List active rate plans & meal inclusions
POST /api/v1/rates/plans                            # Create new rate plan
GET  /api/v1/availability/calendar                  # Multi-room visual availability matrix data
GET  /api/v1/competitors                            # Rate Shopper live competitor pricing

# Channel Manager Synchronization
GET  /api/v1/channel-settings                       # Get active OTA sync links
POST /api/v1/channel-manager/sync                   # Force manual XML/iCal push-pull
GET  /api/v1/channel-manager/logs                   # Audit log of recent inventory transmissions
```

---

## 4. Frontend Structure, Pages & State Flow

The frontend architecture is modularized into distinct operational zones, allowing separate routing and bundle splitting for the administrative portal and guest booking widgets.

```
frontend/src/
├── api/             # Singleton HTTP Client (axios/fetch) with auto token injection
├── components/      # Reusable UI Primitives
│   ├── layout/      # AppHeader, AppSidebar, NavLink, DashboardLayout
│   ├── public/      # BookingStepper, ChatWidget, SocialProofWidget
│   └── ui/          # Radix/Shadcn Atomic Components (Buttons, Dialogs, Sheets, Charts)
├── contexts/        # AuthContext (Supabase session & active hotel context)
├── hooks/           # Custom React Hooks (useToast, useDebounce, useWindowSize)
├── pages/           # Page Modules
│   ├── admin/       # Hotelier Operations (Dashboard, Bookings, Guests, Rates)
│   ├── marketing/   # Rate Shopper, Loyalty Campaigns, Promo Codes
│   ├── public/      # Standalone Booking Selection, Checkout, Invoice & Widget Embeds
│   └── settings/    # Integration, Channel Manager, Branding & AI Config
└── types/           # Global TypeScript Interfaces
```

### Core Frontend State Workflow
1. **Authentication Mount**: `AuthContext.tsx` initializes Supabase Auth session listeners on application load.
2. **Context Resolution**: On successful login, the application queries `/auth/me` and `/properties`. The user's primary property slug (or active property session) is stored in context.
3. **Property Switching**: When a hotelier switches properties via `AppHeader.tsx`, a background POST request updates the session link and triggers a clean re-mount of inventory modules.
4. **Widget Embedding**: The booking widget (`BookingWidget.tsx`) is designed to be embedded in external hotel websites via an `iframe`. It dynamically reads `window.location` or URL params (`/book/:slug/widget`) to pull custom color tokens (`hotel.primary_color`) and transparent styling.

---

## 5. AI Architecture, LangGraph Agents & Security

Staybooker integrates an advanced AI Concierge and Automation engine powered by LangGraph, providing autonomous guest communications, automated email inquiries handling, and revenue optimization insights.

```mermaid
graph TD
    UserIn[Guest / Hotelier Request] --> Gateway[FastAPI Router]
    Gateway --> AgentOrchestrator[LangGraph Agent Orchestrator]
    
    subgraph LangGraph Multi-Agent Nodes
        AgentOrchestrator --> Classifier[Intent Classifier Node]
        Classifier --> RAG[RAG Knowledge Base Lookup<br>Hotel Rules, Policies, Amenities]
        Classifier --> BookingTool[Booking Tool Call Node<br>Check Room Availability]
        Classifier --> CRM[CRM Action Node<br>Special Requests, Late Check-in]
    end
    
    RAG --> LLM[LLM Provider Engine<br>Groq / DeepSeek / OpenAI]
    BookingTool --> LLM
    CRM --> LLM
    
    LLM --> Formatter[Response Formatter & Guardrails]
    Formatter --> UserOut[Formatted Output Stream]
```

### AI Module Components & Guardrails
- **Multi-Model Provider Compatibility**: Supports Groq (fast inference), DeepSeek (cost-efficient intelligence), and OpenAI (GPT-4o).
- **RAG Knowledge Base**: Every hotel's policies (cancellation, child policies, important info) are embedded and indexed. When a guest asks questions via the chat widget, relevant policies are retrieved before generating responses.
- **Autonomous Tool Execution**: The AI Concierge can independently check real-time availability and generate direct booking deep links (`/book/{slug}/rooms?check_in=...`) formatted seamlessly inside the chat window.
- **Output Guardrails**: Strict prompt engineering and Pydantic output validation prevent prompt injection, competitor promotion, and hallucinatory rate promises.

---

## 6. Deployment & Infrastructure Blueprint

Staybooker is designed for high availability and rapid horizontal scaling using modern cloud platforms.

```
[ GitHub Repo (main branch) ]
         │
         ├── Webhook Trigger (CI/CD)
         │
         ├──> [ Frontend Build (Vite) ] ──> Cloudflare Pages (Global Edge CDN)
         │
         └──> [ Backend Docker Container ] ──> Railway / AWS ECS App Cluster
                                                    │
                                         (PgBouncer Connection Pool)
                                                    │
                                                    ▼
                                     [ Supabase PostgreSQL Cluster ]
```

### Step-by-Step Production Setup Guide

#### Step 1: Environment Variables Configuration
Create a `.env` file in both frontend and backend directories:
```ini
# Backend (.env)
DATABASE_URL="postgresql+asyncpg://postgres:[YOUR_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"
SUPABASE_URL="https://[YOUR_INSTANCE].supabase.co"
SUPABASE_KEY="[YOUR_SERVICE_ROLE_KEY]"
JWT_SECRET="[YOUR_STRONG_JWT_SECRET]"
FRONTEND_URL="https://staybooker.ai"

# Frontend (.env)
VITE_API_URL="https://api.staybooker.ai/api/v1"
VITE_SUPABASE_URL="https://[YOUR_INSTANCE].supabase.co"
VITE_SUPABASE_ANON_KEY="[YOUR_ANON_KEY]"
```

#### Step 2: Database Initialization & Migrations
Ensure Supabase PostgreSQL database is operational. Execute DDL migrations to set up tables and RLS (Row Level Security) policies:
```bash
# Apply schema
psql -h aws-0-ap-south-1.pooler.supabase.com -U postgres -d postgres -f backend/schema.sql
```

#### Step 3: Backend Deployment (Railway / Docker)
Deploy the backend Python application as a Docker container or directly on Railway/AWS App Runner:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

#### Step 4: Frontend Deployment (Cloudflare Pages / Vercel)
Build and deploy the React Single Page Application (SPA):
```bash
cd frontend
npm install
npm run build
# Dist folder deployed to Cloudflare Pages
```

#### Step 5: Verification & Health Checks
Run the automated health validation script to confirm end-to-end integration:
```bash
python backend/health_check.py
```
*Expected Output: `All services 200 OK. Direct booking flow operational.`*
