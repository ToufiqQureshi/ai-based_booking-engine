# Staybooker — Complete Product Feature Reference

> Last updated: June 2026  
> Audience: Market research, sales, investor demos, competitive analysis

---

## Table of Contents

1. [Hotelier Dashboard](#1-hotelier-dashboard)
2. [Room Management](#2-room-management)
3. [Bookings & Guests](#3-bookings--guests)
4. [Finance](#4-finance)
5. [Marketing & Growth](#5-marketing--growth)
6. [Settings & Configuration](#6-settings--configuration)
7. [Analytics & Insights](#7-analytics--insights)
8. [AI Agent](#8-ai-agent)
9. [Public Booking Engine](#9-public-booking-engine)
10. [Embeddable Widgets](#10-embeddable-widgets)
11. [Multi-Property (Chain)](#11-multi-property-chain)
12. [Super Admin (Platform)](#12-super-admin-platform)
13. [Feature Matrix vs Competitors](#13-feature-matrix-vs-competitors)

---

## 1. Hotelier Dashboard

**Route:** `/dashboard`

The central command center for daily hotel operations.

| Feature | Description |
|---|---|
| Live KPI Cards | Today's Arrivals, Departures, Occupancy, Revenue — with % trend vs yesterday |
| Recent Bookings | Real-time feed of latest guest activity via WebSocket |
| Pending Actions | Count of bookings needing confirmation with direct link |
| Market Insight | Your price vs. competitor average + AI pricing suggestion |
| AI Setup Alert | One-tap toast to configure AI concierge if not set up |
| Real-time Updates | WebSocket-powered — new bookings appear instantly without refresh |

---

## 2. Room Management

### Room Types — `/rooms`

| Feature | Description |
|---|---|
| Create / Edit / Delete | Full CRUD for room types |
| Room Images | Upload multiple images per room |
| Description & Amenities | Rich text description + icon-based amenity list |
| Base Price | Default nightly rate per room type |
| Packages | Bundle rooms with services (e.g. "Honeymoon Package") |
| Grid / List View | Toggle between card grid and compact list |
| Search & Filter | Filter by name, description |

### Availability Calendar — `/availability`

| Feature | Description |
|---|---|
| 14-Day Grid View | Visual inventory overview with color-coded status |
| Status Indicators | Green (Available) / Amber (Limited <30%) / Red (Sold Out) / Grey (Blocked) |
| Daily Rate Override | Set a custom price for any specific date |
| Date Range Rate Update | Bulk-update prices across a custom date range |
| Weekend Pricing | Bulk-update all Saturdays & Sundays in a range |
| Calendar Copy | Copy rates + availability from one period to another |
| Room Block / Unblock | Block rooms for maintenance, holds, etc. |
| Occupancy Stats | Summary card: total / available / booked / blocked / occupancy % |
| Room Type Filter | View one room type at a time |
| Navigate Periods | Prev / Next 14 days, jump to Today |

---

## 3. Bookings & Guests

### Bookings — `/bookings`

| Feature | Description |
|---|---|
| Search | By booking number, guest name, or email |
| Status Filter | All / Pending / Confirmed / Checked-In / Checked-Out / Cancelled / Cancel Requested |
| Source Filter | Online / Walk-in / Phone / Booking.com / Agoda / Airbnb / WhatsApp / AI Agent |
| Booking Details | Full breakdown: rooms, dates, guest info, payment, add-ons |
| Edit Booking | Modify dates, rooms, guest details |
| Manual Booking | Create walk-in or phone bookings directly from dashboard |
| Real-time Updates | WebSocket notifications for new/updated/cancelled bookings |
| CSV Export | Download full booking list |
| Pagination | 20 per page with offset navigation |

### Leads Tab (within Bookings)

| Feature | Description |
|---|---|
| AI-Generated Leads | Leads captured from AI concierge chat interactions |
| Status | Open / Converted / Lost |
| Conversation Summary | AI-written summary of guest interest |
| Guest Info | Name, room preference, dates, contact |
| Filter by Status | Track conversion funnel |

### Guests — `/guests`

| Feature | Description |
|---|---|
| Master Guest List | All guests across every booking, deduplicated by email |
| Guest Card | Name, email, phone, avatar initials |
| Lifetime Stats | Total bookings count + total spend |
| Repeat Guest Badge | Automatically flagged for returning guests |
| Last Booking Date | Quick reference for recency |
| Guest Profile | Drill down to full booking history per guest |
| Search | By name or email |

---

## 4. Finance

### Rate Plans — `/rates`

| Feature | Description |
|---|---|
| Create / Edit / Delete | Full CRUD for rate plans |
| Meal Plan Types | EP (room only) / CP (breakfast) / MAP (half-board) / AP (full-board) |
| Active / Inactive Toggle | Publish or hide rate plans from guests |
| Assigned Room Types | Link rate plans to specific room types |

### Payments — `/payments`

| Feature | Description |
|---|---|
| Transaction History | Full log of all payment events |
| Status Tracking | Completed / Pending / Failed / Refunded / Partial Refund |
| Search | By payment ID, booking number, or guest name |
| Date & Status Filter | Narrow down transaction lists |
| Invoice Generation | Per-booking PDF invoice with hotel branding |

### Taxes — `/taxes`

| Feature | Description |
|---|---|
| Tax Name & Rate | Configurable % (e.g. GST 12%) |
| Inclusive vs Exclusive | Tax included in price or added on top |
| Flat vs Slab-Based | Fixed rate or tiered slabs by amount |
| Dynamic Slabs | Add/remove slabs: from amount → to amount → rate |
| Add-on Tax | Separate rate for service add-ons |

---

## 5. Marketing & Growth

### Add-ons — `/addons`

| Feature | Description |
|---|---|
| Services | Create experiences guests can add at booking (spa, airport transfer, tours) |
| Hotel Amenities | List hotel-wide facilities (pool, gym, parking) with icons |
| Room Amenities | List per-room features (AC, TV, minibar) with icons |
| Icon Picker | 25+ icons (WiFi, TV, Pool, etc.) |
| Categories | General / Tech / Wellness / Dining / Room |
| Enable / Disable | Toggle visibility without deleting |
| Upsell at Checkout | Add-ons surface during guest checkout |

### Rate Shopper — `/rate-shopper`

| Feature | Description |
|---|---|
| Competitor Tracking | Add OTAs by URL (Booking.com, Agoda, MakeMyTrip, etc.) |
| Real-time Scraping | Live status per competitor: Running / Idle / Failed |
| Price Comparison Chart | Line graph: your rate vs. all competitors over time |
| AI Pricing Recommendation | Smart suggestion based on market position |
| Auto-sync Schedule | Set a daily refresh time |
| Usage Metrics | Scraping API call counts |
| Error Handling | Friendly messages for OTA blocks or timeouts |
| Competitor Limit | Enforced per subscription plan |

### Google Reviews — `/reviews`

| Feature | Description |
|---|---|
| Google Business Connect | OAuth connection to Google Business Profile |
| Review Filters | By star rating (1–5), unanswered only, search text |
| AI Reply Suggestions | One-click AI-generated reply for any review |
| Post Reply | Sends reply directly to Google — no separate login needed |
| Disconnect | Unlink Google account |

### Loyalty Program — `/loyalty`

| Feature | Description |
|---|---|
| Enable / Disable | Turn program on/off without losing config |
| Program Name | Custom name (e.g. "Club Rewards") |
| Milestone | Number of bookings to trigger reward |
| Reward Types | % discount / fixed amount off / free night |
| Custom Popup | Personalized message shown to guest at booking completion |
| Guest Progress | See each guest's booking count, % to next reward, bookings remaining |

---

## 6. Settings & Configuration

### Hotel Settings — `/settings`

| Tab | Features |
|---|---|
| General | Name, slug, stars, address (street / city / state / country / postal), phone, email, website, currency, timezone |
| Branding | Logo upload, primary color picker, featured room selector, live widget preview |
| Policies | Cancellation policy text, cancellation mode (Instant / Request), payment mode (Online / At Property / Both), child policy, privacy policy, T&C, important notes |
| Email / SMTP | Host, port, username, password, from address, sender name, CC list, email signature, notification toggles (new booking, cancellation) |
| Team | Add / Edit / Remove team members, assign roles (Owner / Manager / Staff) |
| AI Agent | Configure concierge behavior, model, response style |
| Google Hotel Ads | Link Google Hotel Ads account |
| WhatsApp | API key, Phone Number ID, Business Account ID |
| Multi-room Cart | Enable / Disable multi-room bookings |

### Integrations — `/integration`

| Tab | Features |
|---|---|
| Booking Widget | HTML + JS embed code, copy to clipboard, allowed domains, custom CSS/JS |
| Search Widget | Standalone date-search bar embed |
| Chat Widget | AI concierge chat embed code |
| API Keys | Create / Revoke keys, view prefix, request count per key |
| Webhook | Configure webhook URL for external integrations |
| Usage | API call metrics, rate limit info |

### Channel Manager — `/channel-settings`

| Feature | Description |
|---|---|
| Provider Connect | Select OTA provider (STAAH, etc.), enter API credentials |
| Room Mapping | Map local room IDs to channel room IDs |
| Sync Logs | Full history with timestamps + success/failure messages |
| Connection Test | Verify credentials before saving |

---

## 7. Analytics & Insights

**Route:** `/analytics`

### KPI Cards
- Visitors, Conversion Rate, Revenue, ADR, RevPAR, Occupancy Rate
- Leads generated, AI-assisted bookings, AI resolution rate, AI-attributed revenue

### Charts & Reports
| Chart | Description |
|---|---|
| Revenue Trends | Area chart over selected date range |
| Conversion Funnel | Page Views → Searches → Room Views → Checkout → Bookings |
| Device Breakdown | Desktop / Mobile / Tablet split |
| Top / Bottom Rooms | Most and least booked room types |
| Promo Code Usage | Which promos drive bookings |
| Booking Window | How far in advance guests book |
| 30-Day Forecast | Occupancy prediction for next month |
| Geographic Stats | Visitor countries with flags |
| Traffic Heatmap | Day-of-week × hour-of-day grid |
| Live Event Feed | Real-time bookings, searches, room views |

### Controls
- Date range selector (custom + presets)
- Export reports button
- Tab navigation: Overview / Traffic / Conversions / Revenue / Occupancy / Cancellations / AI Agent

---

## 8. AI Agent

**Route:** `/agent`

| Feature | Description |
|---|---|
| Natural Language Chat | Ask questions in plain language ("What was my revenue last week?") |
| Data-Aware | Has access to your hotel's bookings, revenue, guests, occupancy |
| Chart Generation | Auto-generates line, bar, pie charts embedded in responses |
| Markdown Output | Formatted tables, lists, and text |
| Chat History | Scroll back through previous questions |

---

## 9. Public Booking Engine

The guest-facing booking experience, accessible at `yourdomain.com/book/[hotel-slug]/`.

### Room Selection — `/book/:slug/rooms`

| Feature | Description |
|---|---|
| Date Picker | Inline calendar for check-in / check-out |
| Guest Config | Adults / Children / Rooms count |
| Promo Code | Apply discount codes with live validation |
| Flexible Dates | Toggle to show nearby date alternatives |
| Room Cards | Image carousel, name, description, amenity icons, price |
| Rate Plan Selection | Compare plans (room-only, breakfast, half-board, etc.) |
| Add-on Selection | Browse and add experiences at room selection |
| Multi-room Cart | Select multiple rooms in one booking |
| Sort & Filter | Price low/high, amenities filter, room type filter |
| Social Proof | Recent bookings and reviews widget |
| AI Concierge | Embedded chat for guest questions |
| Real-time Pricing | SSE-powered — price + availability updates within 2 seconds of hotelier change |
| Loyalty Popup | Shows reward status for returning guests |

### Checkout — `/book/:slug/checkout`

| Feature | Description |
|---|---|
| Guest Info | First name, last name, email, phone, special requests |
| Order Summary | Room(s), dates, taxes, add-ons, discounts, total |
| Payment Modes | Online (Razorpay) or Pay at Property |
| Add-on Upsell | Final chance to add services at checkout |
| Loyalty Redemption | Apply earned reward (discount or free night) |
| Promo Code | Apply code with discount applied live |
| Terms Acceptance | Policy checkbox before submit |
| Idempotency | Duplicate-safe — resubmitting doesn't create double booking |

### Confirmation — `/book/:slug/confirmation`

| Feature | Description |
|---|---|
| Booking Reference | Unique booking number displayed prominently |
| Full Summary | Rooms, dates, guest info, add-ons, taxes, total |
| Payment Status | Confirmed / Pending / Failed |
| PDF Invoice | Download invoice with hotel branding |
| Print | Browser print trigger |

### Guest Cancellation — `/book/:slug/cancel`

| Feature | Description |
|---|---|
| Booking Lookup | Search by booking number + email |
| Policy Display | Cancellation terms and refund eligibility |
| Refund Calculation | Live calculation of refund amount |
| Cancellation Modes | Instant (immediate) or Request-based (awaiting hotelier approval) |
| Confirmation Dialog | Final confirm step before processing |

---

## 10. Embeddable Widgets

All widgets are iframe-based, embeddable on any website with a single script tag.

### Booking Widget — `/book/:slug/widget`

| Feature | Description |
|---|---|
| 4 Layout Options | Floating button / Classic stacked / Minimal bar / Premium capsule |
| Color Theming | Primary + background color customization |
| Dark / Light Mode | Theme toggle |
| Custom CSS/JS | Inject custom code per hotel |
| Responsive | Mobile / tablet / desktop auto-adapt |
| Auto-height | iframe height adjusts dynamically to content |

### AI Chat Widget — `/book/:slug/chat`

| Feature | Description |
|---|---|
| Embeddable Chat | Transparent iframe overlay on any page |
| AI Concierge | Answers guest questions, captures leads |
| Color Theming | Match hotel brand color |

### Chain Booking Widget — `/book/chain/:chainSlug/widget`

| Feature | Description |
|---|---|
| Multi-property | Property selector shows all hotels in chain |
| Chain Branding | Uses chain logo and colors |
| Unified Flow | Once property selected, standard booking flow continues |

---

## 11. Multi-Property (Chain)

**Route:** `/chain/dashboard`

For hotel groups managing multiple properties under one account.

| Feature | Description |
|---|---|
| Aggregate KPIs | Combined revenue, occupancy, bookings across all properties |
| Top Performer | Property with highest revenue in period |
| Needs Attention | Property with lowest occupancy / most cancellations |
| Revenue by Hotel | Table: each property's revenue, bookings, occupancy, ADR |
| Property Switch | Jump directly to any property's dashboard |
| Cross-property Guests | Identify guests who stayed at multiple properties |
| Top Guests | Highest-spending guests across the entire chain |
| Charts | Revenue trends, occupancy comparison, booking trends |
| Period Selector | 7d / 30d / 90d / 1yr / All-time |

---

## 12. Super Admin (Platform)

For the Staybooker platform owner only. Not visible to hoteliers.

| Section | Features |
|---|---|
| Overview | Platform-wide KPIs: total revenue, hotels, bookings, users |
| Hotels | All properties, feature toggles per hotel, hotel workspace |
| Users | All platform users, roles, activity |
| Brand Groups | Chain/brand grouping management |
| Plan Features | Feature flags per subscription tier |
| KYC | Document verification, hotelier approval workflow |
| Commissions | Commission rates per plan, calculation tracking |
| Payouts | Payout history, pending payouts, status tracking |
| Tickets | Support ticket management, priority, assignment |
| Analytics | Platform-wide traffic, bookings, revenue trends |
| Revenue | Revenue breakdown by hotel / plan / month |
| Health Monitor | API response times, database status |
| Broadcasts | Send announcements to all hotels |
| Audit Trail | Every platform action logged and exportable |
| Sessions | Active user sessions, force logout |
| Cache | Clear cache by type, hit rate metrics |
| Platform Settings | Global config, feature flags, rate limits |

---

## 13. Feature Matrix vs Competitors

For market research — compare Staybooker against common alternatives.

| Feature | Staybooker | Cloudbeds | Little Hotelier | Hostelworld | D-Edge |
|---|---|---|---|---|---|
| Direct Booking Engine | ✅ | ✅ | ✅ | ✅ | ✅ |
| Embeddable Widget | ✅ (4 layouts) | ✅ | ✅ | ❌ | ✅ |
| Real-time SSE Price Updates | ✅ (2s) | ❌ | ❌ | ❌ | ❌ |
| AI Concierge Chat | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI Analytics Agent | ✅ | ❌ | ❌ | ❌ | ❌ |
| Competitor Rate Shopper | ✅ (built-in) | Addon | Addon | ❌ | ✅ |
| AI Review Reply (Google) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Loyalty Program | ✅ | ❌ | ❌ | ✅ | ❌ |
| Multi-room Cart | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-property (Chain) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Channel Manager | ✅ (STAAH) | ✅ | ✅ | ❌ | ✅ |
| WhatsApp Integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Google Hotel Ads | ✅ | ✅ | ❌ | ❌ | ✅ |
| Revenue Analytics | ✅ | ✅ | ✅ | ❌ | ✅ |
| Booking Conversion Funnel | ✅ | ❌ | ❌ | ❌ | ✅ |
| INR / India-first Payments | ✅ (Razorpay) | Limited | Limited | ❌ | Limited |
| Slab-based GST Tax | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pay at Property Mode | ✅ | ✅ | ✅ | ❌ | ✅ |
| Lead Capture via AI Chat | ✅ | ❌ | ❌ | ❌ | ❌ |
| Open Source / Self-host | ❌ | ❌ | ❌ | ❌ | ❌ |

> Note: Competitor data is based on publicly available information as of June 2026. Mark cells with "?" if unverified — verify before using in investor/sales materials.

---

## Platform Tech Stack (for technical buyers)

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python), async SQLModel, PostgreSQL (Supabase) |
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui |
| Real-time | WebSocket (staff), SSE (guests), Redis pub-sub |
| Auth | Supabase Auth (JWT) |
| Payments | Razorpay |
| AI | Claude / Groq (configurable per hotel) |
| Deployment | Railway (backend), Cloudflare Pages (frontend) |
| Cache | Redis (rate limiting, SSE version tracking, analytics) |
| Scraping | Chrome Extension + Decodo proxy |

---

*This document is auto-generated from codebase analysis. Update after each major feature release.*
