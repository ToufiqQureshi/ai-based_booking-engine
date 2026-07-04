# 02 — React Fundamentals, MERE Apne Code Se

> Same tareeka jaise FastAPI file mein — concept + mere code ka exact file+line + WHY.

---

## 1. `useState` — Component Ka Apna Local Data

**Concept:** `useState` ek component ke andar "memory" banata hai — jab ye value change hoti hai, component re-render hota hai. Ye sirf usi component ki apni cheez hai, bahar se koi directly nahi chhed sakta.

### Example 1 — Multiple filters + dialog state ek saath
`frontend/src/bookings/Bookings.tsx:130-142` (`BookingsPage()`)
8 alag `useState` calls hain:
- `statusFilter`, `sourceFilter`, `searchQuery`, `currentPage` — bookings table ke filters/pagination
- `leadsSearch`, `leadsStatusFilter` — leads table ke apne alag filters (do independent tables, do independent state sets)
- `selectedBooking`, `isDetailsOpen`, `isEditOpen` — kaunsi row select hui hai aur konsa dialog khula hai
- `isCancelling` (line 176) — jab cancel action chal raha ho, button ko dobara-click se bachane ke liye disable karna

**Kyun itni saari states:** Ek page pe do independent tables (bookings + leads) hain, dono ke apne filters chahiye — agar ek hi state use karte toh dono tables ek doosre ko affect kar dete.

### Example 2 — Form state + result state
`frontend/src/superadmin/components/ProvisionHotelDialog.tsx:65-72`
```ts
const [result, setResult] = useState(...)   // API success ke baad ka response
const [form, setForm] = useState({ hotel_name: '', owner_name: '', owner_email: '', plan_name: '' })
```
`form` user ke typing ko track karta hai, `result` sirf jab submit successful ho jaaye tab set hota hai — dono alag concerns hain isliye alag states.

---

## 2. `useEffect` — Kab Trigger Hota Hai

**Concept:** `useEffect` "side effects" ke liye hai — jaise data fetch karna, timer set karna, event listener lagana. Ye tab chalta hai jab component mount hota hai, ya jab uski dependency list mein di gayi values change hoti hain.

### Example 1 — Mount pe listener lagana, unmount pe hatana
`frontend/src/core/hooks/use-mobile.tsx:193-198`
Component mount hote hi `resize` event listener add hota hai (taaki `isMobile` state update ho), aur jab component screen se hat jaaye (unmount), cleanup function listener hata deta hai — warna memory leak ho jaata.

### Example 2 — Dependency change pe re-fetch
`frontend/src/guest_booking/BookingSelection.tsx:555-560`
`fetchData` effect tab-tab chalta hai jab `hotelSlug`, `checkIn`, ya `checkOut` change ho — matlab guest jaise hi dates badalta hai, room list automatically refresh ho jaati hai, bina page reload ke.

### Example 3 — Interval/timer
`frontend/src/guest_booking/BookingSelection.tsx:492-497`
Hotel photo carousel har 5 second mein image badalta hai `setInterval` se — aur jab component unmount ho, `clearInterval` cleanup chalta hai.

### Example 4 — Real-time SSE connection
`frontend/src/guest_booking/BookingSelection.tsx:779-782`
Jab hotel ka `id` mil jaata hai, ek `EventSource` (Server-Sent Events) connection khulta hai `/public/hotels/{id}/rate-updates` pe — isse guest ko bina refresh kiye naye rates dikhte hain agar hotelier price badal de.

**Yaad rakho:** `useEffect(fn, [])` = sirf mount pe ek baar. `useEffect(fn, [x])` = jab bhi `x` badle. `useEffect(fn)` (no array) = **har** render pe — ye rarely chahiye hota, kyunki infinite loop ka risk hota hai.

---

## 3. Props vs State — Real Difference

**Concept:** **Props** = data jo *parent* ne diya hai (ye component khud nahi badal sakta). **State** = data jo component *khud* manage karta hai.

