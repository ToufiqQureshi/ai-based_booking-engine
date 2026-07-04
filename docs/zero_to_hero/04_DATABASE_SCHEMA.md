# 04 — Database Schema

**Total tables: 42** (SQLModel classes with `table=True`, verified by reading actual model files — not the graphify graph, jo stale hai kuch table names ke liye, jaise neeche note kiya gaya hai).

> ⚠️ Note: Purani/graphify docs mein `CommissionLedger`, `Payout`, `BankAccount`, `SupportTicket`, `TicketMessage` jaise tables mention hote hain — **ye tables is codebase mein exist hi nahi karte** (verified — koi bhi file `commission.py`/`ticket.py` nahi mili). Inke permission-strings (`superadmin.commissions.*` etc.) `SuperAdminRole` model mein zaroor hain, par unke corresponding tables/routers absent hain — shayad planned-but-not-built features hain.

---

## Multi-Tenant Isolation — Sabse Pehle Ye Samjho

Har table mein (jahan applicable ho) ek `hotel_id` column hota hai. **Koi shared `mt()` helper function nahi hai** — pattern manual hai:
```python
select(RatePlan).where(RatePlan.hotel_id == current_user.hotel_id)
```
Ye pattern **241 baar** repeat hota hai poore backend mein (grep count). Write karte waqt bhi `hotel_id` client se nahi liya jaata — server khud current_user se inject karta hai:
```python
rate_plan = RatePlan(**plan_data.model_dump(), hotel_id=current_user.hotel_id)
```
Isse guest/hotelier kabhi `hotel_id` spoof karke doosre hotel ka data nahi bana/dekh sakta. Kuch jagah aur bhi strict ownership-check functions hain:
- `_assert_room_type_owned()` — `backend/app/calendar/helpers.py:18` — koi room_type_id block/rate banane se pehle check karta hai ki wo caller ke hotel ka hi hai
- `_assert_room_belongs_to_hotel()` — `backend/app/loyalty/loyalty.py:225`

Cache keys bhi tenant-scoped hain — `cache_response` decorator (`backend/app/core/cache/cache.py:21`) hotel_id ko cache key mein append kar deta hai, taaki ek hotel ka cached data doosre hotel ko na dikh jaaye.

---

## CORE TABLES

### `users` — User (`backend/app/guests/user.py:32`)
**Kyun:** Auth/identity — har staff member ek hotel se juda hota hai.
| Column | Type | Note |
|---|---|---|
| id | str PK | UUID |
| email | str | unique, index |
| name | str | |
| role | Enum | OWNER / MANAGER / STAFF / SUPER_ADMIN |
| supabase_id | Optional[str] | unique, index — Supabase Auth se link |
| hashed_password | str | |
| hotel_id | Optional[str] | FK → hotels.id, index |
| chain_id | Optional[str] | FK → chains.id, index |
| is_active | bool | default True |
- Relationships: `hotel`, `chain`

### `hotels` — Hotel (`backend/app/brand_console/hotel.py:153`)
**Kyun:** Tenant root — har doosri domain table `hotel_id` se isी se judti hai.
| Column | Type | Note |
|---|---|---|
| id | str PK | |
| name, slug | str | slug unique (URL: `/book/{slug}`) |
| star_rating | int | 1-5 |
| amenities | List[str] | JSON |
| feature_ai_agent, feature_guest_bot, feature_ai_assistant, feature_new_booking, feature_color_palette, feature_custom_logo, feature_custom_widget, feature_google_ads | bool | Per-hotel feature flags (subscription-plan gated) |
| is_paused, pause_reason, paused_at | | Soft-pause by super admin |
| chain_id | Optional[str] | FK → chains.id |
| address, contact, settings | JSON dict | `settings` = BIG JSON (currency, timezone, tax slabs, SMTP config, Razorpay keys...) |
| photos, videos | List[dict] | JSON |
| ai_provider, ai_api_key, ai_api_key_vault_id, ai_model, ai_base_url, ai_max_tokens | | Hotel-specific AI config |
- Relationships: `users`, `room_types`, `bookings`, `rate_plans` (cascade delete-orphan), `subscription` (1:1 cascade), `chain`

