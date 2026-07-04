# 03 — All API Endpoints

**Total endpoints in code: 198** route decorators (`@router.get/post/put/patch/delete/websocket`) across `backend/app/`.
**Actually reachable: 196.** Two are dead code — `GET /sessions` and `DELETE /sessions/{user_id}` in `backend/app/superadmin/platform/sessions.py:79,90` — this router is never `include_router`'d anywhere (confirmed by grepping `main.py`), left over from a June 2026 superadmin scope-trim (see `backend/app/superadmin/__init__.py:13-22`).

Base prefix for all `router.include_router` calls below: **`/api/v1`** (set at `backend/main.py:185`, `API_V1_PREFIX = "/api/v1"`), except two routes defined directly on `app`: `GET /health` (`main.py:156`) and `GET /` (`main.py:223`).

Auth column legend: **None** = public, no login. **User** = any logged-in user (`CurrentUser`). **OWNER/MANAGER** = role-gated (`require_hotel_role`). **SUPER_ADMIN** = `get_super_admin`/`require_permission`. **Feature** = role + a subscription feature-flag gate.

---

## auth (`backend/app/auth/auth.py` → `/api/v1/auth`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| POST | `/onboarding` | Set up hotel after first Supabase login | User (`get_current_user`, lighter than CurrentUser since hotel may not exist yet) | `auth.py:47` |

## users (`backend/app/guests/users.py` → `/api/v1/users`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/me` | Own profile | User | `:19` |
| GET | `` | List team members | User | `:29` |
| POST | `` | Add team member | User, `10/hour` rate-limit | `:62` |
| PATCH | `/me` | Update own profile | User | `:162` |
| PATCH | `/me/password` | Change password | User, `5/hour` rate-limit | `:184` |

## brand_console — hotels (`backend/app/brand_console/hotels.py` → `/api/v1/hotels`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/me` | Get own hotel | User | `:22` |
| PATCH | `/me` | Update hotel settings | OWNER/MANAGER | `:57` — secrets stripped via `sensitive_fields.py` |
| POST | `/{hotel_id}/test-email-connection` | Test hotel's SMTP config | User | `:162` |

## brand_console — properties (`backend/app/brand_console/properties.py` → `/api/v1/properties`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | List properties user can access | User | `:24` — multi-property support |
| POST | `` | Add new property | OWNER/MANAGER | `:72` |
| POST | `/switch/{hotel_id}` | Switch active hotel context | User | `:122` |

## brand_console — leads (`backend/app/brand_console/leads.py` → `/api/v1/leads`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/` | List AI-captured marketing leads | User | `:9` |
| PATCH | `/{lead_id}` | Update lead status | User | `:30` |

## rooms (`backend/app/rooms/rooms.py` → `/api/v1/rooms`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | List room types | User, cached 300s | `:28` |
| POST | `` | Create room type | OWNER/MANAGER | `:48` |
| GET | `/{room_id}` | Get room type | User, cached | `:105` |
| PATCH | `/{room_id}` | Update room type | OWNER/MANAGER | `:125` |
| DELETE | `/{room_id}` | Delete room type | OWNER/MANAGER | `:194` |

## rooms — amenities (`backend/app/rooms/amenities.py` → `/api/v1/amenities`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | List amenities | User, cached 1h | `:11` |
| POST | `` | Create amenity | OWNER/MANAGER | `:19` |
| DELETE | `/{amenity_id}` | Delete amenity | OWNER/MANAGER | `:36` |
| POST | `/seed-defaults` | Seed default amenity list | OWNER/MANAGER | `:53` |

## bookings (`backend/app/bookings/bookings.py` → `/api/v1/bookings`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | List bookings | User, cached 30s | `:58` |
| POST | `` | Create booking (hotelier-side, manual) | User | `:107` |
| GET | `/guests` | List guests | User | `:403` |
| GET | `/guests/stats` | Guest stats | User | `:425` |
| GET | `/{booking_id}` | Get single booking | User | `:449` |
| PATCH | `/{booking_id}` | Update booking status | User | `:474` |

## dashboard (`backend/app/dashboard/dashboard.py` → `/api/v1/dashboard`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/stats` | Summary stats | User, cached 300s | `:21` |
| GET | `/recent-bookings` | Recent 5 bookings | User, cached 60s | `:112` |
| GET | `/rate-shopper` | Competitor rate matrix | User | `:145` |