### Pure Props Example (koi state hi nahi)
`frontend/src/rooms/components/RoomCard.tsx:14-21`
```ts
interface RoomCardProps { room, onEdit, onDelete, formatCurrency }
```
Poore file mein **koi `useState` nahi hai** — sab kuch parent (`frontend/src/rooms/Rooms.tsx:13,277`) se aata hai: data (`room`) aur callbacks (`onEdit`, `onDelete`). RoomCard sirf display karta hai, decide nahi karta.

### Props + State dono ek saath
`frontend/src/superadmin/components/ProvisionHotelDialog.tsx:52-72`
- **Props** (`ProvisionHotelDialogProps { open, onOpenChange }`, lines 52-55) — parent decide karta hai dialog dikhega ya nahi
- **State** (`result`, `form`, lines 65-72) — dialog ke andar user jo type kar raha hai, wo iska apna data hai

**Concrete difference:** Agar parent `open` prop badalta hai, RoomDialog re-render hoga (props change se). Agar user form mein type karta hai, `setForm` chalta hai — ye component ka apna internal update hai, parent ko iski khabar bhi nahi hoti jab tak submit na ho.

**Interview mein aksar poochha jaata hai:** "Props read-only kyun hote hain?" — Kyunki agar child apne props seedhe modify kar de, toh parent ko pata hi nahi chalega ki uska data kisi ne badal diya — data flow "one-way" (top-down) rehta hai, isliye debugging aasan hoti hai.

---

## 4. TanStack Query (React Query) — Data Fetching + Caching

**Concept:** Normally `useEffect` + `fetch` + manual loading/error state likhna padta. React Query ye sab khud handle karta hai — caching, background refetch, duplicate-request dedup — sab built-in.

### QueryClient setup
`frontend/src/App.tsx:63-73`:
```ts
staleTime: 1000 * 60 * 2    // 2 min — itni der tak data "fresh" mana jaata hai, dobara fetch nahi hota
gcTime: 1000 * 60 * 15      // 15 min — itni der baad cache garbage-collect ho jaata hai
retry: 1
refetchOnWindowFocus: false
```
(Note: CLAUDE.md ka architecture doc "5 min staleTime" bolta hai, par actual code mein 2 min/15 min hai — jab bhi docs aur code mismatch dikhe, **code ko hi sach maano**.)

### `useQuery` Examples
- `frontend/src/bookings/Bookings.tsx:158-165` — key `['bookings', statusFilter]`. `placeholderData: keepPreviousData` use hua hai — jab filter badalta hai, purana data screen pe dikhta rehta hai jab tak naya na aaye (flicker nahi hota).
- `frontend/src/dashboard/Dashboard.tsx:68-72` — `['dashboardStats']`, `staleTime: 2min`
- `frontend/src/dashboard/Dashboard.tsx:75-79` — `['recentBookings']`, `staleTime: 1min` (comment: "bookings change more often" — isliye global default se bhi kam staleTime diya)

### `useMutation` Examples
`frontend/src/superadmin/components/ProvisionHotelDialog.tsx:74-86`
```ts
mutationFn: → POST /superadmin/hotels/provision
onSuccess: setResult(...) + queryClient.invalidateQueries(['superadmin-hotels'])
onError: toast dikhana
```
**Ye kaafi important pattern hai**: jab bhi koi POST/PATCH/DELETE (data badalne wala action) karte ho, `useMutation` use karte ho, aur success pe related `useQuery` caches ko `invalidateQueries` se "stale" mark kar dete ho — taaki list turant refresh ho jaaye, bina manual `refetch()` bulaye.

**Kyun ye sab zaroori hai:** Bina React Query ke, har page pe manually likhna padta "agar do baar same API call ho rahi hai toh dono ko merge karo", "5 second baad phir se fetch karo", "loading spinner दिखाओ jab tak data na aaye" — ye sab already built-in mil jaata hai.

---

## 5. Component Structure — Reusable Components Kaha Kaha Use Hote Hain

