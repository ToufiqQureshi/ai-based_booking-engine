# 05 — Auth & Security

---

## 1. Login/Signup/Onboarding Flow — Step by Step

### ⚠️ Pehle ek zaroori reality-check
**Self-serve signup band hai.** `frontend/src/App.tsx:94-96` mein `/signup` route ab `/request-access` pe redirect karta hai — ek static contact page (`RequestAccess.tsx`) jispe koi form hi nahi hai. Naye hotels **manually Staybooker team** onboard karti hai (sales-assisted).

`frontend/src/auth/Signup.tsx` aur `authApi.onboarding()` (`frontend/src/core/api/auth.ts:33-38`) **dead code** hain — kahin call hi nahi hote (grep se zero call-sites mile). `Signup.tsx` toh `useAuth().signup` maangta hai jo `AuthContextType` interface mein exist hi nahi karta — agar kabhi use kiya jaaye toh compile hi nahi hoga. **Docs likhte waqt is baat ka dhyaan rakhna — koi bhi purani doc "signup flow" describe kare toh wo galat hai.**

### Asli (live) flow:

1. **Login (frontend)** — `frontend/src/auth/Login.tsx:61-100` → `useAuth().login()` call karta hai
2. **`login()`** (`frontend/src/core/contexts/AuthContext.tsx:177-231`):
   - `supabase.auth.signInWithPassword()` — login **seedha Supabase se hota hai**, backend ka koi `/auth/login` route nahi hai
   - Success pe tokens `tokenStorage.setTokens()` se store hote hain (localStorage)
   - `authApi.getCurrentUser()` (GET `/users/me`) se poora user profile backend se laata hai
   - `apiClient.get('/hotels/me')` se hotel data
3. **Pehli authenticated backend call** `get_current_user()` (`backend/app/core/auth/deps.py:24-209`) pe hit hoti hai. Ye function bahut smart hai:
   - `supabase_id` se `User` dhoondta hai
   - **Auto-heal**: agar user ka `hotel_id` missing hai (legacy data), `UserHotelLink` table check karta hai, na mile toh naya default `Hotel` bana deta hai
   - **"Last Resort" auto-registration**: agar user Supabase mein toh hai par apni local `users` table mein nahi (bilkul naya signup jo abhi tak sync nahi hua), naya `Hotel` + `User` (role=OWNER) bana deta hai, JWT ke `user_metadata` se naam leke
   - **Master-admin auto-promote**: agar email `MASTER_ADMIN_EMAILS` env var mein hai, role automatically `SUPER_ADMIN` ho jaata hai
4. `POST /auth/onboarding` (`backend/app/auth/auth.py:47-104`) exist karta hai — already-logged-in user ke liye "apna hotel rename karo" jaisa manual endpoint — par frontend se kabhi call nahi hota (dead/legacy).
5. **Password reset**: `frontend/src/core/api/auth.ts:50-84` — 100% Supabase (`resetPasswordForEmail`, `verifyOtp`, `updateUser`), backend involved hi nahi.
6. **Token refresh**: `frontend/src/core/api/client.ts:170-208` (`tryRefreshToken`) — `supabase.auth.refreshSession()` call karta hai jab koi API 401 de (`handleResponse()`, lines 106-117), max 1 attempt, phir `/login` pe hard redirect.

**Interview-friendly one-liner:** "Staybooker mein login/signup ka pura kaam Supabase Auth karta hai — hamara backend sirf JWT ko verify karta hai aur first-time users ko auto-register kar leta hai."

---

## 2. JWT Verification — Deep Dive

**File:** `backend/app/core/db/supabase.py` — `verify_supabase_token()` (lines 31-92)

1. Header decode karke `kid`/`alg` nikalta hai (bina signature verify kiye — line 38-40)
2. **JWKS path pehle** (lines 44-62): agar `alg == ES256` aur `kid` present hai, Supabase ke JWKS endpoint se public key fetch karta hai (`get_jwks()`, cached forever per process — no TTL/refresh), phir `jwt.decode(..., algorithms=["ES256"])` se verify
3. **HS256 fallback** (lines 70-81): agar JWKS fail ho, `SUPABASE_JWT_SECRET` se HS256 verify — `exp` claim explicitly required (`options={"require": ["exp"]}`) taaki expiry-less token reject ho
4. **Explicit security design**: apne internal `SECRET_KEY` se **kabhi fallback nahi karta** (comment: agar internal key leak ho jaaye toh koi "Supabase" identity forge kar sakega — isliye alag rakha hai)
5. Koi bhi "unverified claims" debug fallback **nahi hai** (comment line 83-86 explicitly documents ye removal — pehle shayad tha, security risk hone ki wajah se hataya gaya)
6. Fail hone pe `None` return karta hai (kabhi exception nahi raise karta)

