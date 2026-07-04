# 01 — FastAPI Fundamentals, MERE Apne Code Se

> Har concept: (a) simple Hinglish explanation, (b) mere code mein exact file+line, (c) wo aise kyun likha gaya.

---

## 1. Path Params vs Query Params vs Request Body

Ye teen tareeke hain jisse client backend ko data bhejta hai.

### Path Param — URL ke andar hi value
**Concept:** Jab value URL ka hi part hoti hai (e.g. "kis specific room ki jaankari chahiye"), wo path param hota hai — `/{room_id}`.

**Mera code:** `backend/app/rooms/rooms.py:105-107`
```python
@router.get("/{room_id}")
async def get_room(room_id: str, request: Request, current_user: CurrentUser, session: DbSession):
```
`room_id` seedha URL se aata hai (`/rooms/abc123`). Kyun aise: kyunki ye ek specific resource identify karta hai — REST convention yahi kehta hai ki resource ID URL path mein ho.

### Query Param — URL ke `?key=value` mein
**Concept:** Jab optional filters/pagination chahiye hoti hai, wo query param hota hai.

**Mera code:** `backend/app/analytics/analytics.py:643-644`
```python
limit: int = Query(default=20, ge=1, le=100)
```
Yahan `ge=1, le=100` validation hai — client `limit=500` bhejega toh FastAPI khud 422 error dega, apne haath se check nahi likhna padta.

Ek aur example — date-pattern validation: `backend/app/guest_booking/rooms.py:523`
```python
month: str = Query(..., pattern=r"^\d{4}-\d{2}$")
```
Yahan `month=2026-13` jaisa galat format bhi FastAPI khud reject kar dega — regex pattern se.

Kyun query param: kyunki `limit`/`month` resource identify nahi karte, wo सिर्फ result को filter/shape karte hain.

### Request Body — POST/PUT/PATCH mein bada JSON data
**Concept:** Jab client structured data bhej raha ho (naya record banane ke liye), wo request body hota hai — ek Pydantic model se define hota hai.

**Mera code:** `backend/app/calendar/write.py:23-24`
```python
async def create_block(block_data: RoomBlockCreate, current_user: CurrentUser, session: DbSession):
```
`RoomBlockCreate` Pydantic model hai — FastAPI khud request body JSON ko parse karke isme daal deta hai, aur agar fields missing/wrong-type hain toh 422 return kar deta hai. Kyun aise: kyunki booking block banane ke liye kaafi fields chahiye (room_type_id, start_date, end_date, reason) — ye sab ek object mein bhejna URL se zyada clean hai.

**Yaad rakhne ka tareeka:** Path param = "kaunsa resource", Query param = "kaise filter karo", Body = "kya naya data bhej raha hoon".

---

## 2. Pydantic Models — Schema Definition + Validation

**Concept:** Pydantic model batata hai ki data kaisa dikhna chahiye — konsi field required hai, konsa type hai, konsi range mein honi chahiye. SQLModel mein ye hi class database table bhi ban jaati hai (agar `table=True`).

### Example 1 — Numeric bounds + description
`backend/app/rate_plans/rates_model.py:23-37` (RatePlan schema)
```python
price_adjustment: float = Field(default=0.0, ge=-1000000, le=1000000)
min_los: int = Field(default=1, ge=1, le=365, description="Minimum Length of Stay")
market_price: Optional[float] = Field(default=None, ge=0, le=10000000, ...)
```
`ge`/`le` (greater-equal / less-equal) se hi min/max bound lag jaata hai — hotelier `-500` nights ka minimum stay nahi bana sakta.

### Example 2 — Custom validator (security ke liye)
Isi file mein, `:43-46`:
```python
@field_validator("name", "description", "meal_plan", "image_url", mode="before")
```
Ye `strip_html_tags(v)` call karta hai — matlab agar koi hotelier apne rate plan ke naam mein `<script>` tag daalne ki koshish kare (XSS attack), wo automatically strip ho jaayega, save hone se pehle hi.

