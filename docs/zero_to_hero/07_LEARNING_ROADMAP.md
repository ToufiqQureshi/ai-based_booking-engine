# 07 — Learning Roadmap (Sabse Important File)

> Ye file sabse zyada use karogi. Yahan priority order hai, time estimates hain, aur har concept ke baad apne hi code mein kya dhoondhna hai — taaki confirm ho jaaye ki tumne samajh liya.

---

## Part A: Priority Order — Kya Pehle Seekhna Hai

### Week 1 — Foundations (bina inke aage kuch samajh nahi aayega)

**1. HTTP basics + REST (2-3 ghante)**
GET/POST/PATCH/DELETE, status codes (200/201/400/401/403/404/422/500), request/response cycle.
✅ Confirm: `docs/zero_to_hero/03_ALL_API_ENDPOINTS.md` khol ke dekho — kyun `PATCH /bookings/{id}` hai, `PUT` nahi? (Answer: PATCH = partial update, PUT = poora object replace)

**2. Python async/await basics (3-4 ghante)**
`async def`, `await`, event loop ka concept (ek thread mein multiple requests kaise handle hote hain).
✅ Confirm: `backend/app/core/auth/deps.py:24` khol ke dekho — `get_current_user` async kyun hai? Andar kaunse `await` calls hain?

**3. FastAPI basics — routing, Pydantic, Depends() (6-8 ghante)**
Humari `01_FASTAPI_FUNDAMENTALS_FROM_MY_CODE.md` poori padho, saath mein har file:line reference khud khol ke dekho.
✅ Confirm: `backend/app/rooms/rooms.py` khol ke khud batao — kaunsa route path param leta hai, kaunsa CurrentUser maangta hai, kaunsa role-gated hai.

**4. React basics — components, props, useState (6-8 ghante)**
`02_REACT_FUNDAMENTALS_FROM_MY_CODE.md` poori padho.
✅ Confirm: `frontend/src/rooms/components/RoomCard.tsx` khol ke batao — ye component apna state kyun nahi rakhta?

### Week 2 — Data Layer

**5. SQL basics — SELECT/WHERE/JOIN/Foreign Keys (4-5 ghante)**
Agar SQL bilkul naya hai, ek beginner SQL course/tutorial pehle karo.
✅ Confirm: `04_DATABASE_SCHEMA.md` mein `bookings` table dekho — `guest_id` foreign key kis table ko point karta hai? Kyun `hotel_id` bhi hai, sirf `guest_id` se kaam kyun nahi chal jaata?

**6. SQLModel / ORM concept (3-4 ghante)**
Ek Python class → database table, `select()`/`.where()` → SQL query.
✅ Confirm: `backend/app/rate_plans/rates.py:29-33` (`get_rate_plans`) khol ke dekho — ye Python code SQL mein translate karke batao (mentally ya paper pe likh ke).

**7. Multi-tenancy pattern (2-3 ghante — chhota par CRITICAL concept hai is codebase ke liye)**
`hotel_id` filtering ka pura idea samjho — ye interview mein sabse zyada poochha jaayega kyunki ye is project ka core hai.
✅ Confirm: koi bhi naya endpoint dhoondo jo tumne abhi tak nahi dekha, aur khud check karo — kya usme `current_user.hotel_id` se filter ho raha hai? Agar nahi, ye ek potential security bug hai (IDOR) — flag karo.

### Week 3 — Data Fetching & State

**8. TanStack Query (React Query) (4-5 ghante)**
`useQuery` vs `useMutation`, `staleTime`/`gcTime`, `invalidateQueries`.
✅ Confirm: `frontend/src/bookings/Bookings.tsx:158-191` dekho — booking status update karne ke baad list automatically refresh kaise ho jaati hai? (Answer: `invalidateQueries` line dhoondo)

**9. Authentication/JWT concept (4-5 ghante)**
JWT kya hota hai (header.payload.signature), kyun verify karna padta hai, JWKS kya hai.
✅ Confirm: `05_AUTH_AND_SECURITY.md` ka Section 2 padho, phir `backend/app/core/db/supabase.py:31-92` khud line-by-line samjho.

