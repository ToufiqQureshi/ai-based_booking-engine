# Bookings Feature Map

## Purpose
Hotel bookings create, view, edit, cancel karna. Staff aur managers use karte hain.
Guest-facing booking flow alag hai → dekho: public-booking.md

## Auth Gate
```
backend/app/api/deps.py → CurrentUser (any hotel staff)
Role needed: OWNER, MANAGER, or STAFF
```

---

## Frontend → Backend → Model Trail

| Action | Frontend File | API Endpoint File | Model File |
|---|---|---|---|
| Bookings list page | `pages/bookings/Bookings.tsx` | `api/v1/bookings.py` | `models/booking.py` |
| Guest list page | `pages/bookings/Guests.tsx` | `api/v1/bookings.py` | `models/booking.py` |
| View booking details | `components/bookings/BookingDetailsDialog.tsx` | `api/v1/bookings.py` | `models/booking.py` |
| Create booking (staff) | `components/bookings/CreateBookingDialog.tsx` | `api/v1/bookings.py` | `models/booking.py` |
| Edit booking | `components/bookings/EditBookingDialog.tsx` | `api/v1/bookings.py` | `models/booking.py` |

---

## Entry Point Files
```
Frontend:  frontend/src/pages/bookings/Bookings.tsx
Backend:   backend/app/api/v1/bookings.py
Model:     backend/app/models/booking.py
Tests:     backend/tests/api/v1/test_bookings.py
```

## Common Bugs & Where to Look
```
"Booking nahi dikh raha"  → bookings.py → hotel_id filter check karo (IDOR risk)
"Status update nahi hua"  → bookings.py → role check karo
"Amount galat hai"        → bookings.py → server-side amount computation check karo
                            (NEVER trust client-sent amount)
```
