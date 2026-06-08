"""
Competitor Rates package.
Splits the original monolithic competitors.py into focused sub-modules:
  crud.py          — list / add / delete / toggle-schedule endpoints
  scraper.py       — Decodo API client + HTML parsing (no router)
  background.py    — 7-day scrape loop (no router)
  scrape_control.py — trigger / stop / progress endpoints
  analysis.py      — market analysis + rate comparison endpoints
  schedule.py      — auto-scrape schedule endpoints + hourly scheduler tick
  usage.py         — Decodo usage endpoint
"""
from fastapi import APIRouter

from .crud import router as _crud_router
from .scrape_control import router as _control_router
from .analysis import router as _analysis_router
from .schedule import router as _schedule_router
from .usage import router as _usage_router

# Re-export callables consumed by the scheduler, other modules, and existing tests
from .background import run_background_scrape          # noqa: F401
from .schedule import run_due_auto_scrapes              # noqa: F401
from .crud import CompetitorCreate                      # noqa: F401
from .scraper import _is_stale_running, STALE_SCRAPE_MINUTES  # noqa: F401

# Sub-routers own the /competitors prefix — outer router is just a combiner.
router = APIRouter()
router.include_router(_crud_router)
router.include_router(_control_router)
router.include_router(_analysis_router)
router.include_router(_schedule_router)
router.include_router(_usage_router)
