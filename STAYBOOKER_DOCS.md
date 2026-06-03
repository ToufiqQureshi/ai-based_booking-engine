# STAYBOOKER — Complete Project Documentation

> This document covers everything about Staybooker. If you are a new developer, read this first. If something breaks, check this first. Written in plain English so anyone can understand.

---

## TABLE OF CONTENTS

1. [What Is Staybooker?](#1-what-is-staybooker)
2. [How The System Works (Big Picture)](#2-how-the-system-works-big-picture)
3. [Tech Stack](#3-tech-stack)
4. [Folder Structure](#4-folder-structure)
5. [Database — All Tables Explained](#5-database--all-tables-explained)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [All API Endpoints](#7-all-api-endpoints)
8. [Frontend Pages & Routes](#8-frontend-pages--routes)
9. [How Key Features Work](#9-how-key-features-work)
10. [External Services](#10-external-services)
11. [Environment Variables](#11-environment-variables)
12. [Deployment](#12-deployment)
13. [Caching Strategy](#13-caching-strategy)
14. [Security Rules](#14-security-rules)
15. [Common Bugs & How To Debug](#15-common-bugs--how-to-debug)

---

## 1. What Is Staybooker?

Staybooker is a **SaaS hotel booking platform**. Think of it like a mini-Booking.com that hotels can use privately.

**Two types of users:**
- **Hoteliers** — Hotel owners/staff who manage rooms, prices, bookings
- **Guests** — Regular people who visit the hotel's booking page and book rooms

**Three main parts:**
1. **Admin Panel** — The hotelier dashboard (login required)
2. **Public Booking Engine** — Guest-facing pages (no login needed)
3. **Super Admin Panel** — Staybooker staff control panel (Staybooker employees only)

**One important concept — Multi-tenant:**
Every hotel has its own data. Hotel A cannot see Hotel B's bookings, rooms, or guests. Everything is separated by `hotel_id`.

---

## 2. How The System Works (Big Picture)

```
GUEST visits  →  /book/hotel-name/rooms
                        ↓
              Frontend (React) loads
                        ↓
              Calls Backend API (FastAPI)
                        ↓
              Backend checks Redis cache first
              If not cached → hits PostgreSQL database
                        ↓
              Guest selects room → goes to checkout
                        ↓
              Guest pays via Razorpay
                        ↓
              Backend creates booking in DB
              Sends confirmation email via Brevo
                        ↓
              Guest sees confirmation page
```

```
HOTELIER logs in  →  Supabase Auth checks email/password
                             ↓
                    JWT token created
                             ↓
                    Frontend stores token
                    Sends token in every API request
                             ↓
                    Backend verifies token (Redis cached 10 min)
                    Checks user role
                    Returns data for that hotel only
```

---

## 3. Tech Stack

### Frontend
| What | Tool | Why |
|------|------|-----|
| UI Framework | React 18 | Industry standard, component-based |
| Language | TypeScript | Catches bugs before runtime |
| Build Tool | Vite | Fast development and builds |
| Routing | React Router v6 | Page navigation |
| Styling | Tailwind CSS | Utility-first, fast UI |
| UI Components | shadcn/ui + Radix UI | Accessible, pre-built components |
| Forms | react-hook-form + zod | Form handling + validation |
| API Calls | Custom apiClient (fetch wrapper) | Centralized API layer |
| State Management | React Context + useState | Auth state, hotel state |
| Charts | Recharts | Analytics charts |
| PDF Export | jsPDF | Booking confirmation PDFs |
| Animations | Framer Motion | Smooth transitions |
| Auth | Supabase JS SDK | Login, token management |
| Notifications | Sonner | Toast messages |
| Error Tracking | Sentry | Crash reporting |

### Backend
| What | Tool | Why |
|------|------|-----|
| Language | Python 3.12 | Modern async support |
| Web Framework | FastAPI | Async, fast, auto docs at /docs |
| ORM | SQLModel (SQLAlchemy + Pydantic) | Database + validation in one |
| Database Driver | asyncpg | Async PostgreSQL |
| Migrations | Alembic | Database schema versioning |
| Server | Gunicorn + Uvicorn | Production ASGI server |
| Auth | Supabase JWT verification | Stateless token auth |
| Cache | Redis + in-memory fallback | Speed up repeated queries |
| Email | Brevo (Sendinblue) | Transactional emails |
| Payments | Razorpay | Indian payment gateway |
| AI / LLM | LangChain + Groq / OpenAI / Ollama | Guest chatbot, hotel AI agent |
| Rate Limiting | slowapi | Prevent abuse |
| Monitoring | Sentry | Error tracking |

### Database & Infrastructure
| What | Tool |
|------|------|
| Database | PostgreSQL (hosted on Supabase) |
| Auth Service | Supabase Auth |
| Cache | Redis (hosted on Railway) |
| Deployment | Railway (backend + Redis) |
| Frontend Hosting | Railway or any static host |

---

## 4. Folder Structure

### Backend (`/backend`)
```
backend/
├── main.py                    ← FastAPI app starts here. All routers registered here.
├── requirements.txt           ← All Python packages
├── Dockerfile                 ← Production Docker build
├── alembic/                   ← Database migration files
│   └── versions/              ← Each file = one DB change
├── app/
│   ├── api/
│   │   ├── deps.py            ← HOW AUTH WORKS. Read this to understand token verification.
│   │   └── v1/
│   │       ├── auth.py        ← /auth/onboarding (first login setup)
│   │       ├── hotels.py      ← Hotel CRUD
│   │       ├── rooms.py       ← Room type management
│   │       ├── bookings.py    ← Hotelier booking management
│   │       ├── rates.py       ← Rate plans
│   │       ├── availability.py← Calendar, room blocks, bulk rate upload
│   │       ├── payments.py    ← Payment history, refunds
│   │       ├── dashboard.py   ← Stats for dashboard
│   │       ├── analytics.py   ← Visitor tracking
│   │       ├── addons.py      ← Add-on services (breakfast, spa)
│   │       ├── promos.py      ← Promo/coupon codes
│   │       ├── agent.py       ← AI chatbot for hotelier
│   │       ├── leads.py       ← Leads from AI chat
│   │       ├── notifications.py← In-app notifications
│   │       ├── admin.py       ← Admin stats
│   │       ├── competitors.py ← Competitor rate tracking
│   │       ├── reports.py     ← Reports
│   │       ├── upload.py      ← File/image upload
│   │       ├── social_proof.py← Social proof badge data
│   │       ├── channel_manager.py ← OTA sync (Channex, Siteminder)
│   │       ├── google_ads.py  ← Google Hotel Ads XML feeds
│   │       ├── integration/
│   │       │   ├── settings.py← Widget config, webhook setup
│   │       │   ├── whatsapp.py← WhatsApp webhook handler
│   │       │   └── google.py  ← Google OAuth
│   │       ├── public/        ← NO AUTH NEEDED. Guest-facing endpoints.
│   │       │   ├── bookings.py← Guest books a room
│   │       │   ├── payments.py← Razorpay order + verify
│   │       │   ├── rooms.py   ← Search rooms with availability
│   │       │   ├── hotels.py  ← Hotel info, widget config
│   │       │   ├── chat.py    ← AI chat for guests
│   │       │   └── sse.py     ← Real-time rate updates (Server-Sent Events)
│   │       └── superadmin/    ← SUPER_ADMIN ONLY
│   │           ├── hotels.py  ← Manage all hotels, features, pause
│   │           ├── users.py   ← Manage all users
│   │           ├── integrations.py ← Configure WhatsApp/AI per hotel
│   │           ├── sessions.py← Revoke user sessions
│   │           ├── cache_mgmt.py ← View/clear cache
│   │           ├── health.py  ← System health check
│   │           └── exports.py ← Download all data as CSV
│   ├── core/
│   │   ├── config.py          ← All env vars loaded here (Settings class)
│   │   ├── database.py        ← DB connection + auto-migration on startup
│   │   ├── redis_client.py    ← Redis connection with in-memory fallback
│   │   ├── supabase.py        ← Supabase JWT verification
│   │   ├── email_service.py   ← Brevo email sender
│   │   ├── guest_agent.py     ← AI chatbot logic for guests
│   │   ├── global_agent.py    ← AI agent for hoteliers
│   │   └── limiter.py         ← Rate limiter setup
│   ├── models/                ← DATABASE TABLES. Each file = one or more tables.
│   │   ├── user.py            ← users table
│   │   ├── hotel.py           ← hotels table
│   │   ├── room.py            ← room_types, room_blocks tables
│   │   ├── booking.py         ← bookings, guests tables
│   │   ├── payment.py         ← payments table
│   │   ├── rates.py           ← rate_plans, room_rates tables
│   │   ├── addon.py           ← addons table
│   │   ├── promo.py           ← promo_codes table
│   │   ├── integration.py     ← api_keys, integration_settings tables
│   │   ├── subscription.py    ← subscriptions table
│   │   ├── analytics.py       ← analytics_sessions, analytics_events tables
│   │   ├── lead.py            ← leads table
│   │   ├── social_proof.py    ← hotel_social_proof_settings table
│   │   ├── channel_manager.py ← channel_manager_settings, channel_room_mappings tables
│   │   ├── notification.py    ← notifications table
│   │   ├── competitor.py      ← competitors, competitor_rates tables
│   │   ├── audit.py           ← audit_logs, system_broadcast tables
│   │   └── links.py           ← user_hotel_links table (many-to-many)
│   └── services/
│       └── email_service.py   ← Email sending via Brevo API
```

### Frontend (`/frontend/src`)
```
frontend/src/
├── App.tsx                    ← ALL ROUTES defined here. Start here to understand navigation.
├── main.tsx                   ← React app entry point
├── pages/
│   ├── auth/                  ← Login, Signup, Password reset
│   ├── dashboard/             ← Main dashboard, amenities
│   ├── rooms/                 ← Room management, availability calendar
│   ├── bookings/              ← Booking list, guest database
│   ├── finance/               ← Rates, payments, taxes, reports
│   ├── marketing/             ← Add-ons, rate shopper, Google reviews
│   ├── settings/              ← All hotel settings tabs
│   ├── superadmin/            ← Super admin panel
│   ├── public/                ← Guest booking pages (no login)
│   └── AnalyticsDashboard.tsx ← Analytics charts
├── components/
│   ├── ui/                    ← shadcn/ui base components (don't touch)
│   ├── layout/                ← Sidebar, header, page shell
│   ├── public/                ← Guest-facing components
│   │   ├── booking/           ← Room cards, filters, cart
│   │   └── checkout/          ← Checkout form sections
│   ├── integration/           ← WhatsApp tab, API keys tab
│   ├── superadmin/            ← Super admin components
│   └── ErrorBoundary.tsx      ← Catches React crashes
├── contexts/
│   ├── AuthContext.tsx        ← WHO IS LOGGED IN. Hotel data. User data.
│   └── ThemeContext.tsx       ← Dark/light mode
├── api/
│   └── client.ts              ← All API calls go through here. Adds auth token automatically.
├── hooks/                     ← Custom reusable hooks
│   └── useBookingWidgetState.tsx ← Booking widget state and config
├── types/
│   └── api.ts                 ← TypeScript types for all data models
└── layouts/
    └── PublicBookingLayout.tsx ← Header/footer wrapper for guest pages
```

---

## 5. Database — All Tables Explained

> All tables are in PostgreSQL (Supabase). Every hotel's data is separated by `hotel_id`.

### CORE TABLES

#### `users`
Who can log in to the admin panel.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Unique ID |
| email | String (unique) | Login email |
| name | String | Display name |
| role | Enum | OWNER / MANAGER / STAFF / SUPER_ADMIN |
| hotel_id | UUID (FK) | Which hotel this user belongs to |
| supabase_id | String | Supabase Auth user ID (links to auth system) |
| is_active | Boolean | If false, user cannot login |
| created_at | DateTime | When account was created |

#### `hotels`
Each hotel is one row here. This is the most important table.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Unique hotel ID |
| name | String | Hotel name |
| slug | String (unique) | URL-friendly name (e.g., "grand-palace") — used in /book/grand-palace |
| description | Text | Hotel description |
| star_rating | Integer (1-5) | Star rating |
| logo_url | String | Logo image URL |
| primary_color | String | Theme color (hex, e.g., #7c3aed) |
| address | JSON | {street, city, state, country, postal_code, lat, lng} |
| contact | JSON | {phone, email, website} |
| settings | JSON | **BIG JSON.** Contains: currency, timezone, check-in/out times, cancellation policy, SMTP email config, WhatsApp config, tax rates, tax slabs, payment mode, featured room, multi-room cart setting, Razorpay keys |
| photos | JSON Array | List of {url, caption} photo objects |
| amenities | JSON Array | List of amenity names |
| feature_* | Boolean | Feature flags (rate_shopper, ai_agent, guest_bot, google_ads, etc.) |
| ai_provider | String | AI provider for this hotel (groq/openai/ollama) |
| ai_api_key | String | Hotel-specific AI API key |
| is_active | Boolean | If false, hotel is disabled |
| is_paused | Boolean | Temporarily paused |
| created_at | DateTime | When hotel was created |

> **Note:** `hotel.settings` is a large JSON object. All per-hotel configuration (taxes, emails, payment settings) lives here.

#### `room_types`
Room categories (e.g., Deluxe Room, Suite).
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Room type ID |
| hotel_id | UUID (FK) | Which hotel |
| name | String | Room category name |
| description | Text | Description |
| base_price | Float | Default price per night |
| total_inventory | Integer | Total number of rooms of this type |
| max_occupancy | Integer | Max people allowed |
| base_occupancy | Integer | Included guests in base price |
| extra_person_price | Float | Extra charge per person |
| bed_type | String | King, Twin, etc. |
| room_size | Float | Square feet/meters |
| photos | JSON Array | Room photos |
| amenities | JSON Array | Room-specific amenities |
| is_active | Boolean | If false, room won't appear in search |
| cancellation_policy | Text | Override hotel-level policy |

#### `bookings`
Every booking made (by guests or hoteliers).
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Booking ID |
| hotel_id | UUID (FK) | Which hotel |
| guest_id | UUID (FK) | Who booked |
| booking_number | String (unique) | Human-readable ID like BK20260101ABC123 |
| check_in | Date | Check-in date |
| check_out | Date | Check-out date |
| status | Enum | pending / confirmed / cancelled / checked_in / checked_out / cancel_requested |
| total_amount | Float | Final amount charged |
| subtotal_amount | Float | Before tax |
| tax_amount | Float | Tax charged |
| discount_amount | Float | Promo discount applied |
| rooms | JSON Array | Room details snapshot at booking time |
| addons | JSON Array | Add-ons selected |
| tax_details | JSON | Breakdown of taxes |
| special_requests | Text | Guest notes |
| promo_code | String | Promo code used |
| source | String | direct / booking_engine / manual |
| created_at | DateTime | When booking was created |

#### `guests`
Guest contact information.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Guest ID |
| hotel_id | UUID (FK) | Which hotel |
| first_name | String | First name |
| last_name | String | Last name |
| email | String | Email address |
| phone | String | Phone number |
| nationality | String | Country code |
| created_at | DateTime | First booking date |

#### `payments`
Payment records for each booking.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Payment ID |
| hotel_id | UUID (FK) | Which hotel |
| booking_id | UUID (FK) | Which booking |
| amount | Float | Amount paid |
| currency | String | INR, USD, etc. |
| status | Enum | pending / completed / failed / refunded / partial_refund |
| payment_method | String | online / property |
| gateway_reference | String | Razorpay order ID |
| transaction_id | String | Razorpay payment ID |
| reference_number | String | Internal reference |
| created_at | DateTime | When payment was recorded |

### PRICING TABLES

#### `rate_plans`
Pricing strategies (e.g., "Breakfast Included", "Non-Refundable").
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Rate plan ID |
| hotel_id | UUID (FK) | Which hotel |
| name | String | Plan name |
| meal_plan | String | EP (no meals) / CP (breakfast) / MAP / AP |
| price_adjustment | Float | +/- adjustment over base price |
| is_refundable | Boolean | Can guest cancel and get refund? |
| cancellation_hours | Integer | Hours before check-in for free cancellation (default 24) |
| min_los | Integer | Minimum nights stay |
| advance_purchase_days | Integer | Must book X days in advance |
| is_package | Boolean | Is this a package deal? |
| package_items | JSON | What's included in the package |
| is_active | Boolean | Visible to guests? |

#### `room_rates`
Daily pricing overrides. When no override exists, falls back to `room_types.base_price`.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Rate ID |
| hotel_id | UUID (FK) | Which hotel |
| room_type_id | UUID (FK) | Which room |
| rate_plan_id | UUID (FK, nullable) | Which rate plan (null = all plans) |
| date_from | Date | Rate applies from this date |
| date_to | Date | Rate applies until this date |
| price | Float | Price per night for this date range |

#### `room_blocks`
Dates when rooms are unavailable (maintenance, etc.).
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Block ID |
| hotel_id | UUID (FK) | Which hotel |
| room_type_id | UUID (FK) | Which room |
| start_date | Date | Block from |
| end_date | Date | Block until |
| reason | String | Why blocked |
| blocked_count | Integer | How many rooms blocked (can block partial inventory) |

### OTHER TABLES

#### `addons`
Optional services guests can add during booking.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Add-on ID |
| hotel_id | UUID (FK) | Which hotel |
| name | String | e.g., "Breakfast", "Airport Transfer" |
| description | Text | Details |
| price | Float | Price per booking |
| category | String | food / romance / wellness / transport |
| image_url | String | Photo |
| is_active | Boolean | Visible to guests? |

#### `promo_codes`
Discount codes guests can apply at checkout.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Promo ID |
| hotel_id | UUID (FK) | Which hotel |
| code | String | e.g., "SUMMER20" |
| discount_type | Enum | percentage / fixed_amount |
| discount_value | Float | 20 (percent) or 500 (rupees) |
| start_date | Date | Valid from |
| end_date | Date | Valid until |
| max_usage | Integer | Max times it can be used |
| current_usage | Integer | How many times used so far |
| is_active | Boolean | Active? |

#### `subscriptions`
Hotel billing and quotas.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Subscription ID |
| hotel_id | UUID (FK) | Which hotel |
| plan_name | String | Basic / Pro / Enterprise |
| status | Enum | active / expired / cancelled |
| start_date | Date | Subscription start |
| end_date | Date | Subscription end |
| whatsapp_credits | Integer | WhatsApp messages remaining |
| ai_usage_limit | Integer | AI queries remaining |

#### `api_keys`
For hotels to access Staybooker via API (third-party integrations).
| Field | Type | What It Is |
|-------|------|------------|
| id | String | Key ID (key_xxxx format) |
| hotel_id | UUID (FK) | Which hotel |
| name | String | e.g., "My PMS Integration" |
| key_hash | String | Hashed API key (never store plain text) |
| key_prefix | String | First few chars for display |
| is_active | Boolean | Active? |
| request_count | Integer | Total API calls made |

#### `integration_settings`
Widget and third-party config per hotel (one row per hotel).
| Field | Type | What It Is |
|-------|------|------------|
| hotel_id | UUID (FK, unique) | One row per hotel |
| widget_enabled | Boolean | Booking widget on/off |
| widget_layout | String | modern / classic / minimal / premium |
| widget_primary_color | String | Widget theme color |
| widget_custom_css | Text | Custom CSS for the widget |
| widget_custom_js | Text | Custom JavaScript |
| allowed_domains | Text | CORS whitelist |
| webhook_url | String | URL to receive booking events |
| google_sheet_url | String | Google Sheet integration |
| google_hotel_ads_enabled | Boolean | Google Hotel Ads on/off |

#### `leads`
Contact info captured by the AI chatbot when guests ask about rooms.
| Field | Type | What It Is |
|-------|------|------------|
| id | UUID | Lead ID |
| hotel_id | UUID (FK) | Which hotel |
| guest_name | String | Name from chat |
| guest_email | String | Email from chat |
| guest_phone | String | Phone from chat |
| check_in | Date | Interested dates |
| status | Enum | new / contacted / converted / lost |
| ai_conversation_summary | Text | What the AI captured |

#### `analytics_sessions` and `analytics_events`
Track every visitor on the public booking page.
- **Session** = one visit (device, browser, country, time spent, did they book?)
- **Event** = actions within session (page view, room selected, booking completed)

#### `hotel_social_proof_settings`
Controls the social proof badges shown on booking pages ("3 people viewing", "Booked 2 hours ago").
Real data only — no fake numbers.

#### `user_hotel_links`
Many-to-many table for users who belong to multiple hotels.
| Field | Type | What It Is |
|-------|------|------------|
| user_id | UUID (FK) | The user |
| hotel_id | UUID (FK) | The hotel |
| role | Enum | Role in this specific hotel |
| is_active | Boolean | Active link? |

---

## 6. User Roles & Permissions

There are 4 roles. Role is stored in `users.role`.

### SUPER_ADMIN
**Who:** Staybooker employees only.
**How assigned:** Auto-assigned if email is in `MASTER_ADMIN_EMAILS` env var.
**Can do:**
- See and manage ALL hotels
- Enable/disable features per hotel
- Pause/unpause hotels
- Create Staybooker employee accounts
- Revoke any user's session
- View system health, cache stats
- Configure WhatsApp/AI credentials per hotel
- Export all data
- Access `/superadmin/*` routes

### OWNER
**Who:** The hotel owner.
**Can do:** Everything for their hotel — rooms, bookings, payments, rates, settings, team management.

### MANAGER
**Who:** Senior hotel staff.
**Can do:** Same as OWNER except cannot manage billing/subscriptions.

### STAFF
**Who:** Front desk, housekeeping.
**Can do:** View availability, view bookings, view guests. Cannot change rates or settings.

### Guest (No Login)
**Who:** Anyone booking a room.
**Can do:** Search rooms, book, pay, cancel their own booking.
**Cannot do:** Access any admin or hotel management endpoint.

---

### How Auth Works (Step by Step)

1. Guest or hotelier logs in via Supabase (email + password).
2. Supabase returns a JWT token.
3. Frontend stores token, sends it in every request header: `Authorization: Bearer <token>`.
4. Backend (`app/api/deps.py`) receives the token.
5. Backend checks Redis cache — if token was verified recently (10 min), skip Supabase call.
6. If not cached, backend calls Supabase to verify the token.
7. Backend checks if the token has been revoked (for logged-out sessions).
8. Backend loads the user from database.
9. Backend checks `user.is_active` and `hotel.is_active`.
10. If all checks pass, the user object is available to the route handler.

---

## 7. All API Endpoints

Base URL: `https://api.staybooker.ai/api/v1`

Auto-generated docs available at: `https://api.staybooker.ai/docs`

### Public Endpoints (No Auth Required)
These are called by guests on the booking page.

| Method | Path | What It Does |
|--------|------|--------------|
| GET | `/public/hotels/{slug}` | Get hotel info (name, photos, settings) by slug |
| GET | `/public/hotels/{slug}/widget-config` | Get widget appearance config |
| GET | `/public/hotels/{hotel_id}/rooms` | Search available rooms for dates + guests |
| GET | `/public/hotels/{hotel_id}/addons` | Get available add-ons |
| GET | `/public/social-proof/{slug}` | Get social proof data (viewers, last booked) |
| POST | `/public/bookings` | **Create a guest booking** (rate limited: 5/min) |
| POST | `/public/bookings/cancel-request` | Guest requests cancellation |
| POST | `/public/bookings/cancel-confirm` | Confirm cancellation with token |
| POST | `/public/razorpay/order` | Create Razorpay payment order |
| POST | `/public/razorpay/verify` | Verify payment after guest pays |
| POST | `/public/razorpay/webhook` | Razorpay sends payment events here |
| POST | `/public/chat` | Guest chats with AI bot |
| GET | `/public/hotels/{hotel_id}/rate-updates` | SSE stream — notifies when rates change |
| POST | `/public/loyalty-check` | Check if guest is a returning customer |

### Protected Endpoints (Hotelier Auth Required)

| Method | Path | What It Does |
|--------|------|--------------|
| GET | `/users/me` | Current logged-in user info |
| PATCH | `/users/me` | Update my profile |
| GET | `/users` | List team members |
| POST | `/users` | Invite team member |
| GET | `/hotels/me` | Current hotel info |
| PATCH | `/hotels/me` | Update hotel settings |
| GET | `/properties` | List all my properties |
| POST | `/properties/switch/{hotel_id}` | Switch to another property |
| GET | `/rooms` | List room types |
| POST | `/rooms` | Create room type |
| PATCH | `/rooms/{id}` | Update room type |
| DELETE | `/rooms/{id}` | Delete room type |
| GET | `/bookings` | List bookings |
| POST | `/bookings` | Create booking manually |
| PATCH | `/bookings/{id}` | Update booking status |
| GET | `/bookings/guests` | Guest list |
| GET | `/availability` | Availability calendar |
| POST | `/availability/blocks` | Block room dates |
| DELETE | `/availability/blocks/{id}` | Remove block |
| POST | `/availability/rates` | Upload bulk rates |
| GET | `/rates/plans` | List rate plans |
| POST | `/rates/plans` | Create rate plan |
| PATCH | `/rates/plans/{id}` | Update rate plan |
| DELETE | `/rates/plans/{id}` | Delete rate plan |
| GET | `/payments` | Payment history |
| POST | `/payments/refund` | Process refund |
| GET | `/addons` | List add-ons |
| POST | `/addons` | Create add-on |
| GET | `/promos` | List promo codes |
| POST | `/promos` | Create promo code |
| POST | `/promos/validate` | Check if promo is valid |
| GET | `/dashboard/stats` | Dashboard numbers |
| GET | `/analytics/dashboard` | Analytics data |
| GET | `/integration/settings` | Widget & integration config |
| PUT | `/integration/settings` | Update integration config |
| GET | `/notifications` | My notifications |
| GET | `/leads` | AI-captured leads |

### Super Admin Endpoints (SUPER_ADMIN Only)

| Method | Path | What It Does |
|--------|------|--------------|
| GET | `/superadmin/hotels` | All hotels in the system |
| PATCH | `/superadmin/hotels/{id}` | Update hotel, toggle features, pause |
| GET | `/superadmin/hotels/{id}/integrations` | Hotel's WhatsApp/AI config |
| PUT | `/superadmin/hotels/{id}/integrations` | Update hotel's WhatsApp/AI config |
| GET | `/superadmin/users` | All users in the system |
| PATCH | `/superadmin/users/{id}/role` | Change user's role |
| PATCH | `/superadmin/users/{id}/status` | Enable/disable user |
| DELETE | `/superadmin/users/{id}` | Delete user |
| POST | `/superadmin/employees` | Create Staybooker employee |
| GET | `/superadmin/sessions` | Active login sessions |
| DELETE | `/superadmin/sessions/{user_id}` | Force logout a user |
| GET | `/superadmin/cache/stats` | Redis cache stats |
| GET | `/superadmin/health` | System health check |
| GET | `/superadmin/hotels/{id}/export/bookings` | Download booking data as CSV |

---

## 8. Frontend Pages & Routes

### Public Pages (No Login)
| URL | Component | What Guest Sees |
|-----|-----------|-----------------|
| `/` | LandingPage.tsx | Staybooker marketing homepage |
| `/book/:hotelSlug` | PublicBookingLayout | Hotel booking page wrapper |
| `/book/:hotelSlug/rooms` | BookingSelection.tsx | Room search results + filters |
| `/book/:hotelSlug/checkout` | BookingCheckout.tsx | Guest details + add-ons + payment |
| `/book/:hotelSlug/confirmation` | BookingConfirmation.tsx | Booking confirmed page + PDF |
| `/book/:hotelSlug/cancel` | BookingCancel.tsx | Cancellation page |
| `/book/:hotelSlug/widget` | BookingWidget.tsx | Standalone search widget (for embedding in iframes) |
| `/book/:hotelSlug/chat` | ChatEmbed.tsx | Standalone AI chat (for embedding) |

### Auth Pages
| URL | What It Is |
|-----|------------|
| `/login` | Login form |
| `/signup` | Create account |
| `/forgot-password` | Request password reset |
| `/reset-password` | Set new password |

### Hotelier Dashboard (Login Required)
| URL | What It Shows |
|-----|---------------|
| `/dashboard` | Stats: arrivals, departures, occupancy, revenue. Recent bookings. |
| `/rooms` | Room categories list. Add/edit/delete rooms. |
| `/availability` | Calendar view. Block dates. Bulk upload rates. |
| `/rates` | Rate plans. Weekend pricing. |
| `/bookings` | All bookings. Search, filter, status update. |
| `/guests` | Guest database. Loyalty info. |
| `/payments` | Payment history. Process refunds. |
| `/finance/taxes` | Tax configuration (GST slabs). |
| `/addons` | Add-on services management. |
| `/analytics` | Visitor traffic, conversion charts, AI performance. |
| `/rate-shopper` | Competitor hotel pricing. |
| `/reviews` | Google Reviews integration. |
| `/settings` | Hotel settings (name, logo, policies, email, taxes). |
| `/integration` | Widget setup, API keys, WhatsApp stats. |
| `/agent` | Test AI chatbot. |

### Super Admin Panel
| URL | Access |
|-----|--------|
| `/superadmin` | SUPER_ADMIN only. All hotels, users, system health. |

---

## 9. How Key Features Work

### Guest Books A Room (Full Flow)

1. Guest visits `/book/hotel-name/rooms?check_in=2026-06-10&check_out=2026-06-12&guests=2`
2. Frontend calls `GET /public/hotels/{hotel_id}/rooms?check_in=...&check_out=...`
3. Backend runs availability check:
   - Counts bookings for those dates per room type
   - Counts blocks for those dates
   - `available = total_inventory - booked - blocked`
   - Calculates price from `room_rates` table (or falls back to `base_price`)
4. Rooms displayed with prices
5. Guest selects room, chooses rate plan, selects add-ons, enters promo code
6. Guest goes to checkout, fills in name/email/phone
7. Guest clicks "Pay Now"
8. Frontend calls `POST /public/bookings` — creates booking with status `pending`
9. Frontend calls `POST /public/razorpay/order` — creates Razorpay order
10. Razorpay popup opens. Guest pays.
11. Razorpay calls frontend with payment signature
12. Frontend calls `POST /public/razorpay/verify` with signature
13. Backend verifies HMAC signature — if valid, updates booking to `confirmed`
14. Backend sends confirmation email via Brevo
15. Frontend redirects to `/book/hotel-name/confirmation`

**What prevents double-booking:**
- PostgreSQL row-level lock (`FOR UPDATE`) on room type during booking creation
- Redis idempotency key — same request within 60s returns same result

### How Pricing Is Calculated

```
Room Base Price
    + Rate Plan Adjustment (e.g., +500 for breakfast)
    = Price Per Night

Price Per Night × Number of Nights
    = Room Subtotal

Room Subtotal + Add-ons Total
    = Grand Total Before Tax

Apply GST:
    If inclusive: Tax already inside price (reverse calculate)
    If exclusive: Add tax on top
    
    GST Slabs (example):
    ₹0–999/night    → 0% GST
    ₹1000–7499/night → 12% GST
    ₹7500+/night    → 18% GST

Grand Total - Promo Discount
    = Final Amount Charged
```

### Real-Time Rate Updates (SSE)

When a hotelier changes room rates:
1. Backend bumps a `rate_version:{hotel_id}` counter in Redis
2. Guest's browser is connected to `/public/hotels/{id}/rate-updates` (SSE stream)
3. SSE stream polls Redis every 30 seconds for version change
4. When version changes, backend sends `rate_update` event to guest's browser
5. Guest's browser automatically re-fetches room prices
6. Guest sees new prices without refreshing the page

### Two Guests Book The Same Last Room (Race Condition)

1. Guest A and Guest B both see 1 room available
2. Both click "Book" at the same time
3. Both send `POST /public/bookings`
4. Backend: **PostgreSQL locks the room type row** (`SELECT ... FOR UPDATE`)
5. Guest A's request gets the lock first
6. Guest A's booking is created — inventory goes to 0
7. Guest B's request waits for lock
8. Guest B's request runs — sees 0 available — gets `409 Conflict` error
9. Frontend shows Guest B: "Room No Longer Available"

---

## 10. External Services

### Supabase (Database + Auth)
- **What:** Hosts our PostgreSQL database + handles login/signup
- **Auth flow:** User logs in → Supabase gives JWT token → we verify that token on each API call
- **Config needed:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- **Where used:** `app/core/supabase.py`, `app/core/database.py`

### Razorpay (Payments)
- **What:** Indian payment gateway (credit card, UPI, net banking)
- **Flow:** Create order → Guest pays → Verify signature → Mark booking confirmed
- **Important:** Each hotel has its OWN Razorpay key in `hotel.settings.razorpay_key_id`. If a hotel doesn't have a Razorpay key configured, online payment is blocked.
- **Config needed:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **Where used:** `app/api/v1/public/payments.py`

### Brevo (Email)
- **What:** Sends booking confirmation emails to guests and hotels
- **Two modes:**
  1. Central: Uses `BREVO_API_KEY` (for hotels without custom SMTP)
  2. Per-hotel: Uses hotel's own SMTP settings from `hotel.settings`
- **Config needed:** `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- **Where used:** `app/core/email_service.py`

### Redis (Cache)
- **What:** Caches database results to avoid repeated DB queries. Also stores session tokens, idempotency keys.
- **Fallback:** If Redis is down, the app uses in-memory Python dict (slower but functional)
- **Config needed:** `REDIS_URL` (Railway format) or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
- **Where used:** `app/core/redis_client.py`

### AI Providers (Groq / OpenAI / Ollama)
- **What:** Powers the guest chatbot and hotelier AI agent
- **Guest chatbot:** Answers questions about availability, room types, amenities. Captures leads.
- **Hotelier agent:** Helps staff with booking queries, reports
- **Priority:** Uses hotel-specific AI settings first, then falls back to system defaults
- **Config needed:** `GROQ_API_KEY` or `OPENAI_API_KEY` or `OLLAMA_HOST`
- **Where used:** `app/core/guest_agent.py`, `app/core/global_agent.py`

### WhatsApp Business API (Meta)
- **What:** Sends WhatsApp booking confirmations
- **Model:** Staybooker manages one central WhatsApp account. Hotels cannot configure their own WhatsApp — only Staybooker staff (SUPER_ADMIN) can configure this via the Super Admin panel.
- **Config needed:** `CENTRAL_WHATSAPP_PHONE_ID`, `CENTRAL_WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`
- **Where used:** `app/api/v1/integration/whatsapp.py`

### Sentry (Error Monitoring)
- **What:** Catches and reports crashes automatically
- **Config needed:** `SENTRY_DSN` (optional, but recommended in production)
- **Frontend:** `@sentry/react` installed
- **Backend:** `sentry-sdk` installed

---

## 11. Environment Variables

### Backend (set in Railway or .env file)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth
SECRET_KEY=your-random-secret-key-min-32-chars
MASTER_ADMIN_EMAILS=admin@staybooker.ai,tech@staybooker.ai

# App URLs
API_URL=https://api.staybooker.ai
FRONTEND_URL=https://app.staybooker.ai
CORS_ORIGINS=["https://app.staybooker.ai","https://staybooker.ai"]

# Redis
REDIS_URL=redis://:password@host:6379

# Email
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@staybooker.ai
BREVO_SENDER_NAME=Staybooker

# Payments
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# AI
GROQ_API_KEY=gsk_...

# WhatsApp
CENTRAL_WHATSAPP_PHONE_ID=...
CENTRAL_WHATSAPP_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...

# Never set DEBUG=True in production
DEBUG=False
```

### Frontend (set in Railway or .env file)

```bash
VITE_API_URL=https://api.staybooker.ai/api/v1
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

---

## 12. Deployment

### Architecture
```
Internet → Railway (Frontend) → React App (Static Files)
         → Railway (Backend)  → Gunicorn (2 workers) → FastAPI
                              → Railway (Redis)       → Cache
                              → Supabase             → PostgreSQL
```

### Backend Startup Sequence
1. Gunicorn starts 2 Uvicorn workers
2. FastAPI app initializes
3. `init_db()` runs:
   - Connects to PostgreSQL
   - Runs any pending Alembic migrations automatically
   - Adds missing columns if needed (safe — won't break existing data)
4. Redis connection tested
5. Background tasks start (subscription expiry checks)
6. App ready to serve requests

### Database Migrations
- **Tool:** Alembic (in `/backend/alembic/`)
- **Auto-run:** Yes. On every startup, `init_db()` applies pending migrations.
- **No manual steps needed** after deployment.
- **To create a new migration** (for schema changes):
  ```bash
  cd backend
  alembic revision --autogenerate -m "add new column"
  alembic upgrade head  # apply manually if needed before deploy
  ```

### Docker
```bash
cd backend
docker build -t staybooker-api .
docker run -p 8000:8000 --env-file .env staybooker-api
```

---

## 13. Caching Strategy

| What Gets Cached | Cache Duration | Cache Key Format |
|------------------|---------------|-----------------|
| Dashboard stats | 30 seconds | `dashboard:stats:{hotel_id}` |
| Room search results | 30 seconds | `rooms:search:{hotel_id}:{dates}:{guests}` |
| Hotel info by slug | 5 minutes | `hotel:slug:{slug}` |
| Hotel info by ID | 5 minutes | `hotel:id:{hotel_id}` |
| Auth token payload | 10 minutes | `auth:token:{token_prefix}` |
| Rate version (for SSE) | Permanent | `rate_version:{hotel_id}` |
| Add-ons list | 1 hour | `addons:{hotel_id}` |

**Cache invalidation:**
- When a rate plan is updated → room search cache is cleared for that hotel
- When hotel settings change → hotel cache is cleared
- When rooms are updated → room cache is cleared

---

## 14. Security Rules

### What Hoteliers CANNOT Do
- Cannot see other hotel's data (enforced by `hotel_id` filter on every query)
- Cannot set WhatsApp API credentials (blocked by `strip_sensitive_from_update()` in `hotels.py`)
- Cannot set AI API keys directly (same protection)
- Cannot access `/superadmin/*` routes

### What Guests CANNOT Do
- Cannot access any `/api/v1/*` route that requires auth
- Cannot create more than 5 bookings per minute per IP (rate limiter)
- Cannot double-submit a booking (idempotency key in Redis)

### Payment Security
- Razorpay webhook signature verified with HMAC-SHA256
- Payment verification uses idempotency (same payment cannot be processed twice)
- No payment credentials stored in our database — only Razorpay's references

### Input Validation
- All API inputs validated via Pydantic models (backend)
- All form inputs validated via Zod schemas (frontend)

### CORS
- Only `CORS_ORIGINS` from env var are allowed
- Public booking endpoints accessible from any origin (needed for embeds)

### Security Headers (on every response)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## 15. Common Bugs & How To Debug

### "Something went wrong" on booking page
**Cause:** React hooks violation — a hook (useState, useEffect, useMemo) called after an early return in a component.
**How to find:** Look for `if (something) return null` BEFORE a hook call in the same component. All hooks must be at the top, before any returns.
**Files to check first:** `BookingCheckout.tsx`, `SocialProofWidget.tsx`

### Email not sending
**Check this order:**
1. Is `BREVO_API_KEY` set in environment?
2. Does the hotel have custom SMTP in `hotel.settings`? If yes, check those credentials.
3. Check backend logs for email errors
4. Test with `POST /api/v1/integration/test-ai` (wrong endpoint but shows service connectivity)

### Payments failing
**Check:**
1. Does the hotel have `razorpay_key_id` in `hotel.settings`? Without this, online payment is blocked.
2. Is `RAZORPAY_KEY_SECRET` set in backend env?
3. Check backend logs — signature verification errors appear there
4. Make sure `RAZORPAY_WEBHOOK_SECRET` matches what's set in Razorpay dashboard

### Room shows 0 availability but there are rooms
**Check:**
1. Is `room_types.is_active = true`?
2. Are there `room_blocks` covering those dates?
3. Are there existing bookings for those dates?
4. Check `room_types.total_inventory` — is it more than 0?

### Login not working
**Check:**
1. Is Supabase running? Check `SUPABASE_URL`
2. Is `SUPABASE_SERVICE_ROLE_KEY` correct?
3. Is the user's `is_active = true` in database?
4. Is the hotel's `is_active = true`?
5. Check Redis — if Redis is down, auth still works (no cache), just slower

### Dashboard shows wrong/stale numbers
**Reason:** Stats are cached for 30 seconds. Wait 30 seconds and refresh.
**Force refresh:** SUPER_ADMIN can clear cache from Super Admin panel.

### New column added to model but DB error says column doesn't exist
**Fix:** Add the column to `init_db()` in `database.py` with a safe `ALTER TABLE` (it runs on startup). OR create an Alembic migration.

### API returns 422 Unprocessable Entity
**Cause:** Request body doesn't match Pydantic schema.
**Debug:** Check the response body — it lists exactly which fields are wrong. Check field types (string vs int, required vs optional).

### Frontend build fails in CI
**Check:**
1. `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` must be set even for builds
2. Run `npm run build` locally first to see TypeScript errors

---

## Quick Reference

**To add a new page:**
1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add link in sidebar if needed

**To add a new API endpoint:**
1. Create function in relevant file in `backend/app/api/v1/`
2. Register router in `backend/main.py` if it's a new file
3. Add Pydantic model for request/response if needed

**To add a new database column:**
1. Add field to model in `backend/app/models/`
2. Create Alembic migration: `alembic revision --autogenerate -m "description"`
3. OR add safe `ALTER TABLE` in `init_db()` for quick deploys

**To find where something is configured:**
- Hotel-level settings → `hotel.settings` JSON
- System-level settings → Environment variables → `app/core/config.py`
- Per-integration settings → `integration_settings` table

---

*Last updated: June 2026. Generated from actual codebase.*
