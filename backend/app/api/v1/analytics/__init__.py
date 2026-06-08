"""
Analytics package — combines all analytics sub-routers into a single router.
File layout (each ~100-200 lines, one concern each):
  tracking.py  — public widget tracking (session start / ping / event)
  dashboard.py — full aggregated dashboard endpoint
  reports.py   — focused sub-dashboard endpoints (revenue, traffic, AI, cancellations, KPIs)
  live.py      — real-time active visitors + event feed
"""
from fastapi import APIRouter

from .tracking import router as _tracking_router
from .dashboard import router as _dashboard_router
from .reports import router as _reports_router
from .live import router as _live_router

router = APIRouter()
router.include_router(_tracking_router)
router.include_router(_dashboard_router)
router.include_router(_reports_router)
router.include_router(_live_router)