### Example 3 — Payment amount bounds
`backend/app/guest_booking/payments.py:154-156`
```python
amount: float = Field(gt=0, le=10_000_000, description="Amount in INR (will be converted to paise)")
currency: str = Field(default="INR", min_length=3, max_length=3)
receipt: str = Field(min_length=1, max_length=64)
```
`gt=0` matlab amount zero ya negative nahi ho sakta — payment order banane se pehle hi galat amount reject ho jaata hai.

### Example 4 — Email validation + sanitization
`backend/app/guest_booking/_schemas.py:45-64`
```python
email: EmailStr
phone: str = Field(max_length=20)
guests: int = Field(default=1, ge=1, le=50)
```
`EmailStr` type khud check karta hai ki valid email format hai ya nahi — bina custom regex likhe.

**Kyun ye pattern har jagah use hota hai:** Field-level validation backend ke andar hi (database tak pahunchne se pehle) galat data ko reject kar deta hai — isse SQL injection ya corrupted data save hone se bachta hai. Ye CLAUDE.md ka rule bhi hai: "Inputs validated; amounts/roles/ids verified server-side."

---

## 3. Dependency Injection — `Depends()` Kaha Kaha Use Hua

**Concept:** FastAPI mein `Depends()` ek "pehle ye function chalao, uska result de do" mechanism hai. Isse auth check, DB session jaisi cheezein har route mein baar-baar likhni nahi padti.

| Dependency | Kaha Define Hui | Kya Karti Hai |
|---|---|---|
| `CurrentUser` (type alias) | `backend/app/core/auth/deps.py:255` — `Annotated[User, Depends(get_current_active_user)]` | JWT verify karke logged-in `User` object deta hai |
| `DbSession` (type alias) | `backend/app/core/auth/deps.py:256` — `Annotated[AsyncSession, Depends(get_session)]` | Ek DB connection deta hai, request khatam hone pe auto-close ho jaata hai |
| `get_current_user` (raw) | `backend/app/core/auth/deps.py:24` | JWT verify karta hai, par `is_active`/hotel-active check nahi karta — onboarding jaise "hotel abhi ban hi raha hai" wale routes mein use hota hai (`app/auth/auth.py:51`) |
| `require_hotel_role(*roles)` | `backend/app/core/auth/deps.py:259-280` (dependency **factory** — function jo dependency return karta hai) | Check karta hai current user ka role allowed list mein hai ya nahi. Usage: `backend/app/rooms/rooms.py:48` — `dependencies=[Depends(require_hotel_role("OWNER", "MANAGER"))]` |
| `require_feature(flag)` | `backend/app/core/auth/deps.py:282-295` | Check karta hai hotel ke subscription plan mein wo feature ON hai ya nahi. Usage: `backend/app/ai_assistant/agent.py:251` |
| `get_super_admin` | `backend/app/superadmin/hotels/hotels.py:49-56` | Check karta hai `role == SUPER_ADMIN` |
| `require_permission(perm)` | `backend/app/superadmin/hotels/hotels.py:98-111` | Super-admin ke andar bhi granular permission check (e.g. `"superadmin.users.write"`) |

**Kyun ye pattern zaroori hai:** Bina Depends() ke, har ek endpoint mein manually likhna padta:
```python
token = get_token_from_header(request)
user = verify_token(token)
if not user.is_active: raise ...
```
Depends() se ye ek line mein ho jaata hai: `current_user: CurrentUser` — FastAPI khud pehle usko resolve karta hai.

**Dependency factory ka concept samjho:** `require_hotel_role("OWNER", "MANAGER")` khud ek dependency nahi hai — ye ek **function hai jo dependency return karta hai**. Isse hum har route pe custom roles pass kar sakte hain (`rooms.py` mein sirf OWNER/MANAGER, `channel_manager.py:41` mein sirf OWNER akela).

---

## 4. Async/Await — Kaha Aur Kyun

**Concept:** `async def` wala function "await" kar sakta hai — matlab jab wo kisi cheez (DB query, external API) ka wait kar raha ho, event loop dusra request handle kar sakta hai. Isse ek hi worker process hazaron concurrent requests handle kar sakta hai.

