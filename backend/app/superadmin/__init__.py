from fastapi import APIRouter

from .hotels.hotels import router as hotels_router
from .dashboard.users import router as users_router

# Keep cross-used MODELS imported at startup so create_all builds their tables
# even though their admin routers were removed. The rest of the app (auth,
# quota enforcement, hotel/user chain links) depends on these tables existing.
from .platform.platform_model import SuperAdminRole  # noqa: F401 — require_permission()
from .subscriptions.subscription import Subscription  # noqa: F401 — AI quota / billing
from .chains.chain import Chain  # noqa: F401 — hotel & user chain association

# Scope trimmed (2026-06-20): the Super Admin surface is intentionally reduced to
# the two things needed at current scale —
#   1. Hotels — list + per-hotel feature toggles (the control centre)
#   2. Users  — add/manage hotel staff and their access
# The previous tabs (subscriptions, commissions, payouts, KYC, tickets, revenue,
# health, cache, sessions, integrations, chains/bulk, platform, exports) and their
# routers were removed. Shared MODELS that the rest of the app still depends on are
# kept (subscriptions.subscription.Subscription, chains.chain.Chain,
# platform.platform_model TAB_PERMISSIONS/SuperAdminRole, platform.sessions token
# helpers) — only their admin routers/pages are gone.
router = APIRouter(prefix="/superadmin", tags=["Super Admin"])
router.include_router(hotels_router)
router.include_router(users_router)
