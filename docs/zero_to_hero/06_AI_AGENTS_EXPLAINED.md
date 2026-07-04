# 06 — AI Agents Explained (Teeno Agents)

**Framework clarification pehle:** Poore codebase mein teeno agents **Agno** framework pe bane hain (`agno.agent.Agent`, `agno.team.Team`) — **LangChain ka koi trace nahi mila** `ai_assistant/`, `ai_engine/` folders mein. CLAUDE.md/purani docs "LangChain" bhi mention karti hain — wo galat/outdated hai is codebase ke liye.

---

## Agent #1: Guest Concierge Agent

**Kya karta hai:** Public booking page pe guest ke saath chat karta hai — availability batata hai, room details deta hai, aur booking ke liye lead capture karta hai.

| | |
|---|---|
| **Factory function** | `create_guest_agent_graph()` — `backend/app/ai_engine/guest_agent.py:325-623` |
| **Trigger endpoints** | `POST /public/chat/guest` → `chat.py:179-343`; `POST /public/chat/guest/stream` (SSE) → `chat.py:350-482`; WhatsApp hotel-specific branch → `whatsapp.py:289-306`; cache pre-warm `POST /public/chat/warm/{hotel_slug}` → `chat.py:168-176` |
| **Model** | Cheap tier — `llama-3.1-8b-instant` (Groq default, `guest_agent.py:590`); comment: "the guest concierge is a scripted sales/booking flow and does not need a 70B model" |
| **Framework object** | `agno.agent.Agent` — single agent, not a Team |
| **Tools (3)** | `check_availability(check_in, check_out, guests)` (`:347-392`), `get_room_details(room_name)` (`:394-425`), `prepare_booking(...)` (`:427-550`, ye hi lead-capture tool hai) |
| **Caps** | `tool_call_limit=4`, `max_tool_calls_from_history=2`, `compress_tool_results=True` (`:617-619`) |
| **Cache** | `cache_response=True`, TTL 300s (5 min) — comment: "identical requests (e.g. repeated greetings) ke liye" |
| **max_tokens** | `1024` |
| **Usage tracking** | `record_ai_usage(hotel.id, result, agent_type="guest")` — `chat.py:273-274` (non-stream), `chat.py:468-469` (stream) |

**Graceful degradation:** Agar koi tool call crash ho jaaye, endpoint automatically ek dobara try karta hai **bina tools ke** (sirf plain instruction-based chat), phir bhi cheap model pe — taaki guest ko error na dikhe, ek friendly reply mile (`chat.py:277-336`).

**Alag caching layer:** LLM response cache se hatke, hotel/room data khud bhi 1 ghante ke liye Redis mein cache hota hai (`_fetch_hotel_data()`, `guest_agent.py:111-212`) — hotelier rate/room badalte hi `invalidate_guest_agent_cache(hotel_id)` isko clear kar deta hai.

**Lead capture kaise hota hai:** `prepare_booking` tool (`:427-550`) ke andar — guest ka naam/phone/email jaisa free-text input pehle sanitize/bound hota hai (`first_name[:80]`, `phone[:20]` etc. — line 457-461), phir `Lead` DB row banata hai (hotel_id closure se fixed, tenant-safe). Agar hotel ne Google Sheets integration configure kiya ho, lead fire-and-forget wahan bhi sync ho jaata hai — bina guest ke reply ko block kiye.

---

## Agent #2: Global Concierge Agent (WhatsApp-only router)

**Kya karta hai:** Jab guest Staybooker ke **central** WhatsApp number pe message kare (kisi specific hotel ke number pe nahi), ye pehle pata karta hai ki guest kaunse hotel ke baare mein baat kar raha hai, phir Agent #1 ko us hotel ke context mein hand-off kar deta hai.

| | |
|---|---|
| **Factory function** | `create_global_concierge_graph()` — `backend/app/ai_engine/global_agent.py:27-127` |
| **Trigger** | Sirf WhatsApp webhook ke andar (`whatsapp.py:209-250`), koi REST endpoint isse directly nahi bulaata |
| **Model** | Hardcoded cheap — `groq`/`llama-3.1-8b-instant` |
| **Tools** | `search_hotels(hotel_name)` (`:38-53`), `route_to_hotel(hotel_id, hotel_name)` (`:55-65`) — ye ek magic string `ACTION:ROUTE_TO_HOTEL|{...}` return karta hai jo webhook handler catch karke handle karta hai |
| **Caps/cache** | Same as Agent #1 (`tool_call_limit=4`, `cache_response=True` TTL 300s, `max_tokens=1024`) |

