from fastapi import APIRouter

from .hotels import router as hotels_router
from .rooms import router as rooms_router
from .bookings import router as bookings_router
from .chat import router as chat_router
from .payments import router as payments_router

router = APIRouter()
router.include_router(hotels_router)
router.include_router(rooms_router)
router.include_router(bookings_router)
router.include_router(chat_router)
router.include_router(payments_router)
