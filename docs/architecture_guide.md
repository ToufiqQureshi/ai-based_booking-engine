# File Management & Architecture Guide

Bahut deep folder structures hone se teams ko confusion hona common hai. Aapki app ek modern **FastAPI (Backend)** aur **React/Vite (Frontend)** stack par bani hai. Yahan backend aur frontend dono ek specific "Layered Architecture" follow karte hain. 

Niche poore structure ka ek aasan breakdown hai jisse aapki team ko pata chalega ki **kaun si file kya karti hai** aur **kisse linked hai**.

---

## 1. Frontend Structure (`frontend/src/`)
Frontend React pe based hai. Data ka flow usually aisa hota hai:
`Page (UI)` ➔ `Component (Buttons/Forms)` ➔ `Hook/API (Data fetch)` ➔ **Backend**

- 📁 **`pages/`**: Ye aapke actual web pages hain (jaise `Dashboard.tsx`, `Settings.tsx`). Har page multiple components se mil kar banta hai.
- 📁 **`components/`**: Ye chote, reusable UI parts hain (jaise Buttons, Modals, Forms). Ye `pages` ke andar use hote hain. (e.g. `GoogleHotelAdsTab.tsx`).
- 📁 **`api/`**: Yahan se backend ko HTTP requests (GET, POST) bheji jati hain.
- 📁 **`hooks/`**: React hooks jo API aur UI ke beech ka logic handle karte hain (jaise `useAuth()`, `useSettings()`).
- 📁 **`contexts/`**: Global state management (jaise current user kaun hai, theme light hai ya dark).
- 📁 **`layouts/`**: Pages ka outer dhancha (jaise Sidebar aur Top Navbar jo har page pe same rehte hain).
- 📁 **`types/`**: TypeScript ke rules/interfaces jo define karte hain ki data kaisa dikhega.

> [!TIP]
> **Linkage Example (Frontend):** 
> `pages/settings/Settings.tsx` import karta hai `components/settings/AIAgentTab.tsx` ko, jo call karta hai `hooks/useSettings.ts` ko, jo finally `api/settingsApi.ts` ke through backend ko call lagata hai.

---

## 2. Backend Structure (`backend/app/`)
Backend FastAPI pe based hai. Request aane par data flow aisa hota hai:
`API (Route)` ➔ `Service (Business Logic)` ➔ `Model (Database)`

- 📁 **`api/v1/`**: Ye aapke **Routes/Endpoints** hain (jaise `/api/v1/integration/settings`). Ye decide karte hain kaunsa URL kya kaam karega.
- 📁 **`services/`**: Asli **Business Logic** yahan hota hai. Route request receive karke service ko deta hai ki "Ye lo data, ab ispe calculation karo".
- 📁 **`models/`**: Ye aapke **Database Tables** ka structure hain (SQLAlchemy/SQLModel). Inka direct connection Supabase database se hota hai.
- 📁 **`schemas/`**: Ye **Pydantic Models** hain jo check karte hain ki user ne jo data form mein bhara hai wo sahi format (string, number, email) mein hai ya nahi. (API validation).
- 📁 **`core/`**: Core configurations jaise database connection setup, security (JWT tokens), aur environment variables (`config.py`).

> [!TIP]
> **Linkage Example (Backend):** 
> Frontend request karta hai `/api/v1/integration` ko ➔ Wo route `api/v1/integration.py` mein handle hoti hai ➔ Ye route `services/integration_service.py` se data mangta hai ➔ Service `models/integration.py` (Database table) ko query karti hai.

---

## 🛠️ File Management Simple Kaise Karein? (Without Breaking Logic)

Agar team ko files dhundhne mein problem ho rahi hai, toh aap code logic break kiye bina in 4 steps se management simple kar sakte hain:

### 1. `index.ts` (Barrel Exports) ka use karein
Frontend mein, agar components bohot zyada hain, toh har folder mein ek `index.ts` banayein jahan se sabhi components export hon.
- **Before:** `import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input';`
- **After:** `import { Button, Input } from '@/components/ui';`

### 2. Feature-based Grouping (Domain Driven Design)
Agar folders file-type (pages, components, api) ke hisaab se zyada bade ho gaye hain, toh unhe **Features** ke hisaab se group kar sakte hain.
- Ek `frontend/src/features/Settings/` folder banayein.
- Uske andar hi settings ke components, api, aur types rakh dein. 
*Note: Isko aaram se dhire-dhire migrate kiya ja sakta hai.*

### 3. VS Code Workspaces & Bookmarks
Code break karne ke bajaye VS Code ki functionalities use karein:
- **VS Code Bookmarks Extension:** Team jin files pe roz kaam karti hai unhe bookmark kar le.
- **Ctrl+P / Cmd+P (Quick Open):** Folders click karke open karne ki aadat chhod dein, direct `Ctrl+P` press karke file ka naam type karein (e.g. `Settings.tsx`).

### 4. Har Folder mein ek `README.md` rakhein
Aapke `backend/` aur `frontend/` ke har main folder (jaise `services/` aur `api/`) mein ek simple `README.md` file add kar dein jisme likha ho:
*"Yahan kya rakha jata hai aur ye folder kis liye hai?"* 
Ye nayi team members ke liye map ka kaam karega!