### `chains` — Chain (`backend/app/superadmin/chains/chain.py:10`)
**Kyun:** Multi-property hoteliers ke liye ek brand ke neeche kai hotels group karna.
| Column | Note |
|---|---|
| id, name, slug (unique), logo_url, primary_color, is_active | |
| widget_layout, widget_bg_color, widget_theme, widget_show_price, widget_show_loyalty, widget_show_property_count | Chain-wide widget branding |
- Relationships: `hotels`, `users` (dono cascade delete-orphan)

### `guests` — Guest (`backend/app/bookings/booking.py:70`)
**Kyun:** Booking karne wala insaan — `User` (staff) se alag entity.
| Column | Note |
|---|---|
| first_name, last_name, email (index), phone, nationality, id_type, id_number, address | |
| hotel_id | FK, index |
- Relationship: `bookings`

### `bookings` — Booking (`backend/app/bookings/booking.py:128`)
**Kyun:** Core transactional record — reservation + financial state.
| Column | Note |
|---|---|
| hotel_id | FK, index |
| guest_id | FK → guests.id |
| booking_number | unique, index |
| check_in, check_out | date, dono index |
| status | Enum: pending/confirmed/cancelled/checked_in/checked_out/cancel_requested, index |
| total_amount, paid_amount, subtotal_amount, tax_amount, discount_amount, cancellation_fee, refund_amount, refund_status | ≥0 constraints |
| source | Enum: direct/booking_engine/manual/ai_agent/walk_in/phone/online/booking_com/agoda/airbnb/goibibo/makemytrip/travel_agent/corporate/whatsapp |
| rooms | List[dict] JSON — booking-time snapshot (**not** a separate table) |
| addons, tax_details | JSON |
| created_at | **index** — DB-01 comment: needed for fast recent-booking queries |
| recovery_sent_at | Optional[datetime] — abandoned-booking nudge tracking |
- Relationships: `hotel`, `payments`, `guest`

### `booking_timeline` — BookingTimeline (`backend/app/bookings/timeline.py:7`)
**Kyun:** Audit trail — booking pe har status-change/event ka history.
| Column | Note |
|---|---|
| booking_id | FK, index |
| event_type, old_value, new_value, message | |
| metadata_json | JSON |
| changed_by | user id / "system" / "ai" |

### `user_hotel_links` — UserHotelLink (`backend/app/bookings/links.py:5`)
**Kyun:** Many-to-many — ek staff kai hotels mein kaam kar sakta hai.
| Column | Note |
|---|---|
| user_id, hotel_id | Composite PK, dono FK, dono index |
| role | hotel-specific role, default "OWNER" |
| is_active, joined_at | |

### `payments` — Payment (`backend/app/payments/payment.py:42`)
**Kyun:** Har payment/refund transaction ka record — server-computed amounts.
| Column | Note |
|---|---|
| hotel_id, booking_id | FK |
| amount | 0 ≤ x ≤ 100,000,000 |
| status | pending/completed/failed/refunded/partial_refund |
| gateway_reference, reference_number | |
| transaction_id | **unique**, index — "PAY-2: prevents double-recording a gateway txn on webhook replay/verify race" |

---

## PRICING & INVENTORY TABLES

### `room_types` — RoomType (`backend/app/rooms/room.py:68`)
**Kyun:** Sellable unit (e.g. "Deluxe Room").
| Column | Note |
|---|---|
| hotel_id | FK |
| base_occupancy, max_occupancy, max_children, extra_bed_allowed | |
| base_price (≥0), total_inventory (≥0), is_active | |
| extra_person_price, extra_adult_price, extra_child_price | |
| photos, videos, amenities | JSON |
| rate_plan_overrides | Optional[Dict] JSON |
- Relationships: `rates` (→ RoomRate), `hotel`

