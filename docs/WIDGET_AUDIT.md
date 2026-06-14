# Booking Widget & Chat Widget — Full Production Audit

> Scope: embeddable Booking Widget (`/book/{slug}/widget`) and Chat Widget (`/book/{slug}/chat`), their loaders (`frontend/public/widget-v3.js`, `frontend/public/chat-loader.js`), and supporting backend public APIs. Every finding below is grounded in actual code with `file:line` references. Items marked ✅ were re-verified directly; items marked ⚠️ need a final confirmation of the execution sink before the fix is shipped.

Audit date: 2026-06-14 · Branch: `claude/project-code-review-1uv2pw`

---

## 0. Executive Summary

| Area | Verdict |
|------|---------|
| 1. Calendar cut-off | **Confirmed bug.** Root cause = `overflow-hidden` on the calendar popover + no vertical height management + iframe provisional height too small. CSS/JS fixes ready. |
| 2. Booking UX vs OTAs | Current calendar is on the right track (price-in-cell, 2-month) but mobile handling and "starting rates" clarity lag behind Booking.com/Airbnb. Concrete upgrades listed. |
| 3. Calendar price source | **Traced end-to-end.** Source = `room_types.base_price` + `room_rates` (base overrides). **No dynamic pricing** in calendar (min base price only). Checkout recomputes server-side (good) — but calendar→checkout price can diverge. |
| 4. Widget loading delay | **Confirmed, significant.** ~0.8–4s of *artificial* delay (`setTimeout` reveals + `requestIdleCallback`) on top of bundle load. Direct conversion risk. |
| 5. Security | **13 findings: 2–3 P0, ~6 P1.** Missing iframe `sandbox`, public `widget_custom_js`/`css`, prompt-injection surface, AI quota enforced too late. |
| 6. Revenue impact | A first-time guest faces: slow widget reveal, a clipped calendar, price surprise at checkout, and a chat button that appears seconds late. Each is a measurable drop-off. |

---

## 1. Calendar Cut-off / Overlay Issue ✅

**File:** `frontend/src/guest_booking/BookingWidget.tsx`, `frontend/public/widget-v3.js`

### Findings (all verified against code)

| # | Issue | Root Cause | Code Ref | Impact | Fix | Priority |
|---|-------|-----------|----------|--------|-----|----------|
| 1.1 | Calendar bottom (price legend) clipped | `overflow-hidden` on the PopoverContent clips anything past the box | `BookingWidget.tsx:367` | Legend "Sold = No rooms · starting rates" and last row can be cut | Remove `overflow-hidden`; let content flow | **P1** |
| 1.2 | Calendar overflows viewport, no scroll | Inner wrapper has only `overflow-x-auto`, no `max-height`/vertical scroll | `BookingWidget.tsx:385` | On short screens the calendar runs off-screen | Add `max-h-[70vh] overflow-y-auto` | **P1** |
| 1.3 | Bottom cut on mobile after open | iframe provisional open height `550px` < real calendar (~600–710px) | `widget-v3.js:117` | iframe too short until WIDGET_HEIGHT message arrives → flash of clipped calendar | Raise provisional to ~680/860; rely on posted height | **P1** |
| 1.4 | Right month half-visible at mid widths | 2-month layout keyed to Tailwind `md:` breakpoint, not actual popover width | `BookingWidget.tsx:388,405` | At 480–600px iframe widths two months render but don't fit | Drive month count + `flex-row` from `isMobile`/width, not `md:` | **P2** |
| 1.5 | Popover too close to edge on mobile | `collisionPadding={8}` | `BookingWidget.tsx:372` | Edge clipping on small screens | `collisionPadding={isMobile ? 16 : 24}` | **P3** |