### Redis caching (CLAUDE.md ka "10 min" cache)
`backend/app/core/auth/deps.py:38-66` (`get_current_user` ke andar):
- **Read**: `redis_client.get(f"auth_payload:{token}")` — agar mila, poora JWKS/crypto verify skip ho jaata hai
- **Write**: sirf tab hoti hai jab **actual verification pass ho chuka ho**. TTL = `min(600, max(0, exp - now))` — matlab kabhi bhi 10 minute se zyada cache nahi hoga, **aur kabhi bhi token ki actual expiry se zyada bhi nahi** (comment: "Caching a decoded payload bypasses re-verification, so a cached entry must never outlive the token itself")

Ye bahut important security detail hai: cache speed deta hai (baar-baar crypto verify nahi karna padta), par security compromise nahi karta kyunki TTL hamesha real expiry se bounded hai.

**Invalid/expired token pe:** `HTTPException(401, "Could not validate credentials")` (`deps.py:32-36,67-69`)

---

## 3. RBAC — Roles Kaise Check Hote Hain

### Role enum (`backend/app/guests/user.py:17-22`)
```python
class UserRole(str, Enum):
    OWNER = "OWNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"
    SUPER_ADMIN = "SUPER_ADMIN"
```

### Intra-tenant gate — `require_hotel_role()`
`backend/app/core/auth/deps.py:259-280` — ek **dependency factory**. `SUPER_ADMIN` hamesha allowed hota hai (impersonation ke liye) chahe allowed-list mein na ho.

Usage examples (kitna strict kaha hai):
- `backend/app/analytics/analytics.py:690,737` — `("OWNER", "MANAGER")` — share-link create/delete
- `backend/app/integration/settings.py:84,150,174,188` — **sirf `"OWNER"`** — integration settings/API keys (MANAGER bhi excluded — sensitive area)
- `backend/app/payments/payments.py:52,103` — `("OWNER", "MANAGER")` — payment/refund
- `backend/app/rate_plans/rates.py:37,60,70` — same pair

### Super-admin gate — `get_super_admin()`
`backend/app/superadmin/hotels/hotels.py:49-56` — simple check `role != SUPER_ADMIN` → 403.

### Super-admin ke andar bhi sub-roles! — `SuperAdminRole`
Staybooker ki apni team ke andar bhi granular tiers hain — ye interview mein "have you seen nested RBAC?" jaisa sawaal ka acha answer hai.
- Model: `SuperAdminRole` (`backend/app/superadmin/platform/platform_model.py:93-111`) — `role_tier`: owner/finance/support/ops/viewer
- `get_effective_permissions()` (`hotels.py:59-78`) — agar SUPER_ADMIN ka koi `SuperAdminRole` row hi nahi hai (legacy/founder accounts), unhe automatically `{"tier": "owner", "permissions": ["*"]}` — poori access mil jaati hai
- `permission_granted()` (`hotels.py:81-95`) — `"*"` wildcard, exact match, ya category wildcard (`"superadmin.hotels.*"` matches `"superadmin.hotels.read"`) support karta hai
- `require_permission(perm_string)` (`hotels.py:98-111`) — pehle `get_super_admin` chalata hai, phir permission check
- `GET /superadmin/me/access` (`hotels.py:114-127`) — caller ka effective tier + `allowed_tabs` return karta hai, frontend isse decide karta hai kaunse nav-tabs dikhane hain

### Hotel-plan feature flags (role se alag axis!)
`hotel_has_feature()` (`backend/app/core/utils/feature_flags.py:39-50`) — ye role check nahi karta, ye check karta hai ki **hotel ke subscription plan mein wo feature ON hai ya nahi**. Design fail-closed hai — unknown feature name ya null hotel → `False` (comment: taaki typo jaisa `feature_ai-agnet` galti se access na de de).

---

## 4. Session Revocation / Force-Logout

**File:** `backend/app/superadmin/platform/sessions.py`

