"""
Super Admin — Revenue analytics: MRR, ARR, churn, new signups.
"""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import func, select

from app.api.deps import DbSession
from app.models.hotel import Hotel
from app.models.subscription import Subscription
from app.models.user import User
from .hotels import get_super_admin, load_plan_features

logger = logging.getLogger(__name__)
router = APIRouter()

# Plan → monthly price in INR (adjust if pricing changes)
PLAN_PRICES_INR = {
    "enterprise": 14999,
    "premium":     7499,
    "basic":       2999,
    "free":           0,
    "none":           0,
}


def _plan_price(plan_name: str) -> int:
    return PLAN_PRICES_INR.get((plan_name or "free").lower(), 0)


@router.get("/revenue")
async def revenue_analytics(
    session: DbSession,
    super_admin: User = Depends(get_super_admin),
):
    """MRR, ARR, plan distribution, new signups, churn."""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    subs_res = await session.execute(select(Subscription))
    all_subs = subs_res.scalars().all()

    active_subs = [s for s in all_subs if s.status == "active"]

    # MRR from active subscriptions
    mrr = sum(_plan_price(s.plan_name) for s in active_subs)
    arr = mrr * 12

    # Plan distribution
    plan_dist: dict[str, int] = {}
    for s in active_subs:
        plan = (s.plan_name or "Free").capitalize()
        plan_dist[plan] = plan_dist.get(plan, 0) + 1

    # New this month
    new_this_month = [s for s in all_subs if s.created_at >= month_start]

    # Churned this month (cancelled/expired)
    churned_this_month = [
        s for s in all_subs
        if s.status in ("cancelled", "expired") and s.updated_at >= month_start
    ]

    # Prev month for comparison
    new_prev_month = [
        s for s in all_subs
        if prev_month_start <= s.created_at < month_start
    ]
    churned_prev_month = [
        s for s in all_subs
        if s.status in ("cancelled", "expired")
        and prev_month_start <= s.updated_at < month_start
    ]

    # Expiring soon (next 7 days)
    expiring_soon = [
        s for s in active_subs
        if s.end_date and s.end_date <= now + timedelta(days=7)
    ]

    # MRR trend (last 6 months) - simplified: based on created_at
    mrr_trend = []
    for i in range(5, -1, -1):
        m_start = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        month_active = [
            s for s in all_subs
            if s.created_at < m_end and (not s.end_date or s.end_date > m_start) and s.status == "active"
        ]
        mrr_trend.append({
            "month": m_start.strftime("%b %Y"),
            "mrr": sum(_plan_price(s.plan_name) for s in month_active),
            "count": len(month_active),
        })

    return {
        "mrr": mrr,
        "arr": arr,
        "active_subscriptions": len(active_subs),
        "plan_distribution": [
            {"plan": k, "count": v, "monthly_value": _plan_price(k) * v}
            for k, v in plan_dist.items()
        ],
        "new_this_month": len(new_this_month),
        "new_prev_month": len(new_prev_month),
        "churned_this_month": len(churned_this_month),
        "churned_prev_month": len(churned_prev_month),
        "churn_rate": round(len(churned_this_month) / max(len(active_subs), 1) * 100, 1),
        "expiring_soon": [
            {
                "hotel_id": s.hotel_id,
                "plan": s.plan_name,
                "end_date": s.end_date.isoformat() if s.end_date else None,
                "days_left": (s.end_date - now).days if s.end_date else None,
            }
            for s in expiring_soon
        ],
        "mrr_trend": mrr_trend,
    }