### Recommended approach
Two tiers:
- **Quick fix (ship now):** items 1.1–1.3 (remove `overflow-hidden`, add bounded scroll, raise provisional height). Low risk, resolves the visible "half cut-off".
- **Proper fix (with redesign, see §2):** make month-count and layout width-driven; on mobile open the calendar as a **full-screen sheet inside the iframe** rather than a popover (this is the #1 embedded-calendar anti-clip pattern — the host page's scroll container can't clip a full-frame sheet).

---

## 2. Booking Widget UX vs Booking.com / Airbnb / Agoda / MakeMyTrip / Expedia

### What the leaders converge on
- **2 months on desktop; full-screen vertically-scrolling multi-month calendar on mobile** — never a shrunk desktop popover.
- **Price-in-cell** (date on top, price as a smaller muted second line) — Booking.com & Airbnb hallmark. *(Our widget already does this — `BookingWidget.tsx:412-437`.)*
- **Occupancy via +/- steppers in a panel after dates**, with child-age capture so quoted prices are occupancy-correct.
- **Sticky bottom "reserve/search" bar on mobile** with live total + nights.
- **Skeleton-load prices into cells** — render the grid instantly, hydrate prices async.
- **Honest urgency** ("X rooms left at this rate", free-cancellation) + **total-with-taxes toggle** for transparency.

### Where our widget stands
| Pattern | Our widget | Gap |
|---------|-----------|-----|
| Price-in-cell | ✅ `:422-432` | Currency not abbreviated (₹2,500 vs ₹2.5k) → tight cells |
| 2-month desktop / 1 mobile | ✅ `:388` | Mobile uses a popover, not full-screen sheet → clipping (§1) |
| Occupancy steppers | Present in flow | Not benchmarked here; confirm child-age capture |
| Sticky mobile CTA | ⚠️ verify | Recommended |
| Skeleton price cells | ❌ blocks on fetch | Calendar waits on `/calendar` before prices show |
| Price transparency | Disclaimer only (`:441`) | "starting rates" is weak; show "from ₹X · taxes extra" |

### Recommendation
Keep the price-in-cell calendar (it's a strength), but: (a) **mobile → full-screen sheet**, (b) **abbreviate currency** in cells, (c) **skeleton-shimmer price row** while `/calendar` loads, (d) add a **sticky total bar** once dates are picked. If we want a clean break, a width-aware redesign delivering these is worth one focused batch.

*Sources: Octalysis (Booking.com CRO), Mobbin (Airbnb pickers), Snappymob (Booking vs Agoda), web.dev embed best-practices — full list in chat.*

---

## 3. Calendar Price Source — End-to-End Trace ✅

```
room_types.base_price ─┐
                       ├─►  GET /public/hotels/{slug}/calendar      ──► BookingWidget.tsx:113 (fetch)
room_rates (rate_plan_id IS NULL,  rooms.py:504-620                      └─► :412-437 render min_price
  daily date overrides) ─┘   (Redis 30s TTL, min price across room types)
bookings + room_blocks ──► availability (total_inventory − booked − blocked)
```

| Step | File | Lines |
|------|------|-------|
| Frontend fetch | `frontend/src/guest_booking/BookingWidget.tsx` | 113–134 |
| Frontend render (`min_price`) | same | 412–437 |
| Backend endpoint | `backend/app/guest_booking/rooms.py` | 504–620 |
| Base price column | `backend/app/rooms/room.py` | `RoomType.base_price` |
| Daily overrides | `backend/app/rate_plans/rates_model.py` | `RoomRate` where `rate_plan_id IS NULL` |
| Full dynamic pricing (search) | `backend/app/guest_booking/rooms.py` | 316–489 |
| Server price recompute (checkout) | `backend/app/guest_booking/bookings.py` | 137–180 |

### Key facts
- **Dynamic pricing? No** in the calendar — it shows the **minimum base price** per date only. Extra-person charges, rate-plan markups, promos, and taxes are **not** reflected.
- **Source of truth is correct and tenant-scoped** (filtered by resolved `hotel_id`).
- **Checkout is safe:** the server recomputes the total and rejects mismatches (`bookings.py:137-180`).

### Stale / wrong-price risks
| Risk | Severity | Note |
|------|----------|------|
| Calendar "₹2500" ≠ checkout "₹3500" (extra guests / tax / plan) | **High (UX)** | Only a weak "starting rates" disclaimer (`:441`). Surface "from ₹X · taxes extra". |
| Mismatch tolerance is a flat **±₹5** (`bookings.py:172`) | Medium | Should be percentage-based for high-value rooms. |
| Redis 30s TTL + SSE 2–4s lag | Low | Acceptable; brief stale window after a rate change. |
| Timezone date-boundary | Low–Med | No explicit hotel-tz handling; possible off-by-one on boundary dates. |
| Frontend uses raw fetch, no React Query staleTime | Low | Always-fresh (good for accuracy), but no dedupe (perf). |

---

## 4. Widget Loading Delay ✅

**Both widgets reveal late due to *artificial* timers stacked on top of bundle load.**

| # | Mechanism | Code Ref | Delay | Fix | Priority |
|---|-----------|----------|-------|-----|----------|
| 4.1 | Chat iframe mount gated behind idle callback | `widget-v3.js:357-361` | **1.2–2.5s** | Mount on first interaction OR ~200ms, not 2.5s | **P1** |
| 4.2 | Chat reveal hard timer | `widget-v3.js:329` | **1.5s** | Reveal on `CHAT_READY` postMessage (already sent), drop the 1500ms guess | **P1** |
| 4.3 | Booking reveal hard timer | `widget-v3.js:164` | **0.8s** | Reveal on `WIDGET_READY`; keep a short safety fallback (~400ms) | **P1** |
| 4.4 | Skeleton removal timer | `widget-v3.js:157-159` | 0.35s ×2 | Reduce/remove; CSS opacity handles fade | P2 |
| 4.5 | iframe loads full 596KB app | `vite.config.ts` (no widget entry) | 0.5–1.5s | Separate Vite entry for widget/chat → 75–90% smaller | P2 |
| 4.6 | Config fetch blocks render | `BookingWidget.tsx:34-56`, `ChatWidget.tsx:125-141` | 0.5–1s | Render with defaults, hydrate config async | P2 |

**Net observed (estimate):** Booking ~2–4s, Chat ~3–5.5s to fully usable. The receiving-side `WIDGET_READY`/`CHAT_READY` signals already exist — the timers are redundant guesses we can largely remove.

**Impact:** Industry benchmark ≈ **7% conversion loss per 1s** of delay. Cutting ~2s of artificial delay is a direct, low-risk revenue recovery.

---

## 5. Security Audit (classified P0–P3)

> ✅ verified in code · ⚠️ exposure confirmed, execution-sink to confirm before final wording

| # | Finding | Vector | Code Ref | Sev | Fix |
|---|---------|--------|----------|-----|-----|
| 5.1 ✅ | Booking iframe has **no `sandbox`** | iframe isolation | `widget-v3.js:132-146` | **P0** | `sandbox="allow-same-origin allow-scripts allow-forms allow-popups"` (NOT `allow-top-navigation`) |
| 5.2 ✅ | Chat iframe has **no `sandbox`** | iframe isolation | `widget-v3.js:316-325` | **P0** | Same sandbox tokens |
| 5.3 ✅⚠️ | `widget_custom_js` returned by **public** endpoint | XSS / code exec | `hotels.py:211` | **P0 if executed** | Confirm frontend sink; remove from public config, move to authenticated admin. If injected/eval'd anywhere → P0 |
| 5.4 ✅⚠️ | `widget_custom_css` returned publicly | CSS exfil / overlay | `hotels.py:210` | **P1** | Allowlist-only styling or move to authed; no `url()`/`background-image` |
| 5.5 ✅ | Chat sender `PARENT_ORIGIN` falls back to `'*'` | postMessage | `ChatWidget.tsx:18-24,153` | **P1** | Use `window.location.origin`; never post booking data to `'*'`. (Loader receive-side origin check at `widget-v3.js:333` is already correct ✅) |
| 5.6 ⚠️ | Chat endpoint doesn't check `hotel.is_active` | enumeration | `chat.py:191-203` | **P1** | Add `is_active` check; uniform 404 |
| 5.7 ⚠️ | Guest message → agent history unsanitized | prompt injection | `guest_agent.py` (system prompt + user msg) | **P1** | Max-length cap, strip delimiters, bind `prepare_booking` args to session, keep `tool_call_limit` |
| 5.8 ⚠️ | AI token quota enforced **after** stream starts | cost / authz | `chat.py:330-456` (quota at `:372`) | **P1** | Enforce quota before first byte; per-IP/email limit |
| 5.9 ⚠️ | Exact inventory `remaining=N` exposed | inventory leak | `rooms.py:385-387` | **P1** | Return buckets ("limited"/"available"); per-IP rate limit |
| 5.10 | 404 vs 403 distinguishable | enumeration | `chat.py:193-203`, `hotels.py:158-162` | **P2** | Uniform 404 for missing/inactive/feature-off |
| 5.11 | ReactMarkdown without explicit sanitize | XSS | `ChatWidget.tsx:348-361` | **P2** | Add `rehype-sanitize`; verify `<img onerror>` can't fire |
| 5.12 | No CSRF nonce on booking/order creation | CSRF | `payments.py:158-240` | **P2** | One-time nonce from widget-config, validated server-side |
| 5.13 | Booking state in `sessionStorage` (plaintext) | XSS data theft | `ChatWidget.tsx:168-172` | **P3** | Store a backend token, not full PII |

> Note on 5.3/5.4: exposure is confirmed (these fields ARE returned by a public endpoint). Whether `custom_js` is actually executed determines P0 vs "remove anyway". I will confirm the frontend consumption sink before shipping that change. The security subagent also flagged a `frame-ancestors 'none'` CSP at `main.py:167` as contradictory — since the widget embeds fine, that needs direct verification and is **not** treated as confirmed.

---

## 6. Revenue Impact Audit — "What stops a first-time guest from booking?"

Walking the journey of a first-time guest on a hotel's site:

| Stage | What they hit | Root Cause | Code Ref | Impact | Fix | Priority |
|-------|---------------|-----------|----------|--------|-----|----------|
| Page load | Booking bar appears 2–4s late; chat button pops in seconds later | artificial reveal timers + idle-callback | `widget-v3.js:164,329,357` | Looks broken/slow; some bounce to an OTA | Remove timers, signal-based reveal (§4) | **P1** |
| Pick dates | Calendar opens **half cut-off** on mobile | `overflow-hidden` + small iframe height | `BookingWidget.tsx:367`, `widget-v3.js:117` | Can't see/scroll dates → abandon | §1 fixes | **P1** |
| Compare prices | Calendar shows ₹2500, checkout ₹3500 | calendar = base only; tax/extra later | `rooms.py:504-620` vs `bookings.py:137-180` | Price-surprise → trust loss at checkout | "from ₹X · taxes extra" + total bar (§2/§3) | **P1** |
| Mobile flow | Popover calendar cramped; no sticky CTA | popover not full-screen sheet | `BookingWidget.tsx:385` | Extra friction on the majority device | Full-screen sheet + sticky reserve bar | **P2** |
| Chat help | Chat button late; if opened, possible injection/cost abuse | idle mount + late quota | `widget-v3.js:357`, `chat.py:372` | Lost assist opportunity; cost risk | §4 + §5 | **P1/P2** |
| Trust | No iframe sandbox / public custom JS | isolation gaps | `widget-v3.js:132`, `hotels.py:211` | One compromised hotelier account → guest PII/payment risk across widget | §5 P0s | **P0** |

**Bottom line:** the three biggest *direct* booking-loss levers are (1) **artificial loading delay**, (2) **clipped mobile calendar**, (3) **price surprise** between calendar and checkout. The biggest *risk* lever is the **missing iframe sandbox + public custom JS**.

---

## 7. Recommended Implementation Sequence

1. **P0 security (fast, high-leverage):** add `sandbox` to both iframes (`widget-v3.js`); confirm + remove `widget_custom_js`/`css` from the public endpoint.
2. **Calendar cut-off quick fix:** remove `overflow-hidden`, add bounded scroll, raise provisional height (§1.1–1.3).
3. **Loading delay:** drop redundant reveal timers + idle-callback gate; rely on existing `WIDGET_READY`/`CHAT_READY` signals (§4.1–4.3).
4. **Price clarity:** "from ₹X · taxes extra" + percentage tolerance at checkout (§3).
5. **P1 security:** `is_active` check, postMessage origin, prompt-injection guard, AI quota ordering, inventory buckets.
6. **UX redesign (own batch):** mobile full-screen calendar sheet, currency abbreviation, skeleton price cells, sticky CTA (§2).
7. **Perf (own batch):** separate Vite widget/chat entry bundles (§4.5).

Each change is independently shippable and testable.