⚠️ Header comment khud confirm karta hai: is file ke HTTP routes (`GET /sessions`, `DELETE /sessions/{user_id}`) **mounted nahi hain** (2026-06-20 scope-trim). Par ye 2 helper *functions* live hain, `deps.py` se directly call hoti hain:

- `record_session()` (lines 33-42) — Redis key `active_session:{user_id}:{token_prefix}`, TTL 7 din
- `is_token_revoked()` (lines 45-50) — Redis key `revoked_token:{token_prefix}` check karta hai. **Fail-open** — koi Redis error ho toh `False` return karta hai (session-check fail hone se login block nahi hona chahiye)

`get_current_active_user()` (`deps.py:212-251`) call flow:
1. `token_prefix = token[:16]` — poora token nahi, sirf pehle 16 characters ID ke taur pe use hote hain
2. `is_token_revoked(token_prefix)` check → true toh 401 "Session revoked by admin"
3. `record_session(...)` call — session-tracking failure se auth block nahi hota (`except Exception: pass`)

`revoke_user_sessions()` (`sessions.py:90-140`, route unmounted par logic real hai) — sab `active_session:{user_id}:*` keys dhoondh ke unke `token_prefix` ko `revoked_token:*` bana deta hai (7 din TTL), plus `AuditLog` entry likhta hai.

---

## 5. Webhook Security (HMAC)

### WhatsApp — `backend/app/integration/whatsapp.py`
- `_verify_meta_signature()` (lines 25-35): `hmac.new(app_secret, raw_body, sha256).hexdigest()`, header `X-Hub-Signature-256: sha256=<hex>`, comparison `hmac.compare_digest()` se **constant-time** (timing-attack se bachne ke liye)
- `POST /whatsapp/webhook` (lines 61-100): raw body verify hota hai **kisi bhi DB/AI kaam se pehle** — fail hone pe `401` (sirf header-presence + body-length log hota hai, PII/payload kabhi log nahi hota)

### Razorpay — `backend/app/guest_booking/payments.py`
- `_verify_razorpay_webhook_signature()` (lines 465-479): same HMAC-SHA256 pattern, constant-time compare
- `razorpay_webhook()`: signature fail → `400`; missing secret config → `500` (fail-closed)
- **Idempotent replay protection ("PAY-2")** (lines 535-548): `X-Razorpay-Event-Id` header + `redis_client.set_nx_ex(f"rzp_webhook_evt:{event_id}", "1", expire=86400)` — Razorpay ka retry ek hi event ko dobara process nahi karega
- **Doosri layer of defense**: `Payment.transaction_id` pe `unique` constraint (`payment.py`) — chahe webhook logic mein bhi koi gap ho, DB khud duplicate payment row banne se rok deta hai

**Kyun ye important hai (CLAUDE.md rule):** "Razorpay/WhatsApp webhook retries a delivery — har handler ko `processed_event_id`-style check karna chahiye, warna retry se double-charge/double-booking ho sakta hai." Ye exactly wahi pattern hai jo yahan implement hua hai.

---

## 6. Sensitive Data Masking

**File:** `backend/app/core/auth/sensitive_fields.py`

- `HOTEL_SENSITIVE_COLUMNS` (lines 28-34): `ai_api_key`, `ai_base_url`
- `HOTEL_SETTINGS_SENSITIVE_KEYS` (lines 37-54): `whatsapp_api_key`, `brevo_api_key`, `smtp_password`, `razorpay_key_secret` — **explicitly NOT** `razorpay_key_id` (ye publishable key hai, browser ko bhejni hi hoti hai, comment isse clarify karta hai)
- **Defense-in-depth substring matcher** `_is_sensitive_settings_key()` (lines 63-67): koi bhi settings key jismein `secret`, `password`, `token`, `api_key`, `private` word ho — auto-mask ho jaata hai, chahe list mein na ho. Comment: "ye exactly wahi fix hai jo ek purani bug (`razorpay_key_secret` leak) ke baad add hua"
- `_mask_settings_for_hotelier()` (lines 82-124): secrets ko boolean `has_*` flags mein badal deta hai (e.g. `has_whatsapp_api_key: true`) — hotelier ko pata chal jaata hai integration configured hai, par raw value kabhi nahi dikhti
- `strip_sensitive_from_update()` (lines 193-233): hotelier ke PATCH payload se sensitive fields hataata hai. **Read-only fields** (`is_active`, `ai_whatsapp_credits`) agar update mein aayein toh **hard reject** (`ValueError`), silent drop nahi — matlab hotelier ko clearly pata chalega ki wo field change nahi kar sakta.

---

## 7. Supabase Vault — Secrets Encryption (AES-256-GCM)

**File:** `backend/app/core/auth/vault.py`

- Teen secrets vault-backed hote hain: `razorpay_key_secret`, `whatsapp_api_key`, `smtp_password` (`_SETTINGS_VAULT_MAP`, lines 30-34)
- Har secret ke liye ek `<key>_vault_id` column store hota hai settings JSON mein — asli value Vault mein encrypted hoti hai
- **Fails gracefully**: agar Vault available na ho (SQLite dev environment, ya Vault extension missing), plaintext storage pe fallback hota hai — comment mein explicitly documented backward-compat
- `_is_vault_available()` (lines 37-57) — `True` result permanently cache hota hai, par `False` sirf 60 second ke liye (comment: "cold-start failure ko permanently False cache karne ki purani bug thi, jisse hotel ki AI key silently drop ho jaati thi")
- `get_hotel_ai_key()` (lines 238-262) — priority order: integration-settings vault → integration-settings plaintext → hotel vault → hotel plaintext

---

## 8. Payment Security — Server-Computed Amounts

**Golden Rule (CLAUDE.md #2): "Never trust the client for price."** Do jagah is codebase mein isko concretely enforce kiya gaya hai:

### 1. Guest booking price (`backend/app/guest_booking/bookings.py`)
Server har room ki price DB rates + pricing rules + rate-plan modifiers se **khud recompute** karta hai. Client jo price bhejta hai wo sirf ek sanity-check ke liye compare hoti hai:
```python
price_tolerance = max(5.0, 0.01 * recalculated_total)
if abs(recalculated_total - room_req.total_price) > price_tolerance:
    raise HTTPException(409, ...)
```
Matlab tolerance flat ₹5 nahi hai — **`max(₹5, server total ka 1%)`** hai, taaki ₹50,000 ki booking pe koi ₹5 ka rounding-abuse na kar sake. Par jo bhi ho, **actual charge hamesha server-computed value se hota hai**, client ki value sirf validation ke liye.

### 2. Razorpay order + verify (`backend/app/guest_booking/payments.py`)
- Order banate waqt: `server_amount = float(booking.total_amount or 0)` — client ka bheja amount pura ignore hota hai
- Verify karte waqt ("PAY-1"): Razorpay signature check pass hone ke baad bhi, Razorpay ke apne API se order+payment **independently fetch** karke ye sab check karta hai:
  - `order_info["receipt"] == booking.id`
  - `payment_info["status"] == "captured"`
  - `paid_paise == expected_paise` (exact match, `booking.total_amount` se compute hua)
  - Koi bhi mismatch → `400 "Payment does not match this booking"`

**Kyun itni layers:** Sirf signature valid hona ye prove nahi karta ki payment *isi* booking ke liye hui — ho sakta hai koi purani valid signature reuse kar de. Ye extra check exactly wahi hole band karta hai.

---

## Quick Reference — File:Line Index

| Topic | File:Line |
|---|---|
| JWT verify (JWKS+HS256) | `backend/app/core/db/supabase.py:31-92` |
| Redis auth-cache | `backend/app/core/auth/deps.py:38-66` |
| `get_current_user` (auto-heal + auto-register) | `backend/app/core/auth/deps.py:24-209` |
| `get_current_active_user` (session revoke check) | `backend/app/core/auth/deps.py:212-251` |
| `require_hotel_role` | `backend/app/core/auth/deps.py:259-280` |
| `get_super_admin` / `require_permission` | `backend/app/superadmin/hotels/hotels.py:49-111` |
| Session tracking/revoke | `backend/app/superadmin/platform/sessions.py:27-140` |
| WhatsApp HMAC | `backend/app/integration/whatsapp.py:25-100` |
| Razorpay HMAC + idempotency | `backend/app/guest_booking/payments.py:465-548` |
| Payment amount verification | `backend/app/guest_booking/payments.py:301-356` |
| Public booking price tolerance | `backend/app/guest_booking/bookings.py:206-264` |
| Sensitive-field masking | `backend/app/core/auth/sensitive_fields.py:28-233` |
| Supabase Vault | `backend/app/core/auth/vault.py:16-262` |