| Component | File | Kaha Use Hota Hai |
|---|---|---|
| `PageShell` | `frontend/src/components/layout/PageShell.tsx:23-30` | ~19 pages mein — standard title/subtitle/actions wrapper (Dashboard, Rooms, Bookings, Rates, Taxes, Payments, Settings...) |
| `AppSidebar` + `AppHeader` | `frontend/src/components/layout/` | `DashboardLayout.tsx:237,260` ke andar — har authenticated page ka common nav shell |
| `RoomCard` | `frontend/src/rooms/components/RoomCard.tsx` | `Rooms.tsx:13,277` |
| `ImageUpload` / `VideoUploader` | `frontend/src/components/common/` | ~21 files mein (rooms, settings branding/gallery tabs) |
| shadcn/ui primitives (`Button`, `Card`, `Dialog`, `Table`, ...) | `frontend/src/components/ui/` (33 files) | Har jagah — e.g. `Card/CardContent/CardHeader/CardTitle` `Bookings.tsx:15` aur `Dashboard.tsx:17` dono mein |
| `useHotelWebSocket` (custom hook) | `frontend/src/core/hooks/useHotelWebSocket.ts:36` | `Dashboard.tsx:16,65` aur `Bookings.tsx:4,156` — live booking updates |
| `use-toast` (custom hook) | `frontend/src/core/hooks/use-toast.ts` | Har jagah success/error notification dikhane ke liye |

**Kyun components reusable banate hain:** `shadcn/ui` mat chhedo (`components/ui/` — CLAUDE.md rule) — agar `Button` ka style badalna hai toh central jagah badlo, har page pe alag se nahi. Ye "one change, everywhere updates" pattern hai.

---

## 6. Protected Routes — Auth Check Frontend Pe Kaise Hota Hai

**Important finding:** Is codebase mein alag se koi `ProtectedRoute`/`RequireAuth` wrapper component **nahi hai**. Auth-gating seedhe `DashboardLayout` component ke andar hoti hai:

`frontend/src/components/layout/DashboardLayout.tsx:92-232`
1. Line 93: `useAuth()` se `isLoading`, `isAuthenticated`, `hotel`, `user` nikaalta hai
2. Line 98-124: agar `isLoading` hai, poora skeleton (loading placeholder) dikhata hai
3. Line 126-128: agar `!isAuthenticated`, `<Navigate to="/login" replace />` — seedha login page bhej deta hai
4. Line 137-162: agar hotel/user `is_active = false` hai, ek "deactivated" screen dikhata hai
5. Line 205-224 (`isPathAllowed()`): current route ko `DEFAULT_ROLE_PERMISSIONS` (lines 18-31) se compare karta hai — agar STAFF role ho aur wo `/settings` khol raha ho, `AccessDeniedView` (264-272) dikhta hai
6. Sab check pass ho toh `<Outlet />` render hota hai — jismein actual child route (Dashboard, Rooms, etc.) load hota hai

**App.tsx mein usage** (`App.tsx:113`):
```tsx
<Route element={<DashboardLayout />}>
  {/* 26 authenticated routes yahan nested hain */}
</Route>
```

**Kyun ek separate `ProtectedRoute` component nahi hai:** Kyunki `DashboardLayout` already navigation shell (sidebar/header) render karta hai — auth-check + role-check + layout ek hi jagah combine kar diya gaya, taaki har route pe alag se `<ProtectedRoute><DashboardLayout>...` jaisa double-wrapping na karna pade.

Super Admin routes alag tareeke se gate hote hain — `isSuperAdminSubdomain()` (`App.tsx:75,78`) se, jo subdomain check karta hai, role check nahi (kyunki super admin panel apne alag subdomain pe hi serve hota hai).

---

## 7. API Client Setup — Frontend Backend Se Baat Kaise Karta Hai

**File:** `frontend/src/core/api/client.ts`

