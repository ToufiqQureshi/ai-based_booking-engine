# Staybooker Testing Guide

Mera main goal ye hai ki naya feature add karte waqt purani cheezein (Regressions) break na hon. Iske liye humne ye testing structure banaya hai.

## 1. Backend Tests (Pytest)
Ye tests business logic, calculations, aur security check karte hain.

**Kaise chalayein:**
```bash
cd backend
pytest
```
*Saare critical flows (Bookings, Payments) check ho jayenge.*

## 2. Frontend Tests (Playwright)
Ye "Visual" tests hain jo browser open karke dekhte hain ki pages sahi dikh rahe hain ya nahi.

**Kaise chalayein:**
```bash
cd frontend
npx playwright test
```
*Ye Landing page, Login, aur Search page ko auto-verify karega.*

## 3. Page-by-Page Strategy
Maine saare major pages ke liye tests setup kar diye hain:
- **Backend:** `Analytics`, `Rooms`, `Rates`, `Bookings`, aur `Payments` ke security aur critical logic tests ready hain.
- **Frontend:** Har major page (Analytics, Rooms, Rates, Settings, etc.) ke liye "Auth-Guard" smoke tests ready hain.

**Rule for AI:**
Jab bhi mujhse naya page ya feature banwayein, hamesha ye bolein: *"Bhai iska test bhi likh dena."* Main automatic `tests/` folder mein uski logic aur visibility file add kar dunga.
