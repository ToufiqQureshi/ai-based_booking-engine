"""
Market analysis and rate comparison endpoints.
Compares our hotel's rates against all tracked competitors.
"""
import json
import logging
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc
from sqlmodel import select

from app.api.deps import CurrentUser, DbSession
from app.core.feature_flags import require_feature
from app.core.redis_client import redis_client
from app.models.competitor import Competitor, CompetitorRate
from app.models.room import RoomType

from .crud import check_rate_shopper_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])


class MarketAnalysisResult(BaseModel):
    date: str
    my_price: float
    lowest_market_price: float
    average_market_price: float
    highest_market_price: float
    market_position: str   # "Premium", "Budget", "Average", "Unknown"
    suggestion: str


@router.get("/analysis", response_model=List[MarketAnalysisResult], dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_market_analysis(
    current_user: CurrentUser,
    session: DbSession,
    days: int = 7,
    start_date: Optional[date] = None,
):
    """Analyze market rates for the next N days. Cached 1 hour."""
    check_rate_shopper_feature(current_user)
    today = start_date or date.today()

    cache_key = f"market_analysis:{current_user.hotel_id}:{today.isoformat()}"
    r = None
    try:
        r = redis_client.get_instance()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as cache_err:
        logger.warning("Redis cache read failed for %s: %s", cache_key, cache_err)

    end_date = today + timedelta(days=days)

    rt_res = await session.execute(
        select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    )
    room_type = rt_res.scalars().first()
    if not room_type:
        return []

    my_rates_map = {today + timedelta(days=i): room_type.base_price for i in range(days)}

    comp_ids_result = await session.execute(
        select(Competitor.id).where(Competitor.hotel_id == current_user.hotel_id)
    )
    comp_ids = comp_ids_result.scalars().all()

    rates_by_date: dict = {}
    if comp_ids:
        rate_query = (
            select(CompetitorRate)
            .where(
                CompetitorRate.competitor_id.in_(comp_ids),
                CompetitorRate.check_in_date >= today,
                CompetitorRate.check_in_date < end_date,
            )
            .order_by(
                CompetitorRate.competitor_id,
                CompetitorRate.check_in_date,
                desc(CompetitorRate.fetched_at),
            )
        )
        rates_res = await session.execute(rate_query)
        all_rates = rates_res.scalars().all()

        seen_keys: set = set()
        for rate in all_rates:
            key = (rate.competitor_id, rate.check_in_date)
            if key not in seen_keys:
                seen_keys.add(key)
                if not rate.is_sold_out and rate.price and rate.price > 0:
                    rates_by_date.setdefault(rate.check_in_date, []).append(rate.price)

    results = []
    for i in range(days):
        d = today + timedelta(days=i)
        my_price = my_rates_map.get(d, 0)
        market_prices = rates_by_date.get(d, [])

        if not market_prices:
            results.append({
                "date": d.isoformat(), "my_price": my_price,
                "lowest_market_price": 0, "average_market_price": 0,
                "highest_market_price": 0, "market_position": "Unknown",
                "suggestion": "No competitor data available. Please trigger a refresh to fetch latest rates.",
            })
            continue

        lowest = min(market_prices)
        highest = max(market_prices)
        avg = sum(market_prices) / len(market_prices)

        if my_price > avg * 1.1:
            position = "Premium"
            suggestion = "Price is significantly higher than market average. Consider lowering if occupancy is low."
        elif my_price < avg * 0.9:
            position = "Budget"
            suggestion = "Price is lower than market. Opportunity to increase rate."
        else:
            position = "Average"
            suggestion = "Price is competitive with market average."

        results.append({
            "date": d.isoformat(), "my_price": my_price,
            "lowest_market_price": lowest,
            "average_market_price": int(avg),
            "highest_market_price": highest,
            "market_position": position,
            "suggestion": suggestion,
        })

    if r:
        try:
            r.setex(cache_key, 3600, json.dumps(results))
        except Exception as cache_err:
            logger.warning("Redis cache write failed for %s: %s", cache_key, cache_err)

    return results


@router.get("/rates/comparison", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_rate_comparison(
    current_user: CurrentUser,
    session: DbSession,
    start_date: Optional[date] = None,
):
    """Chart data: My Rate vs Competitors for next 7 days. Cached 1 hour."""
    check_rate_shopper_feature(current_user)
    today = start_date or date.today()
    end_date = today + timedelta(days=7)

    cache_key = f"rate_comparison:{current_user.hotel_id}:{today.isoformat()}"
    r = None
    try:
        r = redis_client.get_instance()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as cache_err:
        logger.warning("Redis cache read failed for %s: %s", cache_key, cache_err)

    rt_res = await session.execute(
        select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    )
    room_type = rt_res.scalars().first()
    my_rates_map = {}
    if room_type:
        for i in range(7):
            my_rates_map[today + timedelta(days=i)] = room_type.base_price

    comp_res = await session.execute(
        select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    )
    competitors = comp_res.scalars().all()
    comp_ids = [c.id for c in competitors]

    rates_map: dict = {}
    if comp_ids:
        rate_query = (
            select(CompetitorRate)
            .where(
                CompetitorRate.competitor_id.in_(comp_ids),
                CompetitorRate.check_in_date >= today,
                CompetitorRate.check_in_date < end_date,
            )
            .order_by(desc(CompetitorRate.fetched_at))
        )
        rate_res = await session.execute(rate_query)
        for rate in rate_res.scalars().all():
            key = (rate.competitor_id, rate.check_in_date)
            if key not in rates_map:
                rates_map[key] = rate

    chart_data, table_data = [], []
    for i in range(7):
        d = today + timedelta(days=i)
        date_str = d.strftime("%d %b")

        day_chart = {"date": date_str, "My Hotel": my_rates_map.get(d, 0)}
        day_table = {
            "date": date_str,
            "full_date": d.isoformat(),
            "my_rate": {
                "price": my_rates_map.get(d, 0),
                "room_type": room_type.name if room_type else "Standard",
            },
            "competitors": {},
        }

        for comp in competitors:
            rate = rates_map.get((comp.id, d))
            if rate:
                day_chart[comp.name] = rate.price
                day_table["competitors"][comp.name] = {
                    "price": rate.price,
                    "room_type": rate.room_type,
                    "is_sold_out": rate.is_sold_out,
                    "source": comp.source,
                    "url": comp.url,
                }

        chart_data.append(day_chart)
        table_data.append(day_table)

    final_res = {
        "chart_data": chart_data,
        "table_data": table_data,
        "competitors": [c.name for c in competitors],
    }

    if r:
        try:
            r.setex(cache_key, 3600, json.dumps(final_res))
        except Exception as cache_err:
            logger.warning("Redis cache write failed for %s: %s", cache_key, cache_err)

    return final_res