## dashboard — notifications (`backend/app/dashboard/notifications.py` → `/api/v1/notifications`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | List notifications | User | `:10` |
| PATCH | `/{notification_id}/read` | Mark read | User | `:30` |
| POST | `/read-all` | Mark all read | User | `:52` |

## rate_plans — rates (`backend/app/rate_plans/rates.py` → `/api/v1/rates`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/plans` | List rate plans | User | `:29` |
| PATCH | `/plans/{plan_id}` | Update rate plan | OWNER/MANAGER | `:37` |
| POST | `/plans` | Create rate plan | OWNER/MANAGER | `:60` |
| DELETE | `/plans/{plan_id}` | Delete rate plan | OWNER/MANAGER | `:70` |

## rate_plans — promos (`backend/app/rate_plans/promos.py` → `/api/v1/promos`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/` | List promo codes | User | `:12` |
| POST | `/` | Create promo | User | `:22` |
| DELETE | `/{promo_id}` | Delete promo | User | `:52` |
| POST | `/validate` | Validate a promo code | None, `10/min` | `:77` |

## payments (`backend/app/payments/payments.py` → `/api/v1/payments`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | List payments | User | `:21` |
| POST | `` | Record payment | OWNER/MANAGER | `:52` |
| POST | `/refund` | Issue Razorpay refund | OWNER/MANAGER | `:103` |

## calendar / availability (`backend/app/calendar/` → `/api/v1/availability`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `` | Availability grid | User | `read.py:25` |
| GET | `/blocks` | List room blocks | User | `read.py:163` |
| POST | `/blocks` | Create block | User | `write.py:23` — `_assert_room_type_owned()` tenant check |
| DELETE | `/blocks/{block_id}` | Remove block | User | `write.py:35` |
| POST | `/rates` | Set daily rates | User | `write.py:66` |
| POST | `/weekend-update` | Bulk weekend price/block update | User | `write.py:133` |
| POST | `/copy` | Copy calendar range | User | `write.py:183` |

## superadmin — hotels (`backend/app/superadmin/hotels/hotels.py` → `/api/v1/superadmin`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/me/access` | Effective permissions/tabs for current admin | SUPER_ADMIN | `:114` |
| GET | `/hotels` | List all hotels | `superadmin.hotels.read` | `:206` |
| PATCH | `/hotels/{hotel_id}/permissions` | Update role permissions | `superadmin.hotels.write` | `:280` |
| PATCH | `/hotels/{hotel_id}` | Update hotel status/plan | `superadmin.hotels.write` | `:306` |
| DELETE | `/hotels/{hotel_id}` | Delete hotel | `superadmin.hotels.write` | `:447` |
| POST | `/impersonate/{hotel_id}` | Impersonate a hotel | `superadmin.hotels.write` | `:560` |
| POST | `/social-proof/refresh` | Force refresh Google review stats | SUPER_ADMIN | `:606` |
| POST | `/media/sweep-orphans` | Cleanup orphaned media | SUPER_ADMIN | `:640` |
| POST | `/hotels/provision` (201) | Provision new hotel | SUPER_ADMIN | `:696` |

## superadmin — dashboard/users (`backend/app/superadmin/dashboard/users.py` → `/api/v1/superadmin`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/users` | List platform users | `superadmin.users.read` | `:113` |
| PATCH | `/users/{user_id}/role` | Change role | `superadmin.users.write` | `:154` |
| PATCH | `/users/{user_id}/status` | Enable/disable | `superadmin.users.write` | `:192` |
| DELETE | `/users/{user_id}` | Delete user | `superadmin.users.write` | `:222` |
| POST | `/employees` | Create Staybooker employee | SUPER_ADMIN | `:256` |
| POST | `/hotels/{hotel_id}/users` | Add user to hotel | `superadmin.users.write` | `:333` |
| DELETE | `/hotels/{hotel_id}/users/{user_id}` | Remove user | `superadmin.users.write` | `:424` |