**10. RBAC (Role-Based Access Control) (2-3 ghante)**
✅ Confirm: `backend/app/core/auth/deps.py:259-280` (`require_hotel_role`) padho, phir khud socho — agar tumhe ek naya endpoint banana ho jo sirf OWNER access kar sake, MANAGER nahi — kya likhoge? (`Depends(require_hotel_role("OWNER"))`)

### Week 4 — Advanced Topics

**11. Caching (Redis) + resilient fallback pattern (3-4 ghante)**
✅ Confirm: `backend/app/core/cache/redis_client.py` khol ke dekho — agar Redis crash ho jaaye, app crash kyun nahi hota? (in-memory dict fallback dhoondo)

**12. Webhooks + HMAC signature verification (2-3 ghante)**
✅ Confirm: `05_AUTH_AND_SECURITY.md` Section 5 padho — khud explain karo (kisi doost ko) ki HMAC verification kyun zaroori hai, aur "idempotency" ka kya matlab hai booking/payment ke context mein.

**13. AI Agents (LLM function-calling / tool-use) (4-6 ghante)**
`06_AI_AGENTS_EXPLAINED.md` poori padho.
✅ Confirm: khud explain karo — "human-in-the-loop confirmation" kya hota hai aur kyun `cancel_booking` jaisa tool isse gujarta hai, par `search_bookings` nahi.

**14. WebSockets + SSE (Server-Sent Events) (2-3 ghante)**
✅ Confirm: `backend/app/system/ws.py:99` dekho — WebSocket mein JWT header mein kyun nahi bheja jaata (query param mein kyun)?

---

## Part B: Total Time Estimate

| Phase | Approx Hours |
|---|---|
| Week 1 (Foundations) | 17-23 hrs |
| Week 2 (Data Layer) | 9-12 hrs |
| Week 3 (Data Fetching + Auth) | 8-10 hrs |
| Week 4 (Advanced) | 11-16 hrs |
| **Total** | **~45-60 hours** (roughly 1.5-2 hrs/day for a month, ya weekend-focused 3-4 weeks) |

**Tip:** Sequential mat karo har cheez — jaise hi Week 1 ka FastAPI basic aa jaaye, seedha `03_ALL_API_ENDPOINTS.md` khol ke real endpoints padhna shuru kar do. Theory + apna code side-by-side dekhna sabse fast tareeka hai.

---

## Part C: Interview Questions (18 Questions With Sample Hinglish Answers)

### 1. "Apne project mein multi-tenancy kaise implement ki hai?"
**Answer:** "Har table mein ek `hotel_id` column hai. Har query mein hum `.where(Model.hotel_id == current_user.hotel_id)` lagate hain — ye current logged-in user ke JWT se aata hai, client kabhi bhi apna `hotel_id` khud nahi bhej sakta. Write karte waqt bhi hum `hotel_id` ko server-side inject karte hain, request body se kabhi nahi lete — isse ek hotel doosre hotel ka data na dekh sake, na hi banaa sake."

### 2. "JWT verification kaise kaam karti hai tumhare backend mein?"
**Answer:** "Hum Supabase Auth use karte hain login ke liye. Backend har request pe `Authorization: Bearer <token>` header se JWT nikalta hai, phir Supabase ke JWKS (public keys) se uski signature verify karta hai — ES256 algorithm se. Agar wo fail ho, HS256 secret se fallback try karte hain. Verify hone ke baad payload ko Redis mein cache kar dete hain, par cache ki TTL kabhi bhi token ki actual expiry se zyada nahi hoti — isse speed bhi milti hai aur security bhi maintain rehti hai."

### 3. "Agar Redis down ho jaaye toh tumhara app kya karega?"
**Answer:** "Humara `RedisClient` class resilient hai — agar Redis se connection fail ho, wo automatically ek in-memory Python dictionary pe fallback kar leta hai. App kabhi crash nahi hota, bas thoda slow ho jaata hai (kyunki caching sirf ek process ke liye rehti hai, saare workers ke beech share nahi hoti). Isi tarah auth check bhi Redis fail hone pe 'fail open' hota hai — session-revocation check jaisi non-critical cheez fail ho toh bhi login block nahi hota."