### `room_blocks` — RoomBlock (`backend/app/rooms/room.py:163`)
**Kyun:** Manual inventory holds (maintenance/OOO) — bookable count kam karta hai.
| Column | Note |
|---|---|
| hotel_id, room_type_id | FK |
| start_date, end_date | date |
| blocked_count | ≥1 — partial inventory bhi block ho sakta hai |

### `amenities` — Amenity (`backend/app/rooms/amenity.py:12`)
Reusable amenity catalog (wifi, pool) per hotel — `scope` = "room" ya "hotel".

### `room_amenity_links` — RoomAmenityLink (`backend/app/rooms/amenity.py:7`)
M2M join: RoomType ↔ Amenity. Composite PK.

### `rate_plans` — RatePlan (`backend/app/rate_plans/rates_model.py:48`)
**Kyun:** Pricing/package tier (EP/CP/MAP/AP meal plans, refundable/non-refundable).
| Column | Note |
|---|---|
| meal_plan | default "EP" |
| price_adjustment, is_refundable, cancellation_hours | |
| min_los, advance_purchase_days | Minimum stay / advance booking window |
| is_package, package_items, inclusions | JSON — package deals |
| valid_from, valid_to | Optional — seasonal window |
- Relationships: `hotel`, `rates`

### `room_rates` — RoomRate (`backend/app/rate_plans/rates_model.py:68`)
**Kyun:** Daily/date-range override price. No override → falls back to `room_types.base_price`.
| Column | Note |
|---|---|
| room_type_id | FK |
| rate_plan_id | Optional FK (null = applies to all plans) |
| date_from, date_to | both index |
| price | float |

### `promo_codes` — PromoCode (`backend/app/rate_plans/promo.py:16`)
**Kyun:** Discount codes — hotel- ya chain-scoped.
| Column | Note |
|---|---|
| hotel_id (Optional), chain_id (Optional) | FK |
| code (index), discount_type (percentage/fixed_amount), discount_value | |
| max_usage, current_usage | |
| auto_apply | index — auto seasonal deal vs classic manual coupon |

### `pricing_rules` — PricingRule (`backend/app/revenue/pricing_model.py:27`)
**Kyun:** Hotelier-defined dynamic pricing (occupancy/day-of-week/lead-time/seasonal), deterministically stacked by `pricing_engine.py`.
| Column | Note |
|---|---|
| room_type_id | Optional FK — null = all room types |
| rule_type | occupancy/day_of_week/lead_time/seasonal |
| adjustment_type, adjustment_value, priority | |
| occupancy_min/max, days_of_week (JSON), lead_time_min/max, date_from/to | Condition params |
| min_price, max_price | Guard rails — price kabhi bhi in bounds se bahar nahi jaayega |

---

## GUEST EXPERIENCE TABLES

### `addons` — AddOn (`backend/app/experiences/addon.py:7`)
Extra purchasable services (spa, breakfast). ⚠️ `hotel_id` yahan **plain string hai, FK nahi declared** — baaki tables se alag.

### `loyalty_programs` — LoyaltyProgram (`backend/app/loyalty/loyalty_model.py:10`)
**Kyun:** Repeat-guest reward config, hotel- ya chain-level.
| Column | Note |
|---|---|
| hotel_id | Optional FK, **unique** (nullable for chain-level programs) |
| milestones | List[dict] JSON — multi-milestone config (ek alag table nahi, JSON hi kaafi hai) |
| points_enabled, points_per_currency, point_value | Points wallet |

### `loyalty_offers` — LoyaltyOffer (`backend/app/loyalty/loyalty_model.py:47`)
Stay-length-based upsell offers (e.g. "3 raat rukiye, free upgrade paaiye"), room-scoped ya sab rooms.