### Example 1 — Auth check (DB + external verify)
`backend/app/core/auth/deps.py:24-209` (`get_current_user`)
Ye `async def` hai kyunki ye `await verify_supabase_token(token)` karta hai (JWKS verify — network-ish call) aur multiple `await session.execute(...)` DB queries karta hai. Agar ye sync hota, toh har login-check pe poora worker block ho jaata.

### Example 2 — Webhook processing
`backend/app/guest_booking/payments.py:500-525` (`razorpay_webhook`)
`await request.body()`, `await redis_client.set_nx_ex(...)`, aur DB queries — sab await hote hain kyunki webhook `300/minute` traffic le sakta hai, isliye blocking calls yahan bahut costly hote.

### Example 3 — External HTTP call
`backend/app/guest_booking/payments.py:436-440` (WhatsApp message bhejna)
```python
async with httpx.AsyncClient() as client:
    await client.post(...)
```
Real network call Meta ke WhatsApp API ko — agar sync hota toh jab tak Meta jawab na de, poora worker freeze ho jaata.

**Subtlety jo interview mein pooch sakte hain:** Redis calls is codebase mein **sync** hain (`redis_client.get_instance()` sync `redis` library use karta hai, `redis.asyncio` nahi) — sirf `set_nx_ex` jaisa naya code async hai. Matlab har jagah "async" ka matlab automatically "non-blocking" nahi hota — check karna padta hai actual implementation.

---

## 5. Middleware — App Mein Kya Kya Hai

**Concept:** Middleware har request/response ke around ek layer hoti hai — auth check ke pehle bhi chal sakti hai. `backend/main.py` poori file padhne se ye list mili:

