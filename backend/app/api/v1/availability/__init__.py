"""
Availability package.
Splits the original monolithic availability.py into focused sub-modules:
  helpers.py  — _assert_room_type_owned, clear_availability_cache,
                set_single_day_rate, set_single_day_block
  read.py     — GET /availability, GET /blocks
  write.py    — POST /blocks, DELETE /blocks/{id}, POST /rates,
                POST /weekend-update, POST /copy
"""
from fastapi import APIRouter

from .read import router as _read_router
from .write import router as _write_router

# Re-export so all existing callers keep working:
#   from app.api.v1.availability import clear_availability_cache
from .helpers import clear_availability_cache  # noqa: F401

# Sub-routers own the /availability prefix — outer router is just a combiner.
router = APIRouter()
router.include_router(_read_router)
router.include_router(_write_router)