### 4. "Race condition kaise handle ki hai booking creation mein — jaise do log same last room book kar rahe hon?"
**Answer:** "Database-level row lock (`SELECT ... FOR UPDATE`) use hota hai room type row pe jab booking create ho rahi ho. Jo request pehle lock le leti hai, uski booking create ho jaati hai aur inventory count update ho jaata hai. Doosri request lock ke baad dekhti hai ki ab inventory 0 hai, toh `409 Conflict` return karti hai."

### 5. "Payment amount client se kyun nahi lete direct?"
**Answer:** "Kyunki client-side JavaScript ko koi bhi modify kar sakta hai — agar hum client ka bheja hua amount trust karte, koi ₹50,000 ki booking ko ₹1 mein charge karva sakta tha. Isliye humara server khud DB rates + rate-plan adjustments se price recompute karta hai, aur client ka amount sirf ek sanity-check ke liye compare hota hai (`max(₹5, 1% tolerance)`), asli charge hamesha server-computed value se hota hai."

### 6. "Webhook idempotency kya hoti hai aur tumne kaise implement ki?"
**Answer:** "Razorpay ya WhatsApp jaise services kabhi-kabhi ek hi webhook event do baar bhej dete hain (retry ki wajah se, agar pehli baar server ne timeout kiya ho). Agar hum dono baar process kar den, toh double-charge ya double-booking ho sakta hai. Isliye hum Razorpay ke `X-Razorpay-Event-Id` ko Redis mein `SET NX EX` (set-if-not-exists) se check karte hain — agar wo event ID pehle se process ho chuka hai, hum use silently ignore kar dete hain."

### 7. "React Query kyun use kiya, seedha `fetch`/`useEffect` kyun nahi?"
**Answer:** "React Query automatic caching, background refetch, aur duplicate request dedup deta hai bina extra code likhe. Jaise humare `staleTime: 2min` ka matlab hai — agar same data 2 min ke andar dobara maangi jaaye, network call hi nahi hoga, cached data mil jaayega. `useMutation` ke saath `invalidateQueries` se hum related lists ko automatically refresh kar dete hain jab koi naya record banta/update hota hai."

### 8. "Frontend mein 'protected routes' kaise implement ki hain?"
**Answer:** "Humare paas ek alag `ProtectedRoute` component nahi hai — hamara `DashboardLayout` component khud check karta hai `useAuth()` se `isAuthenticated` hai ya nahi, aur agar nahi hai toh `<Navigate to='/login' />` kar deta hai. Ye layout hi sidebar/header bhi render karta hai, isliye auth-check aur layout ek hi jagah combine ho gaye."

### 9. "AI agent mein 'human-in-the-loop confirmation' kya hota hai?"
**Answer:** "Jo tools destructive hain (jaise booking cancel karna, price update karna), unhe humne `@tool(requires_confirmation=True)` mark kiya hai. Jab AI aisa tool call karna chahta hai, agno framework us run ko pause kar deta hai aur frontend ko batata hai 'confirmation chahiye'. User confirm kare tabhi actual action hota hai — isse AI accidentally koi paisa-related ya data-changing action nahi le sakta bina insaan ki manzoori ke."

### 10. "Kyun teeno AI agents alag-alag models use karte hain?"
**Answer:** "Cost control ke liye. Guest chatbot aur WhatsApp router simple, scripted flows hain — unke liye cheap model (`llama-3.1-8b-instant`) kaafi hai. Par hotelier ka analytics agent complex reasoning karta hai (revenue trends, forecasting) — usके liye bada model (`llama-3.3-70b-versatile`) use karte hain. Har baar bade model ka use karna unnecessary costly hota."

### 11. "SQLModel kya hai, SQLAlchemy se alag kaise?"
**Answer:** "SQLModel ek library hai jo SQLAlchemy (database ORM) aur Pydantic (data validation) ko combine karti hai — ek hi class dono kaam karti hai: DB table define karti hai (`table=True`) aur API request/response validation bhi karti hai. Isse ek hi model do baar (ek DB ke liye, ek API schema ke liye) likhna nahi padta."

### 12. "Rate limiting kaise implement ki hai?"
**Answer:** "`slowapi` library use hoti hai, jo Redis-backed hai — matlab limits saare backend workers ke beech shared hoti hain, ek worker ka apna alag counter nahi. Har sensitive endpoint pe alag limit hai — jaise guest booking `5/minute` (kyunki spam se bachna hai), par Razorpay webhook `300/minute` (kyunki payment gateway legitimately zyada traffic bhej sakta hai)."