### ⚠️ Ye agent ke saath do gaps mile (interview mein flag karne layak, "known limitation"):
1. **Usage tracking missing** — is agent ke runs ke liye `record_ai_usage()` kahin call hi nahi hoti (CLAUDE.md ka rule hai "record usage after every run", par yahan nahi ho raha)
2. **Quota enforcement missing** — `enforce_ai_token_quota()` bhi is central-WhatsApp branch mein call nahi hoti (jabki hotel-specific WhatsApp branch mein hoti hai, `whatsapp.py:293`)

Ye codebase ki ek real gap hai — docs likhte waqt ise bug ki tarah maano, feature ki tarah nahi.

**Session state:** Redis mein direct rakha jaata hai (agno ke DB session store se alag) — `whatsapp:global_chat:{sender_phone}` (chat history) aur `whatsapp:global_session:{sender_phone}:hotel_id` (24h TTL, ek baar route ho jaane ke baad).

---

## Agent #3: Hotelier Dashboard Assistant ("Staybooker AI") — the analytics/Team agent

**Kya karta hai:** Hotel admin dashboard ke andar hotelier se chat karta hai — bookings dekh sakta hai, revenue analytics de sakta hai, rooms block kar sakta hai, promo codes bana sakta hai — matlab **actions bhi le sakta hai**, sirf jawab hi nahi deta.

| | |
|---|---|
| **Factory function** | `create_agent_executor()` — `backend/app/ai_engine/agent.py:136-1077` |
| **Trigger endpoints** | `POST /agent/chat`, `/agent/chat/stream`, `/agent/chat/confirm` (`ai_assistant/agent.py`) |
| **Model** | **Large tier** — `llama-3.3-70b-versatile` (`agent.py:880`) — CLAUDE.md rule confirm hoti hai: "Reserve large models only for the hotelier analytics agent" |
| **max_tokens** | `max(target_max_tokens or 2048, 1536)` — floor rakha gaya hai taaki detailed reports/JSON charts mid-generation truncate na hon |
| **cache_response** | **Set NAHI hai** yahan — consistent with CLAUDE.md: "not on the live analytics agent" (kyunki live data hamesha fresh chahiye, stale cache nahi) |

### Framework — sirf yahi ek `Team` hai, baaki dono plain `Agent` hain
`agno.team.Team` jo 4 sub-agents ko route karta hai (`agent.py:1006-1077`):
- **`finance_agent`** — revenue/occupancy/RevPAR/forecast tools (9 tools)
- **`booking_agent`** — search/create/cancel booking, find guest tools
- **`ops_agent`** — dashboard stats, inventory, arrivals/departures, block dates, VIP guests, at-risk bookings (11 tools)
- **`general_agent`** — weather, local events, web search, PDF report generation (4 tools)

### Destructive actions — human-in-the-loop confirmation
4 tools `@tool(requires_confirmation=True)` marked hain: `cancel_booking`, `update_room_price`, `create_promo_code`, `block_room_dates`. Jab AI in mein se koi bulaana chahe, agno run ko **pause** kar deta hai — frontend ko `requires_confirmation=True` + `run_id` milta hai, aur `/agent/chat/confirm` call karke hi wo action resume/complete hota hai.

**Role check bhi hai:** `_DESTRUCTIVE_ALLOWED_ROLES = {"OWNER", "MANAGER", "SUPER_ADMIN"}` (`backend/app/ai_engine/tools/actions.py:15-27`) — STAFF role destructive actions AI se bhi nahi kar sakta, chahe confirmation mil bhi jaaye.

### Caps
`tool_call_limit=8`, `max_tool_calls_from_history=3` (`AI_TOOL_CALL_LIMIT`/`AI_MAX_TOOL_CALLS_FROM_HISTORY` env-driven, defaults `backend/app/core/utils/config.py:46-47`), `compress_tool_results=True` — sab 4 sub-agents + Team pe apply hote hain.

