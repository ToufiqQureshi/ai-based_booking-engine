# Super Admin Feature Map

## Purpose
Platform-level control. Sirf Staybooker team ke log (not hotel owners) use karte hain.
Hotel management, subscriptions, KYC, payouts, revenue, system health sab yahan hai.

## Auth Gate
```
backend/app/api/deps.py
  → get_super_admin()         ← basic superadmin check
  → require_permission()      ← financial/PII endpoints ke liye
```

---

## Frontend → Backend → Model Trail

| UI Tab | Frontend Component | API Endpoint File | Model File |
|---|---|---|---|
| Hotels list | `components/superadmin/HotelsTab.tsx` | `api/v1/superadmin/hotels.py` | `models/hotel.py` |
| Users list | `components/superadmin/UsersTab.tsx` | `api/v1/superadmin/users.py` | `models/user.py` |
| Subscriptions | `components/superadmin/SubscriptionModal.tsx` | `api/v1/superadmin/subscriptions.py` | `models/subscription.py` |
| KYC | `components/superadmin/KycTab.tsx` | `api/v1/superadmin/kyc.py` | `models/kyc.py` |
| Revenue | `components/superadmin/RevenueTab.tsx` | `api/v1/superadmin/revenue.py` | `models/payment.py` |
| Payouts | `components/superadmin/PayoutsTab.tsx` | `api/v1/superadmin/payouts.py` | `models/payment.py` |
| Commissions | `components/superadmin/CommissionsTab.tsx` | `api/v1/superadmin/commissions.py` | `models/commission.py` |
| Chains/Brands | `components/superadmin/BrandsTab.tsx` | `api/v1/superadmin/chains.py` | `models/chain.py` |
| Tickets | `components/superadmin/TicketsTab.tsx` | `api/v1/superadmin/tickets.py` | `models/ticket.py` |
| Audit Logs | `components/superadmin/AuditLogsTab.tsx` | `api/v1/superadmin/sessions.py` | `models/audit.py` |
| Platform Settings | `components/superadmin/PlatformTab.tsx` | `api/v1/superadmin/platform.py` | `models/platform.py` |
| Cache Management | `components/superadmin/CacheTab.tsx` | `api/v1/superadmin/cache_mgmt.py` | `core/cache.py` |
| System Health | `components/superadmin/HealthTab.tsx` | `api/v1/superadmin/health.py` | (system checks) |
| Bulk Ops | — | `api/v1/superadmin/bulk.py` | multiple |
| Exports | — | `api/v1/superadmin/exports.py` | multiple |
| Hotel Integrations | `components/superadmin/HotelIntegrationsTab.tsx` | `api/v1/superadmin/integrations.py` | `models/integration.py` |

---

## Entry Point Files
```
Frontend entry:   frontend/src/pages/superadmin/SuperAdminDashboard.tsx
Backend router:   backend/main.py  (superadmin router registered here)
All tab components: frontend/src/components/superadmin/
All API files:    backend/app/api/v1/superadmin/
```

## Common Bugs & Where to Look
```
"403 Forbidden"       → deps.py → get_super_admin() or require_permission()
"Data nahi aa raha"   → specific superadmin/*.py endpoint → check DB query
"Tab blank hai"       → components/superadmin/<TabName>.tsx → API call check karo
"Payout fail"         → superadmin/payouts.py → models/payment.py
```
