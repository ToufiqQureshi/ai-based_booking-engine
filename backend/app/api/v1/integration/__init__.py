from fastapi import APIRouter

from .settings import router as settings_router
from .google import router as google_router
from .whatsapp import router as whatsapp_router

router = APIRouter(prefix="/integration", tags=["Integration"])
router.include_router(settings_router)
router.include_router(google_router)
router.include_router(whatsapp_router)
