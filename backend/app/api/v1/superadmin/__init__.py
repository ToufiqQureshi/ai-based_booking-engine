from fastapi import APIRouter, Depends

from .hotels import router as hotels_router, get_super_admin
from .users import router as users_router
from .subscriptions import router as subscriptions_router
from .integrations import router as integrations_router
from .health import router as health_router
from .chains import router as chains_router
from .revenue import router as revenue_router
from .bulk import router as bulk_router
from .cache_mgmt import router as cache_router
from .sessions import router as sessions_router
from .exports import router as exports_router
from .kyc import router as kyc_router
from .commissions import router as commissions_router
from .payouts import router as payouts_router
from .tickets import router as tickets_router
from .platform import router as platform_router

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])
router.include_router(hotels_router)
router.include_router(users_router)
router.include_router(subscriptions_router)
router.include_router(chains_router)
router.include_router(integrations_router)
router.include_router(health_router)
router.include_router(revenue_router)
router.include_router(bulk_router)
router.include_router(cache_router)
router.include_router(sessions_router)
router.include_router(exports_router)
router.include_router(kyc_router)
router.include_router(commissions_router)
router.include_router(payouts_router)
router.include_router(tickets_router)
router.include_router(platform_router)


# Cron-triggered subscription expiry check
@router.post("/cron/check-expiry")
async def run_expiry_check(super_admin=Depends(get_super_admin)):
    """Manually trigger subscription expiry notification check."""
    from app.core.tasks import check_subscription_expiry
    result = await check_subscription_expiry()
    return {"status": "done", **result}