### 13. "Dependency Injection (`Depends()`) ka fayda kya hai FastAPI mein?"
**Answer:** "Common logic (auth check, DB session, role check) ko ek jagah likh ke, har route mein sirf `Depends(...)` se reuse kar sakte hain. Isse code duplicate nahi hota, aur agar auth logic badalni ho, sirf ek jagah badalni padti hai, 190+ endpoints mein nahi."

### 14. "Expand-contract migration pattern kya hai?"
**Answer:** "Jab DB schema change karni ho (jaise ek column add karna required banana), hum ek hi migration mein add + required + drop-old sab kuch nahi karte. Pehle column ko nullable add karte hain (Step 1), phir alag PR mein backend deploy hone ke baad backfill karte hain (Step 2), phir bahut baad mein purana column drop karte hain (Step 3). Isse deployment ke beech purana aur naya code dono chal sakte hain bina crash ke."

### 15. "Feature flags kaise use hote hain is project mein?"
**Answer:** "Har hotel ke `hotels` table mein boolean columns hain jaise `feature_ai_agent`, `feature_google_ads`. `hotel_has_feature()` function check karta hai ki wo flag ON hai ya nahi, aur agar nahi hai toh us feature ka endpoint access denied ho jaata hai. Isse hum kisi risky feature ko sirf kuch specific hotels ke liye enable kar sakte hain, sabke liye ek saath nahi."

### 16. "Frontend-backend contract kaise maintain karte ho?"
**Answer:** "Har field jo frontend TypeScript interface mein read hoti hai, wo backend ke response dict/Pydantic model mein bhi honi chahiye. Hum manually grep karte hain — agar backend ek field return kar raha hai jo frontend use nahi kar raha, ya frontend kuch expect kar raha hai jo backend deta hi nahi, wo silent bug ban sakta hai (`undefined` dikhega, error nahi throw hoga). Isliye har naye field ke liye checklist follow karte hain: backend return + TS interface + backend test + frontend UI, chaaron."

### 17. "Bug fix karte waqt tumhara process kya hai?"
**Answer:** "Pehle poora file padhta hoon, sirf broken line nahi. Phir us function ke saare callers grep karta hoon. Fir minimal blast-radius change karta hoon — sirf jo broken hai wahi fix karta hoon, cleanup alag se. Regression test pehle likhta hoon (jo fail ho current bug ke saath), phir fix karta hoon, phir test pass hona chahiye — isse confirm hota hai fix kaam kar raha hai aur future mein wapas nahi aayega."

### 18. "SSE (Server-Sent Events) kyun use kiya WebSocket ke bajaye rate-updates ke liye?"
**Answer:** "SSE simpler hai jab sirf server se client ki taraf continuous updates bhejne hain (one-way) — jaise room rates change hone par guest ko notify karna. WebSocket bidirectional hai aur zyada complex setup maangta hai — humne wo sirf real use-case (`/ws/hotel` — hotel dashboard ke live booking updates, jahan dono taraf se communication chahiye ho sakti hai) ke liye rakha hai."

---

## Part D: Cheat Sheet — Jab Bhool Jao

| Sawal | Jawab |
|---|---|
| Naya endpoint kaise banau? | `backend/app/<domain>/*.py` mein function likho, `@router.get/post(...)`, `main.py` mein register karo agar naya file hai |
| Naya DB column kaise add karu? | Model mein field add karo + `backend/app/core/db/database.py` mein safe `ALTER TABLE` patch add karo (`_SCHEMA_PATCH_VERSION` bhi bump karna na bhoolo) |
| Naya frontend page kaise banau? | `frontend/src/<domain>/` mein component banao, `App.tsx` mein route add karo |
| Multi-tenant filter bhool gaya toh kya hoga? | IDOR bug — Hotel A, Hotel B ka data dekh/badal sakta hai. Har naye query mein `hotel_id` filter zaroor check karo |
| Kaunsa role kya kar sakta hai? | OWNER = sab kuch, MANAGER = billing/subscription chhod ke sab, STAFF = sirf view + availability/bookings/guests |