### Usage tracking
`record_ai_usage(current_user.hotel_id, result, agent_type="hotelier")` — chat, stream, aur confirm-resume, teeno ke baad call hoti hai.

### ⚠️ Ek dead-code-jaisi cheez mili
`agent.py:750-863` mein ek "smart tool selector" hai jo keyword-match se tools filter karta hai — par actual Team ke 4 sub-agents apna fixed tool-list use karte hain (`finance_tools`/`booking_tools`/etc., lines 964-994), is selector ka output kahin pass hi nahi hota. Ye shayad Team-refactor se pehle ka leftover code hai — docs mein confidently mat likho ki "ye hi tool-limiting mechanism hai", flag karo ki verify karna baaki hai.

---

## LLM Call Mechanics (Teeno Agents Common)

### Provider auto-detection (API key prefix se)
- `gsk_` → Groq, `sk-` → OpenAI, `AIza` → Gemini — teeno agent factories mein duplicate logic hai (`agent.py:920-927`, `guest_agent.py:558-564`, `global_agent.py:74-81`)

### API key resolution priority (`get_hotel_ai_key()`, `backend/app/core/auth/vault.py:238-262`)
1. `integration_settings.ai_api_key` (Vault se)
2. `integration_settings.ai_api_key` (plaintext fallback)
3. `hotel.ai_api_key` (Vault se)
4. `hotel.ai_api_key` (plaintext)
5. Agar sab None, hotelier agent `settings.GROQ_API_KEY` (system default) pe fall back karta hai — **guest/global agents ye system-default fallback nahi karte**, unhe hotel ka apna configured key chahiye hi, warna "AI Concierge is currently offline" jawab milta hai.

### Error/timeout handling
- Hotelier `/agent/chat/confirm` — `asyncio.wait_for(timeout=AI_CONFIRM_TIMEOUT_SECONDS)` (default 60s) — timeout pe 504
- Guest chat — tool-crash pe automatic no-tools retry (upar dekha), never 500 to guest
- `search_web` tool — 8s hard timeout, sync DuckDuckGo client ko thread mein offload
- Redis down → `RedisClient` in-memory fallback, `enforce_ai_token_quota` bhi isी resilience pattern follow karta hai

---

## Rate Limiting / Quota

**Real function name:** `enforce_ai_token_quota()` — `backend/app/ai_engine/ai_usage.py:142-207` (⚠️ CLAUDE.md mein likha `_enforce_hotel_ai_quota` naam **exist hi nahi karta** — asli naam yahi hai, docs likhte waqt sahi naam use karo)

**3-layer fallback:**
1. Primary: Redis key `ai_tokens:{agent_type}:{hotel_id}:{YYYYMMDD}`
2. Redis down → durable Postgres counter (`AIUsageDaily` table read)
3. Dono down → in-process conservative counter (per-worker, capped)

`Subscription` model se per-agent daily limit milta hai (`ai_hotelier_daily_limit`, `ai_guest_chat_daily_limit`, `ai_whatsapp_daily_limit`) — `0` = unlimited. Limit cross hone pe `429`; **koi unexpected infra error ho toh fail-open** (request block nahi hoti — infra issue se legit request block nahi honi chahiye).

**IP-based rate limits** (slowapi):
- Guest chat: `5/minute`
- WhatsApp webhook: `60/minute`
- Hotelier agent: dual — `15/minute` per-IP **aur** `20/minute` per-authenticated-user

**WhatsApp ka ek extra quota layer:** `Subscription.whatsapp_credits` — har message pe decrement hota hai, independent hai token-based quota se.

---

## Recap Table

| | Guest Concierge | Global (WhatsApp router) | Hotelier Team |
|---|---|---|---|
| Model | cheap (8B) | cheap (8B) | **large (70B)** |
| Framework | `Agent` | `Agent` | `Team` (4 sub-agents) |
| Trigger | Public chat + WhatsApp (per-hotel) | WhatsApp central number only | `/agent/chat*` (authenticated) |
| Cache response | ✅ 300s | ✅ 300s | ❌ (live data) |
| Usage tracked | ✅ | ❌ (gap!) | ✅ |
| Quota enforced | ✅ | ❌ (gap!) | ✅ |
| Can take destructive actions | ❌ | ❌ | ✅ (with confirm + role gate) |
