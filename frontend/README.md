# Frontend Developer Guide

Welcome to the Staybooker Frontend! 

This project uses a **Flat Feature-Based Architecture** (also known as Feature-Sliced Design but simplified). This means we group code by **business domain** (e.g., Bookings, Analytics, Settings) rather than by technical type (e.g., Pages, Components, Hooks).

## Folder Structure Rules

### 1. The `features/` Directory (Where you will work 90% of the time)
If you are building a new feature or page, create a folder under `src/features/`.
Inside this folder, place **all** files related to that feature directly at the root of the folder. Do not create subfolders like `components/` or `pages/` inside it.

✅ **DO THIS (Flat Structure):**
```text
src/features/bookings/
 ├── BookingsDashboard.tsx    <-- Main Page Component
 ├── BookingRow.tsx           <-- Small UI Component specific to bookings
 ├── useBookings.ts           <-- React Query API hook
 └── types.ts                 <-- TypeScript interfaces for bookings
```

❌ **DO NOT DO THIS (Nested Structure):**
```text
src/features/bookings/
 ├── pages/
 │   └── BookingsDashboard.tsx
 ├── components/
 │   └── BookingRow.tsx
```

### 2. The `components/` Directory (Shared UI)
Only use `src/components/` for highly generic, reusable UI blocks that have NO business logic. 
Examples: `Button.tsx`, `Modal.tsx`, `Card.tsx`, `DatePicker.tsx`.

### 3. The `App.tsx` Router
When adding a new route, import the main page component directly from the feature folder:
```tsx
import { BookingsDashboard } from "@/features/bookings/BookingsDashboard";
```

## Why Flat Features?
- **No deep nesting:** You don't have to click through 4 folders just to find a component.
- **Easy debugging:** If a bug is in "Analytics", you know exactly which single folder contains the entire frontend code for it.
- **Clean imports:** `import { AnalyticsTab } from "@/features/analytics/AnalyticsTab"` is much cleaner than importing from `components/superadmin/` and `pages/` simultaneously.

Happy Coding!