### `guest_loyalty` — GuestLoyalty (`backend/app/loyalty/loyalty_model.py:109`)
Per-guest-email loyalty progress tracker (total bookings, spend, points balance).

---

## INTEGRATION & PLATFORM TABLES

### `api_keys` — APIKey (`backend/app/integration/integration.py:12`)
Hotelier apne khud ke website se booking engine call karne ke liye jo key issue karta hai. `key_hash` — kabhi raw key store nahi hoti.

### `integration_settings` — IntegrationSettings (`backend/app/integration/integration.py:43`)
**Kyun:** Per-hotel widget/webhook/AI/Google config (1:1 with hotel, `hotel_id` unique). Widget theme/layout/CSS/JS, webhook URL+secret, AI provider config, Google Business/Ads config — sab yahan.

### `channel_manager_settings` / `channel_room_mappings` / `channel_logs` (`backend/app/channel_manager/channel_manager_model.py`)
OTA (Channex) integration — connection config, RoomType↔OTA room mapping, sync activity logs.

### `hotelier_api_keys` — HotelierApiKey (`backend/app/superadmin/platform/platform_model.py:12`)
⚠️ `api_keys` se **alag** — ye wo key hai jo hotelier khud Staybooker platform API call karne ke liye use karta hai (reverse direction).

### `custom_domains` — CustomDomain (`backend/app/superadmin/platform/platform_model.py:42`)
White-label domain mapping (`book.example.com`) — DNS/SSL status tracking.

### `email_templates` — EmailTemplate (`backend/app/superadmin/platform/platform_model.py:68`)
Customizable email/SMS/WhatsApp templates — `hotel_id` null = platform-wide default.

### `super_admin_roles` — SuperAdminRole (`backend/app/superadmin/platform/platform_model.py:93`)
**Kyun:** Super-admin team ke andar bhi granular tiers (owner/finance/support/ops/viewer) — `permissions: List[str]` JSON. `DEFAULT_PERMISSIONS_BY_TIER` aur `TAB_PERMISSIONS` in-code dicts define karte hain kaunsi tier kya kar sakti hai. ⚠️ Kuch permission strings (`superadmin.commissions.*`, `.payouts.*`, `.tickets.*`, `.kyc.*`) yahan reference hoti hain par unke actual tables/routers exist nahi karte (planned-but-not-built).

---

## SYSTEM / OPS TABLES

### `system_broadcasts` — SystemBroadcast (`backend/app/system/audit.py:19`)
Platform-wide announcement banners, targeted by plan ya specific hotel IDs.

### `audit_logs` — AuditLog (`backend/app/system/audit.py:7`)
Security/compliance trail — kis admin ne kab kya action liya.

### `notifications` — Notification (`backend/app/dashboard/notification.py:7`)
Per-user in-app notification feed.

### `subscriptions` — Subscription (`backend/app/superadmin/subscriptions/subscription.py:9`)
**Kyun:** Hotel ka plan/billing state + AI/message quota governance.
| Column | Note |
|---|---|
| plan_name, status, payment_status | |
| whatsapp_credits, sms_credits | |
| ai_hotelier_daily_limit, ai_guest_chat_daily_limit, ai_whatsapp_daily_limit | Per-agent daily token budgets |
- Relationship: `hotel` (1:1)

---

## ANALYTICS TABLES

### `analytics_sessions` — AnalyticsSession (`backend/app/analytics/models.py:11`)
Ek visitor ka poora visit — device, browser, country, time_spent, `has_booked`.
- Relationship: `events` (cascade delete-orphan)

### `analytics_events` — AnalyticsEvent (`backend/app/analytics/models.py:46`)
Session ke andar individual actions (page_view, select_room, conversion).

### `report_share_links` — ReportShareLink (`backend/app/analytics/models.py:72`)
Public no-login token URL — hotel apna analytics report bahar share kar sakta hai (aggregate-only, PII nahi).

