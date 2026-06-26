# Staybooker — QA End-to-End Test Report
**Scope:** Saare commits/PRs jo 22-23 June 2026 ko merge hue (PR #104 → #111 + direct commits on main)
**Goal:** Har feature/fix ko live frontend pe verify karna — Pass / Fail mark karna, screenshot lena jahan applicable ho.

> Test environment: staging/preview URL fill karo: `____________________`
> Tester name: ____________  Date: ____________

---

## 1. Promo Code — Create + Apply (PR #104)
**Hotelier side**
1. Login as hotelier → `Settings → Promos` (`/settings/promos`).
2. Naya promo code banao, **discount_value field empty chhodo** → Save click karo.
   - ✅ Expected: Clean error message dikhna chahiye (422), app crash/500 nahi hona chahiye.
3. Ab sahi data ke saath promo banao (e.g. `SAVE10`, 10% off).
   - ✅ Expected: Successfully save ho jaye.

**Guest side**
4. `/book/<hotel-slug>/rooms` se room select karo → checkout pe jao.
5. Checkout pe promo code box me `SAVE10` daalo, apply karo.
   - ✅ Expected: Discount total me reflect ho.
6. Ek invalid/expired code try karo.
   - ✅ Expected: Proper error message ("Invalid/expired code"), crash nahi.

**Pass/Fail:** ☐

---

## 2. Room Video Upload (PR #104)
1. Hotelier → `/rooms` → koi room edit karo ya naya room add karo.
2. Video upload section me **50MB se chhota** video (e.g. 20-30MB) upload karo.
   - ✅ Expected: Upload successful, video player me dikhe.
3. **50MB se bada** video try karo.
   - ✅ Expected: Turant ("fail fast") error message — 413 error pure file upload hone ke baad nahi aana chahiye, turant reject hona chahiye.

**Pass/Fail:** ☐

---

## 3. Integration Save Error Message (PR #104)
1. Superadmin (ya hotelier jahan applicable ho) → Integration settings → Webhook URL field me `javascript:alert(1)` daalo → Save.
   - ✅ Expected: Specific error toast dikhe jaise *"webhook_url: Webhook URL must start with http:// or https://"* — generic "Failed to save" nahi.
2. Sahi URL (`https://example.com/webhook`) daal ke save karo.
   - ✅ Expected: Successfully save ho.

**Pass/Fail:** ☐

---

## 4. Branding Tab — Room List (PR #104)
1. `Settings → Branding` (`/settings/branding`) tab kholo.
   - ✅ Expected: Room list **khaali nahi** honi chahiye, actual rooms dikhne chahiye (pehle ye empty aata tha kyunki check_in/check_out missing the).

**Pass/Fail:** ☐

---

## 5. SEO Files (PR #104)
1. Browser me directly kholo:
   - `https://<frontend-domain>/sitemap.xml`
   - `https://<frontend-domain>/robots.txt`
   - `https://<frontend-domain>/llms.txt`
   - ✅ Expected: Teeno files load ho rahi ho (404 nahi), sitemap me sirf public pages ho, robots.txt me admin/auth paths disallow ho.

**Pass/Fail:** ☐

---

## 6. Superadmin → Hotel Integrations Move (PR #105, #106)
1. **Hotelier login** se check karo — Integration settings me AI/WhatsApp/Brevo keys ka section **edit-only nahi, sirf read-only ya gayab** hona chahiye (superadmin-only ban gaya hai).
2. **Superadmin login** → Hotels list → kisi hotel pe click karo → **Integrations** sub-tab kholo.
   - ✅ Expected: AI Model API key, WhatsApp API key, Brevo Email key fields dikhein, edit/save kar sako.
3. Ek key save karo (e.g. dummy Brevo key) → **page reload karo / dusre tab pe jao phir wapas aao**.
   - ✅ Expected (PR #106 ka core fix): Existing OTHER secrets (jaise SMTP password) **wipe/blank NAHI** hone chahiye. Pehle bug ye tha ki koi bhi save dusre secrets ko khali kar deta tha.
4. Field ke paas **"Configured" / "Not set" badge** check karo — already-set secret pe "Configured" dikhna chahiye bina actual value expose kiye.

**Pass/Fail:** ☐

---

## 7. Booking Confirmation Email Sender (PR #106)
1. Ek test booking complete karo guest flow se (`/book/<slug>/...`).
2. Confirmation email check karo (jis hotel ka custom SMTP/Brevo configured hai usme).
   - ✅ Expected: Email us **hotel ke apne sender address** se aaye, na ki generic "Staybooker" default sender se (jab tak hotel ne apna SMTP/Brevo set kiya ho).

**Pass/Fail:** ☐

---

## 8. Email Templates — Settings Reload (PR #106)
1. `Settings → Email` (`/settings/email`) tab kholo.
2. Booking confirmed / cancelled templates aur Reply-To address edit karo, Save karo.
3. **Page refresh (F5) karo.**
   - ✅ Expected: Saved templates aur reply-to **wapas dikhein**, blank nahi hone chahiye (pehle ye bug tha).

**Pass/Fail:** ☐

---

## 9. Add Hotel Employee (PR #106)
1. Superadmin (ya hotelier jahan applicable ho) → Users tab → naya employee add karo same email (uppercase/lowercase variation) se jo already exist karta hai, e.g. agar `staff@hotel.com` hai to `Staff@Hotel.com` try karo.
   - ✅ Expected: Properly "already exists" error, case-insensitive detect ho.
2. Ek bilkul naya valid email se employee add karo.
   - ✅ Expected: Successfully created, koi raw 500 error/traceback frontend pe nahi dikhna chahiye.

**Pass/Fail:** ☐

---

## 10. Booking Widget — Feature Toggles + Background Color (PR #107)
**Single-hotel widget**
1. Hotelier → Integration → Widget tab kholo.
2. **Promo / Packages / Flexible Dates** toggles ON/OFF karo, save karo.
3. Live widget preview check karo (ya `/book/<slug>/widget` embed pe jao).
   - ✅ Expected: Toggle ka effect turant preview me dikhe, aur live widget pe bhi reflect ho.
4. **Background color** change karo (different style: Modern, Classic, Floating, Glassmorphism sab try karo).
   - ✅ Expected: Container ka background color sahi se change ho har style me.

**Chain widget (multi-hotel brand)**
5. Chain admin login → Chain Widget settings.
6. 7 styles try karo (Modern, Minimal, Classic, Floating, Compact, OTA Style, Glassmorphism), Primary + Background color set karo.
7. Brand features ON karo: **Show Starting Price**, **Loyalty Badge**, **Property Count Badge**.
   - ✅ Expected: Sab features chain widget preview/live pe dikhein, "Save Chain Widget" se persist ho.

**Pass/Fail:** ☐

---

## 11. Guest Tracking + Hotel Report + Shareable Report (PR #110)
1. Guest flow ko ek naye browser/incognito se chalao (`/book/<slug>/...`).
2. Hotelier → Analytics dashboard kholo → **city-level visitor stats** check karo (city naam dikhna chahiye, not just country).
3. **Live visitors** count check karo — incognito tab open rakho, dashboard me "active now" count badhna chahiye.
4. Incognito tab **close karo** — kuch der baad live count usse exclude kare (session_end beacon).
5. `Reports` page kholo → KPIs check karo: **Occupancy, ADR, RevPAR, rooms_booked, total_bookings, Direct/AI/OTA channel mix**.
6. **Share Report** button click karo → link generate karo (copy/WhatsApp option check karo).
7. Generated link **logged-out/incognito** browser me kholo (`/r/<token>`).
   - ✅ Expected: Public report dikhe — KPIs, revenue/occupancy trend, funnel, channel mix, top cities, devices — par **koi guest naam/email/phone (PII) nahi** dikhna chahiye.
8. Dashboard se link **Revoke** karo → same link wapas kholo.
   - ✅ Expected: 404 / "link not found" aana chahiye.
9. **Dusre hotel ka token guess/modify karke try karo** (security check) — ✅ Expected: Sirf apne hotel ka data dikhe, kabhi dusre hotel ka data leak na ho.

**Pass/Fail:** ☐

---

## 12. Currency & Language Selector (Direct commit, 23 June)
1. `/book/<slug>/rooms` pe jao → header me currency/language selector dhundo.
2. Currency change karo (e.g. INR → USD).
   - ✅ Expected: Prices indicative conversion ke saath dikhein, ek **"indicative pricing" warning** show ho (kyunki actual charge base currency me hoga).
3. Checkout tak jao aur confirm karo ki **final charge base currency me** ho raha hai, displayed converted currency me nahi.
4. Language change karke UI check karo.

**Pass/Fail:** ☐

---

## 13. Calendar / Date Selection Bugs (Direct commits, 23 June)
1. `/book/<slug>/rooms` pe date picker kholo.
2. **Check-in** select karo with a **past-but-valid edge case** when switching to **check-out** field — verify check-in ke liye past dates ka selection sahi se restrict/allow ho raha hai jaisa intended hai.
3. Ek date range select karo jahan **min_nights** widget setting configured hai (e.g. min 2 nights) — sirf 1 din select karne ki koshish karo.
   - ✅ Expected: System **force-extend NAHI** kare guest ki stay ko automatically — usse properly bataye ki min nights required hai (warning/block), use silently extra night charge na ho.
4. Page load pe calendar khud check karo — koi date **auto-select/auto-extend** to nahi ho rahi bina user action ke.
   - ✅ Expected: Calendar sirf woh dates highlight kare jo user ne explicitly select ki hain, koi visual auto-extension nahi honi chahiye.

**Pass/Fail:** ☐

---

## 14. Multi-Room Cart, Extra Person Pricing & Upsell Discount (PR from 22 June)
1. Cart me **2-3 different rooms** add karo, kisi ek room me **extra person** add karo.
   - ✅ Expected: Extra person charge sirf us specific room ke liye correctly calculate ho, total cart price me sahi se add ho.
2. Checkout pe **upsell/add-on** (Enhance Stay) select karo jab cart me **multiple rooms** hain.
3. Koi discount/promo apply karo upsell ke saath.
   - ✅ Expected: Discount **poore cart total** pe apply ho, sirf 1 room pe nahi (ye bug tha pehle).
4. Page load pe **skeleton loaders** check karo (rooms list, cart, dashboard) — proper loading state dikhna chahiye, blank/broken UI nahi.

**Pass/Fail:** ☐

---

## 15. Rate Plan Pricing — Cross-Tenant Security Fix (Direct commit `4a11d05`, 23 June) ⚠️ CRITICAL
1. **Hotel A** ka room/rate-plan page kholo, dev tools Network tab open karo, rate-plan ka request/response dekho — note `hotel_id` / `rate_plan_id`.
2. **Hotel B** se login karke (ya guest flow se) Hotel A ka `rate_plan_id` URL/API param me manually inject karne ki koshish karo (DevTools se request modify karo).
   - ✅ Expected: Hotel B ko Hotel A ka rate-plan price **kabhi nahi** dikhna chahiye / access denied / 403-404 aana chahiye.
3. **Stay-offer / discount claim flow** test karo: ek stay-offer claim karo, dekho discount sahi se apply ho raha hai checkout pe (pehle ye flow "broken" tha).
   - ✅ Expected: Claimed discount checkout total me correctly reflect ho, kisi aur hotel/booking pe leak na ho.

**Pass/Fail:** ☐ *(High priority — security issue tha)*

---

## 📋 Summary Table (Tester fill karega)

| # | Feature | Pass | Fail | Notes |
|---|---|---|---|---|
| 1 | Promo code create+apply | ☐ | ☐ | |
| 2 | Room video upload | ☐ | ☐ | |
| 3 | Integration save error msg | ☐ | ☐ | |
| 4 | Branding tab room list | ☐ | ☐ | |
| 5 | SEO files | ☐ | ☐ | |
| 6 | Superadmin integrations move | ☐ | ☐ | |
| 7 | Booking email sender | ☐ | ☐ | |
| 8 | Email templates reload | ☐ | ☐ | |
| 9 | Add employee | ☐ | ☐ | |
| 10 | Widget toggles + bg color (single + chain) | ☐ | ☐ | |
| 11 | Guest tracking + report + share link | ☐ | ☐ | |
| 12 | Currency/language selector | ☐ | ☐ | |
| 13 | Calendar date bugs | ☐ | ☐ | |
| 14 | Multi-room cart + upsell discount | ☐ | ☐ | |
| 15 | Cross-tenant rate-plan security | ☐ | ☐ | |

---

**Bug report format (agar koi Fail mile):**
- Feature #:
- Steps to reproduce:
- Expected:
- Actual:
- Screenshot/video:
- Browser/device:
