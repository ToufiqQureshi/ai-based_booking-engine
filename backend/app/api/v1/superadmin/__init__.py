from fastapi import APIRouter

from .hotels import router as hotels_router, get_super_admin
from .users import router as users_router
from .subscriptions import router as subscriptions_router
from .integrations import router as integrations_router

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])
router.include_router(hotels_router)
router.include_router(users_router)
router.include_router(subscriptions_router)
router.include_router(integrations_router)