1. **Base URL selection** (`getBaseUrl()`, lines 18-38) — hostname dekhkar decide karta hai staging/prod/local konsa backend URL use karna hai.
2. **Token storage** (`tokenStorage`, lines 48-63) — `localStorage` mein `hotel_access_token`/`hotel_refresh_token` keys ke through JWT store hota hai.
3. **Auth header auto-attach** (`getHeaders()`, lines 81-93) — **har** API call mein khud-ba-khud `Authorization: Bearer <token>` header laga deta hai (line 89) — isliye har page mein manually token pass nahi karna padta.
4. **401 handling** (`handleResponse()`, lines 96-162) — agar token expire ho gaya, ek baar `tryRefreshToken()` try karta hai (line 108); agar wo bhi fail ho, tokens clear karke `/login` pe redirect kar deta hai.
5. **403 handling** (lines 120-126) — `user-deactivated`/`hotel-deactivated` custom window events fire karta hai, jo `AuthContext.tsx:162-174` sunta hai aur user ko turant logout kar deta hai.
6. **`apiClient` object** (lines 211-386) — `get`, `post`, `put`, `patch`, `delete`, `download` methods, sabme 30-second timeout (`AbortController` se).

**Usage examples:**
- `frontend/src/bookings/Bookings.tsx:33` — import; line 162 `apiClient.get('/bookings', params)`; line 191 `apiClient.patch(...)`
- `frontend/src/dashboard/Dashboard.tsx:20,70` — `apiClient.get('/dashboard/stats')`

**Kyun centralize kiya:** Agar kal ko auth-header ka format badalna pade (JWT se cookie-based auth), sirf ek file (`client.ts`) badalni padegi — 40+ pages mein individually nahi jaana padega.

---

## 8. AuthContext — "Who Is Logged In"

**File:** `frontend/src/core/contexts/AuthContext.tsx` (288 lines)

- **State**: `user`, `hotel`, `isLoading` (lines 25-27) — sab `useState` se andar hi manage hote hain
- **`login()`** (lines 177-231): Supabase se seedha `signInWithPassword()` call karta hai (backend ka apna `/auth/login` route nahi hai!), tokens store karta hai, phir backend se `authApi.getCurrentUser()` se poora user profile laata hai
- **`logout()`** (lines 246-258): Supabase `signOut()` + local state/tokens clear
- **Mount effect** (lines 30-158): `supabase.auth.getSession()` se purana session restore karta hai, aur `onAuthStateChange` (line 135) subscribe karta hai — agar user ne doosre tab mein logout kiya, ye tab bhi sync ho jaata hai
- **`useAuth()` hook** (lines 279-285): `useContext(AuthContext)` — agar `AuthProvider` ke bahar use kiya jaaye, error throw karta hai (developer ko turant pata chal jaaye galti)

**Kaise use hota hai:** `Dashboard.tsx:19,45` — `const { hotel, user } = useAuth();` — kisi bhi component mein ek line se current logged-in user/hotel mil jaata hai, bina props se pass kiye (isse "prop drilling" — 5 layers deep props pass karna — nahi karna padta).

---

## Quick Recap Table

| React Concept | File:Line |
|---|---|
| `useState` (multi-filter) | `frontend/src/bookings/Bookings.tsx:130-142` |
| `useEffect` (SSE connect) | `frontend/src/guest_booking/BookingSelection.tsx:779-782` |
| Props-only component | `frontend/src/rooms/components/RoomCard.tsx:14-21` |
| QueryClient config | `frontend/src/App.tsx:63-73` |
| `useQuery` with `keepPreviousData` | `frontend/src/bookings/Bookings.tsx:158-165` |
| `useMutation` + cache invalidate | `frontend/src/superadmin/components/ProvisionHotelDialog.tsx:74-86` |
| Auth-gate (no separate ProtectedRoute) | `frontend/src/components/layout/DashboardLayout.tsx:92-232` |
| API client auto-auth-header | `frontend/src/core/api/client.ts:81-93` |
| AuthContext | `frontend/src/core/contexts/AuthContext.tsx` |