## superadmin — chain dashboard (`backend/app/superadmin/chains/dashboard.py` → `/api/v1/chain`, mounted separately, NOT under `/superadmin`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/info` | Chain info | `get_chain_admin` |
| GET / PUT | `/widget-settings` | Widget branding | `get_chain_admin` |
| GET | `/analytics` | Chain-wide analytics | `get_chain_admin` |
| GET | `/guests` | Chain-wide guest list | `get_chain_admin` |
| GET/POST/DELETE | `/promos...` | Chain-wide promo codes | `get_chain_admin` |
| GET/PUT | `/loyalty` | Chain-wide loyalty config | `get_chain_admin` |
| GET/POST/DELETE | `/upsell...` | Chain-wide upsell offers | `get_chain_admin` |

## ⚠️ Dead code (not mounted): superadmin — platform/sessions (`backend/app/superadmin/platform/sessions.py`)
| Method | Path | Purpose | Status |
|---|---|---|---|
| GET | `/sessions` | List active Redis-tracked sessions | Router never included in `main.py` — unreachable |
| DELETE | `/sessions/{user_id}` | Revoke sessions | Unreachable |
(The underlying helper *functions* `record_session()`/`is_token_revoked()` in this same file ARE live — they're called directly from `deps.py`, only the HTTP routes are dead.)

## ai_assistant — agent (`backend/app/ai_assistant/agent.py` → `/api/v1/agent`)
| Method | Path | Purpose | Auth | Key Logic |
|---|---|---|---|---|
| GET | `/usage` | AI usage stats (all 3 agents) | User | `:163` |
| POST | `/chat` | Chat with hotelier AI agent | `feature_ai_agent` + `15/min` IP + `20/min` user | `:251` |
| POST | `/chat/stream` | SSE streaming chat | same | `:334` |
| POST | `/chat/confirm` | Confirm a pending destructive AI action | same | `:443` |
| GET | `/sessions` | List chat sessions | Feature-gated | `:530` |
| GET | `/sessions/{session_id}` | Session history | Feature-gated | `:555` |
| PATCH | `/sessions/{session_id}/rename` | Rename session | Feature-gated | `:602` |
| DELETE | `/sessions/{session_id}` | Delete session | Feature-gated | `:629` |

## system — ws (`backend/app/system/ws.py`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| WEBSOCKET | `/ws/hotel` | Real-time dashboard push (booking created/updated) | JWT via `token` query param (WS can't send headers) — `:99` |

## system — admin (legacy, `backend/app/system/admin.py` → `/api/v1/admin`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/stats` | Platform stats | SUPER_ADMIN (`check_admin_access`) |
| GET/POST | `/subscriptions` | View/create subscriptions | SUPER_ADMIN |
| GET | `/users` | All users | SUPER_ADMIN |
| GET | `/hotels` | All hotels | SUPER_ADMIN |
| PATCH | `/hotels/{hotel_id}` | Update hotel | SUPER_ADMIN |

## system — upload (`backend/app/system/upload.py` → `/api/v1/upload`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `` | File upload (max 5MB, images/PDF) | User, `20/hour` |

## loyalty (`backend/app/loyalty/loyalty.py` → `/api/v1/loyalty`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/program` | Get loyalty program config | OWNER/MANAGER/STAFF |
| PUT | `/program` | Update program | OWNER/MANAGER |
| GET | `/guests` | Loyal guest list | OWNER/MANAGER |
| PUT | `/points-config` | Points wallet config | OWNER/MANAGER |
| GET | `/offers` | List stay-offers | OWNER/MANAGER/STAFF |
| POST | `/offers` | Create offer | OWNER/MANAGER |
| PUT | `/offers/{offer_id}` | Update offer | OWNER/MANAGER |
| DELETE | `/offers/{offer_id}` | Delete offer | OWNER/MANAGER |

## channel_manager (`backend/app/channel_manager/channel_manager.py` → `/api/v1/channel-manager`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/settings` | Get OTA settings | User |
| PUT | `/settings` | Update OTA settings | OWNER only |
| GET | `/mappings` | Room→OTA mappings | User |
| POST | `/mappings` | Create mapping | OWNER only |
| GET | `/logs` | Sync activity logs | User |
| POST | `/test-connection` | Test Channex connection (real HTTP call) | OWNER only |

## integration — settings (`backend/app/integration/settings.py` → `/api/v1/integration`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET/PUT | `/settings` | Widget/webhook config | User / OWNER |
| GET | `/api-keys` | List issued API keys | User |
| POST | `/api-keys` | Create API key | OWNER |
| DELETE | `/api-keys/{key_id}` | Delete API key | OWNER |
| PUT | `/api-keys/{key_id}/toggle` | Enable/disable key | OWNER |
| GET | `/widget-code` | Embeddable widget snippet | User |
| POST | `/test-ai` | Test AI provider connectivity | OWNER |
| POST | `/test-whatsapp` | Test WhatsApp config | OWNER |

## integration — google (`backend/app/integration/google.py` → `/api/v1/integration`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/google/connect` | Start Google OAuth | User |
| GET | `/google/callback` | OAuth redirect handler | None (verified via `code`/`state`) |
| GET | `/google/status` | Connection status | User |
| DELETE | `/google/disconnect` | Disconnect | User |
| GET | `/google/locations` | List Google Business locations | User |
| POST | `/google/locations/select` | Select location | User |
| GET | `/google/reviews` | Fetch reviews | User, `10/min` |
| POST | `/google/reviews/{review_id}/ai-reply` | AI-drafted reply | User, `5/min` |
| POST | `/google/reviews/{review_id}/reply` | Post reply | User |

## integration — whatsapp (`backend/app/integration/whatsapp.py` → `/api/v1/integration`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/whatsapp/webhook` | Meta verification handshake | None |
| POST | `/whatsapp/webhook` | Inbound WhatsApp messages | None, but HMAC-verified + `60/min` |

## experiences — addons (`backend/app/experiences/addons.py` → `/api/v1/addons`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `` | List add-ons | User, cached 1h |
| POST | `` | Create add-on | OWNER/MANAGER |
| PATCH | `/{addon_id}` | Update | OWNER/MANAGER |
| DELETE | `/{addon_id}` | Delete | OWNER/MANAGER |

## marketing — google_ads (`backend/app/marketing/google_ads.py` → `/api/v1/google`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/feed/hotels.xml` | Google Hotel Ads listing feed | None (public XML) |
| GET | `/feed/pos.xml` | Points-of-sale feed | None |
| GET | `/feed/ari.xml` | Availability/rates/inventory feed | None |
| POST | `/sync/push` | Trigger sync push | Internal/unauthenticated trigger |

## google_reviews — social_proof (`backend/app/google_reviews/social_proof.py`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET/PUT | `/hotels/me/social-proof` | Hotelier's social-proof widget config | User |
| GET | `/public/social-proof/{hotel_slug}` | Public social-proof data | None |

## analytics — reports (`backend/app/analytics/reports.py` → `/api/v1/analytics/reports`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/dashboard` | Reports dashboard | User, `30/min`, cached 1800s |
| GET | `/occupancy` | Occupancy report | User, `30/min`, cached 1800s |

## analytics — analytics.py (`→ /api/v1/analytics`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/track/start`, `/track/ping`, `/track/event` | Visitor tracking | None, rate-limited 60-120/min |
| GET | `/dashboard`, `/dashboard/overview`, `/dashboard/revenue`, `/dashboard/traffic`, `/dashboard/ai`, `/dashboard/cancellations`, `/dashboard/kpis` | Analytics dashboards | User, `60/min`, cached 120s |
| GET | `/live/active`, `/live/feed` | Live visitor feed | User, `120/min` |
| POST | `/share` | Create shareable report link | OWNER/MANAGER, `20/min` |
| GET | `/share` | List share links | User |
| DELETE | `/share/{link_id}` | Revoke share link | OWNER/MANAGER |

## analytics — public_report (`backend/app/analytics/public_report.py` → `/api/v1/public`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/report/{token}` | View a shared report (no login) | None, `60/min` |

## revenue — pricing (`backend/app/revenue/pricing.py` → `/api/v1/revenue/pricing-rules`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `` | List dynamic pricing rules | OWNER/MANAGER/STAFF |
| POST | `` | Create rule | OWNER/MANAGER |
| PUT | `/{rule_id}` | Update rule | OWNER/MANAGER |
| DELETE | `/{rule_id}` | Delete rule | OWNER/MANAGER |

## revenue — recovery (`backend/app/revenue/recovery.py` → `/api/v1/revenue/recovery`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/abandoned` | List abandoned bookings | OWNER/MANAGER/STAFF |
| POST | `/run` | Manually trigger recovery sweep | OWNER/MANAGER — own hotel only |
| GET/PUT | `/settings` | Recovery nudge settings | OWNER/MANAGER/STAFF, OWNER/MANAGER |

## rate_shopper — competitors (`backend/app/rate_shopper/competitors.py` → `/api/v1/competitors`)
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `` | List tracked competitors | User |
| POST | `` | Add competitor | OWNER/MANAGER |
| DELETE | `/{competitor_id}` | Remove | OWNER/MANAGER |
| POST | `/scrape` (202) | Trigger scrape (background task) | OWNER/MANAGER |

## 🌍 guest_booking — the PUBLIC surface (all under `/api/v1/public`, NO auth, but rate-limited)
| Method | Path | Purpose | Rate Limit |
|---|---|---|---|
| GET | `/hotels/slug/{hotel_slug}` | Hotel info by slug | `120/min` |
| GET | `/hotels/slug/{hotel_slug}/widget-config` | Widget appearance config | — |
| GET | `/hotels/{hotel_identifier}` | Hotel info | `120/min` |
| GET | `/hotels/{hotel_identifier}/seasonal-deal` | Active seasonal promo | `120/min` |
| GET | `/chain/{chain_slug}` | Chain landing info | `120/min` |
| GET | `/chain/{chain_slug}/recommendations` | Chain-wide room recs | `60/min` |
| GET | `/hotels/{hotel_identifier}/recommendations` | Room recommendations | `60/min` |
| GET | `/hotels/{hotel_identifier}/rooms` | Search available rooms | `60/min` |
| GET | `/hotels/{hotel_slug}/calendar` | Public rate calendar | — |
| GET | `/hotels/{hotel_identifier}/addons` | Available add-ons | — |
| GET | `/booking-token` | Anti-automation token mint | `30/min` |
| POST | `/bookings` | **Create a guest booking** | `5/min` |
| POST | `/loyalty-offers` | Applicable loyalty offers | `30/min` |
| POST | `/loyalty-check` | Returning-guest check | `15/min` |
| POST | `/bookings/cancel-request` | Request cancellation | `10/min` |
| POST | `/bookings/cancel-confirm` | Confirm cancellation | `10/min` |
| POST | `/razorpay/create-order` | Create Razorpay order | `10/min` |
| POST | `/razorpay/verify` | Verify payment signature | `20/min` |
| POST | `/razorpay/webhook` | Razorpay server-to-server events | `300/min`, HMAC + idempotent |
| GET | `/hotels/{hotel_id}/rate-updates` | SSE — live rate updates | `10/min` |
| POST | `/chat/warm/{hotel_slug}` (204) | Pre-warm AI agent's hotel-data cache | — |
| POST | `/chat/guest` | Guest AI chat | `5/min` |
| POST | `/chat/guest/stream` | Guest AI chat (SSE) | `5/min` |

---

## Top-level (non-`/api/v1`) routes
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check (`main.py:156`) |
| GET | `/sentry-debug` | DEBUG-only test route, else 404 (`main.py:160`) |
| GET | `/` | Root (`main.py:223`) |

---

## What Got Trimmed (June 2026 superadmin scope reduction)

`backend/app/superadmin/__init__.py:13-22` documents that these sub-router files still exist on disk (kept for their SQLModel table definitions, imported with `# noqa: F401`) but are **NOT mounted** — their endpoints don't exist in the live API even though the Python files are present:
`superadmin/subscriptions/subscriptions.py`, `superadmin/tickets/tickets.py`, `superadmin/kyc/kyc.py`, `superadmin/payouts/payouts.py`, `superadmin/chains/bulk.py`, `superadmin/chains/chains.py`, `superadmin/commissions/commissions.py`, `superadmin/dashboard/exports.py`, `superadmin/platform/cache_mgmt.py`, `superadmin/platform/health.py`, `superadmin/platform/platform.py`, `superadmin/revenue/revenue.py`, `superadmin/platform/sessions.py` (routes only — helpers still live, see above).

**Doc-writer's note for you:** if you ever see references (in `graphify-out/` or old docs) to endpoints like `/superadmin/cache/stats`, `/superadmin/health`, `/superadmin/sessions`, `/superadmin/hotels/{id}/export/bookings` — these are **stale**, they do not exist in the currently running API.