1. **Sentry SDK init** — `main.py:91-111` — sirf `SENTRY_DSN` set ho toh. `before_send=_scrub_sentry_event` (`:92-103`) — `Authorization`/`Cookie`/`X-Api-Key` headers aur body Sentry ko bhejne se pehle hata deta hai (CLAUDE.md rule: "No secrets in logs/Sentry").
2. **Rate-limit exception handler** — `main.py:126` — slowapi ka default 429 handler jab koi limit cross kare.
3. **Global exception handler** — `main.py:127` → `app/core/utils/exceptions.py:34-45` — koi bhi unhandled crash yahan aakar generic 500 return karta hai (internal error client ko leak nahi hota).
4. **CORSMiddleware** — `main.py:142-153` — sirf allowed origins (`CORS_ORIGINS` env + Cloudflare Pages preview regex) se hi requests accept hote hain.
5. **GZipMiddleware** — `main.py:154` — 1000 bytes se badi responses compress ho jaati hain (faster load).
6. **Custom security-headers middleware** — `main.py:168-183` (`add_security_and_cache_headers`) — `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS, CSP headers add karta hai; aur `/api/v1/*` responses ko `no-store, no-cache` bana deta hai (browser API responses cache na kare — caching sirf Redis/React-Query karega).

**Interesting bug-fix jo yahan mila:** CORS regex pehle sirf `*.staybooker.pages.dev` match karta tha, par actual preview URLs `*.ai-based-booking-engine.pages.dev` the — matlab saari Cloudflare Pages previews CORS-blocked thi jab tak fix nahi hua (`main.py:145-148` comment).

---

## 6. Exception Handling

**Concept:** Errors ko silently ignore mat karo — ya toh log karo, ya wapas raise karo, ya client ko safe generic message do.

- **Global catch-all**: `app/core/utils/exceptions.py:34-45` — poora traceback log hota hai (`exc_info=True`), par client ko sirf generic message milta hai (`"An unexpected error occurred..."`). Interesting detail: ye function CORS headers manually wapas add karta hai (`:18-31`) — kyunki Starlette ka error-handling middleware `CORSMiddleware` ke *bahar* wrap hota hai, isliye bina is fix ke crash response browser mein "CORS error" dikhta, asli 500 error nahi.
- **Narrow except (sahi tareeka)**: `app/guest_booking/payments.py:527-531` — sirf `json.JSONDecodeError`/`UnicodeDecodeError` catch karta hai, specific error log karta hai, phir `HTTPException(400, ...)` raise karta hai. **Kabhi bhi bare `except: pass` mat likho** — ye CLAUDE.md ka explicit rule hai.
- **Jaan-boojh kar "fail open" pattern**: `app/core/auth/deps.py:235-238`
  ```python
  except HTTPException: raise
  except Exception: pass  # Never block auth because of session tracking failure
  ```
  Ye galti se error swallow nahi kar raha — comment explicitly bata raha hai ki session-tracking (ek side-feature) fail ho jaaye toh bhi login block nahi hona chahiye. Ye deliberate design hai, accidental nahi.

---

## 7. Router Organization — Kyun Alag Files Mein Tode Gaye

**Concept:** Ek 2000-line wali `main.py` maintain karna mushkil hota. Isliye har business domain (bookings, rooms, payments) ka apna router file hai, aur `main.py` sirf sabko jodta hai.

### `main.py` mein registration (`backend/main.py:187-221`)
Har domain ka router `app.include_router(...)` se jud raha hai, e.g.:
```python
app.include_router(auth.router, prefix=API_V1_PREFIX)       # → /api/v1/auth
app.include_router(rooms.router, prefix=API_V1_PREFIX)       # → /api/v1/rooms
```

### Package ke andar sub-routers combine karna
`backend/app/calendar/__init__.py:1-24` — `availability.py` naam ka ek bada file pehle tha, use split kiya gaya:
- `helpers.py` — shared logic (tenant-ownership checks)
- `read.py` — GET endpoints
- `write.py` — POST/DELETE endpoints

Outer `router = APIRouter()` in dono ko sirf combine karta hai — comment likha hai "Sub-routers own the /availability prefix — outer router is just a combiner."

### Cross-domain re-export
`backend/app/guest_booking/__init__.py:1-17` — apne khud ke sub-routers ke saath-saath ek **doosre domain folder** (`google_reviews/social_proof.py`) ka `public_router` bhi include karta hai. Matlab folder-boundary aur router-grouping hamesha 1:1 nahi hote — jo public/guest-facing hai wo yahan combine ho jaata hai, chahe code kahin bhi rahe.

### Trimmed router set (June 2026 cleanup)
`backend/app/superadmin/__init__.py:1-25` — pehle ~15 sub-routers the (subscriptions, commissions, payouts, KYC, tickets, revenue, health, cache, sessions...), ab sirf 2 mount hote hain (`hotels`, `dashboard/users`). Baaki files disk pe hain (kabhi kaam aa sakti hain / models ke liye import hoti hain) par unke routes reachable nahi hain — comment likha hai `noqa: F401` isliye linter unhe "unused import" nahi bolta.

**Sabse important seekh:** Router files domain-wise todne se (1) code samajhna aasan hota hai, (2) merge conflicts kam hote hain (do log alag files pe kaam kar sakte hain), (3) ek domain ke andar bhi agar file bahut badi ho jaaye (jaise calendar/availability.py) toh usko read/write mein aage se bhi tod sakte ho.

---

## Quick Recap Table

| FastAPI Concept | File:Line Reference |
|---|---|
| Path param | `backend/app/rooms/rooms.py:105-107` |
| Query param + validation | `backend/app/analytics/analytics.py:643-644` |
| Request body (Pydantic) | `backend/app/calendar/write.py:23-24` |
| Field validators (XSS strip) | `backend/app/rate_plans/rates_model.py:43-46` |
| `CurrentUser`/`DbSession` aliases | `backend/app/core/auth/deps.py:255-256` |
| Dependency factory (`require_hotel_role`) | `backend/app/core/auth/deps.py:259-280` |
| Async DB + JWT verify | `backend/app/core/auth/deps.py:24-209` |
| CORS + security headers middleware | `backend/main.py:142-183` |
| Global exception handler | `backend/app/core/utils/exceptions.py:34-45` |
| Router split example | `backend/app/calendar/__init__.py` |