### `hotel_social_proof_settings` — HotelSocialProofSettings (`backend/app/google_reviews/social_proof_model.py:39`)
**Kyun:** "3 log dekh rahe hain", "2 ghante pehle book hua" jaisi widgets ke liye config + cached stats. `is_enabled`, `show_viewers_count` — hotelier-controlled. `cached_booking_count`, `cache_refreshed_at` — background job se update hote hain. Sirf real data — koi fake numbers nahi (CLAUDE.md rule).

### `ai_usage_daily` / `ai_usage_participant` (`backend/app/ai_assistant/ai_usage.py:20,40`)
**Kyun:** Redis fast hai par Railway pe kabhi-kabhi flap karta hai — ye Postgres tables durable source-of-truth hain AI token usage ke liye. `user_hash` (raw PII nahi, sirf hashed) se exact unique-user count milta hai.
- Unique constraints: `(hotel_id, agent_type, usage_date)` aur `(hotel_id, agent_type, usage_date, user_hash)`

---

## MARKETING / COMPETITION TABLES

### `leads` — Lead (`backend/app/brand_console/lead.py:17`)
AI chat ke beech mein capture hua guest contact info — sales-funnel status: new/contacted/converted/lost.

### `competitors` / `competitor_rates` (`backend/app/rate_shopper/competitor.py:16,37`)
Rate Shopper crawler jo OTA/competitor hotels ki pricing track karta hai — per date/room/meal-plan (EP/CP/MAP/AP) breakdown.

---

## Indexes — Kaun Se Columns Pe

Column-level `index=True` har jagah scattered hai (upar dekha). Composite indexes do jagah define hote hain:
1. **Model-level `__table_args__`** — `ai_usage_daily`/`ai_usage_participant` (unique constraints, section upar dekho)
2. **Raw SQL at startup** (`backend/app/core/db/database.py:399-415`) — `CREATE INDEX IF NOT EXISTS` se, kyunki `create_all` akela composite indexes nahi banata:
   - `idx_bookings_created_at`, `idx_bookings_dates (hotel_id, check_in, check_out)`, `idx_bookings_hotel_status_dates (hotel_id, status, check_in, check_out)` — comment: "hottest public query"
   - `idx_room_rates_lookup (room_type_id, date_from, date_to)`
   - `ix_users_email` (unique), `ix_users_supabase_id` (unique, partial `WHERE supabase_id IS NOT NULL`)
   - `idx_analytics_sessions_city`, `ix_report_share_links_token` (unique), `idx_loyalty_offers_broadcast`, `idx_promo_codes_auto_apply`

---

## Migrations — Kaise Chalte Hain

**Do systems hain, par production mein sirf ek hi chalta hai:**

1. **Alembic** — `database/alembic/versions/` (30 revision files) — historical record hai, par deploys isse **use nahi karte**.
2. **Inline ALTER TABLE patches** — `backend/app/core/db/database.py:75-525`, `init_db()` ke andar — **ye hi actually production mein chalta hai** (confirmed by explicit code comment).
   - Startup pe `SQLModel.metadata.create_all` (naye tables banata hai) + phir 40+ individual `ALTER TABLE ADD COLUMN` statements — idempotent (`try/except` jo sirf "already exists" errors ko silently ignore karta hai)
   - Fast-path guard: `_staybooker_schema_version` table version number store karta hai — agar already latest hai (currently version `13`), poora patch-block skip ho jaata hai (perf optimization — pehle har boot pe 40+ ALTER statements chalte the!)
   - Har patch block ek `DB-NN` comment tag ke saath hai jo batata hai kis production incident ki wajah se ye column add hua

**Confirmed: migrations auto-run hoti hain startup pe** (`init_db()` `lifespan()` context manager se call hota hai, `backend/main.py:66`) — alag se `alembic upgrade` chalane ki zaroorat nahi.
