from typing import List, Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks, Query
from sqlmodel import select, desc, func
from sqlalchemy import tuple_
from datetime import date, timedelta, datetime
import json
import logging
from pydantic import BaseModel

from app.api.deps import CurrentUser, DbSession
from app.core.feature_flags import require_feature
from app.models.competitor import Competitor, CompetitorRate, CompetitorSource
from app.models.hotel import Hotel
from app.models.room import RoomType
from app.models.rates import RoomRate
from app.core.redis_client import redis_client
from app.core.database import async_session
from app.core.config import get_settings
from app.schemas.rate_ingest import RateIngestRequest
import os
import re
import random
import requests
import asyncio
from scrapling import Selector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/competitors", tags=["Competitor Rates"])

def check_rate_shopper_feature(current_user: CurrentUser):
    if not current_user.hotel or not getattr(current_user.hotel, "feature_rate_shopper", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rate Shopper feature is not enabled for your subscription plan"
        )

@router.get("", response_model=List[Competitor])
async def list_competitors(current_user: CurrentUser, session: DbSession):
    """List all competitors for current hotel"""
    check_rate_shopper_feature(current_user)
    query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("", response_model=Competitor)
async def add_competitor(comp_data: Competitor, current_user: CurrentUser, session: DbSession, background_tasks: BackgroundTasks):
    """Add a new competitor to track"""
    check_rate_shopper_feature(current_user)
    # Force hotel_id
    comp_data.hotel_id = current_user.hotel_id
    
    # Check for duplicates (URL or Name)
    existing = await session.execute(
        select(Competitor).where(
            Competitor.hotel_id == current_user.hotel_id,
            (Competitor.url == comp_data.url) | (Competitor.name == comp_data.name)
        )
    )
    existing_comp = existing.scalars().first()
    
    if existing_comp:
        return existing_comp

    session.add(comp_data)
    await session.commit()
    await session.refresh(comp_data)
    
    return comp_data

@router.post("/{comp_id}/scrape", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def trigger_scrape(comp_id: str, current_user: CurrentUser, session: DbSession, background_tasks: BackgroundTasks):
    """Manually trigger a scrape"""
    check_rate_shopper_feature(current_user)
    
    # Fetch competitor and verify ownership
    comp = await session.get(Competitor, comp_id)
    if not comp or comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=404, detail="Competitor not found")
        
    settings = get_settings()
    if not settings.DECODO_AUTH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decodo Scraper API key (DECODO_AUTH_TOKEN) is not configured in environment variables."
        )

    # Set status to running
    comp.last_scrape_status = "running"
    comp.last_scrape_error = None
    session.add(comp)
    await session.commit()
    
    background_tasks.add_task(run_background_scrape, comp_id)
    return {"message": "Scrape started in background"}

# Decodo Scraper API Configuration
DECODO_URL = "https://scraper-api.decodo.com/v2/scrape"
DECODO_AUTH_TOKEN = get_settings().DECODO_AUTH_TOKEN or "Basic VTAwMDA0MjYwNTU6UFdfMTg0MjdiMzk3MmU3N2EzNWVlZWM3OGQ2ODhkZmIwY2Yw"

def get_dynamic_dates(offset):
    today = datetime.now()
    checkin = (today + timedelta(days=offset)).strftime("%m%d%Y")
    checkout = (today + timedelta(days=offset + 1)).strftime("%m%d%Y")
    return checkin, checkout

def update_url_dates(url, offset):
    checkin, checkout = get_dynamic_dates(offset)
    url = re.sub(r"checkin=\d{8}", f"checkin={checkin}", url)
    url = re.sub(r"checkout=\d{8}", f"checkout={checkout}", url)
    return url

async def scrape_mmt_hotel_rate(url: str) -> dict:
    """Performs extraction by fetching HTML via Decodo Scraper API and parsing it with Scrapling Selector."""
    try:
        logger.info(f"Fetching Hotel URL via Decodo API: {url[:60]}...")
        
        payload = {
            "url": url,
            "proxy_pool": "premium",
            "headless": "html",
            "geo": "in",
            "device_type": "desktop_chrome"
        }
        
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "authorization": DECODO_AUTH_TOKEN
        }
        
        # Since requests is synchronous, run in executor to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(DECODO_URL, json=payload, headers=headers, timeout=60)
        )
        
        if response.status_code != 200:
            logger.error(f"Decodo API returned status code {response.status_code}: {response.text[:200]}")
            return {"status": "failed", "reason": f"API_status_{response.status_code}"}
            
        res_json = response.json()
        if not res_json.get("results") or len(res_json["results"]) == 0:
            logger.error("Decodo API response doesn't contain results key or results list is empty")
            return {"status": "failed", "reason": "empty_api_results"}
            
        first_result = res_json["results"][0]
        html_content = first_result.get("content", "")
        
        # Check for blocking
        if "access denied" in html_content.lower() or "access-denied" in html_content.lower() or "reference id" in html_content.lower():
            logger.error("Blocked by Akamai (Access Denied / Reference ID)")
            return {"status": "blocked", "reason": "shield_blocked"}
            
        page = Selector(html_content)
        
        # Check if sold out
        sold_out_check = page.css("p.font14.appendBottom5.redText.latoBold.lineHight17").first
        if sold_out_check and "You Just Missed It" in sold_out_check.text:
            return {"status": "success", "price": 0.0, "is_sold_out": True}
            
        price_el = page.css('p.priceText.latoBlack.font22.blackText.appendBottom5[id="hlistpg_hotel_shown_price"]').first
        if not price_el:
            price_el = page.css('#hlistpg_hotel_shown_price').first
            
        if not price_el:
            logger.warning("Scrape finished but Hotel Price element could not be found.")
            return {"status": "failed", "reason": "price_element_not_found"}
            
        price_text = price_el.text.strip()
        price_digits = re.sub(r"[^\d]", "", price_text)
        if not price_digits:
            logger.warning(f"Could not parse price digits from raw text: {price_text}")
            return {"status": "failed", "reason": "price_parse_failed"}
            
        price = float(price_digits)
        return {"status": "success", "price": price, "is_sold_out": False}
        
    except Exception as e:
        logger.error(f"Scraper error: {e}")
        return {"status": "failed", "reason": str(e)}

async def run_background_scrape(comp_id: str):
    """
    Run competitor rate scraping in the background using Decodo API + Scrapling.
    Scrapes the next 7 days of rates.
    """
    logger.info(f"Starting Background Scrape for competitor ID: {comp_id}")
    
    try:
        async with async_session() as session:
            comp = await session.get(Competitor, comp_id)
            if not comp:
                logger.error(f"Competitor {comp_id} not found for background scrape")
                return
                
            comp.last_scrape_status = "running"
            comp.last_scrape_error = None
            session.add(comp)
            await session.commit()
            
            url = comp.url
            is_mmt = comp.source == CompetitorSource.MAKEMYTRIP or "makemytrip.com" in url.lower()
            
            if not is_mmt:
                comp.last_scrape_status = "failed"
                comp.last_scrape_error = f"Background scrape only supported for MakeMyTrip. Competitor source is {comp.source}."
                session.add(comp)
                await session.commit()
                logger.warning(f"Background scrape only supported for MakeMyTrip. Competitor source: {comp.source}")
                return
                
            logger.info(f"Scraping MakeMyTrip URL for competitor: {comp.name} ({comp_id})")
            
            has_errors = False
            last_error_reason = None
            
            # Scrape next 7 days
            for offset in range(7):
                check_in_date_obj = date.today() + timedelta(days=offset)
                updated_url = update_url_dates(url, offset)
                
                # Sleep a random delay to avoid rate limiting
                await asyncio.sleep(random.uniform(2, 4))
                
                # Scrape rate
                rate_data = await scrape_mmt_hotel_rate(updated_url)
                
                if rate_data["status"] == "success":
                    price = rate_data["price"]
                    is_sold_out = rate_data["is_sold_out"]
                    
                    # Check if rate already exists for this competitor and date
                    stmt = select(CompetitorRate).where(
                        CompetitorRate.competitor_id == comp_id,
                        CompetitorRate.check_in_date == check_in_date_obj
                    )
                    res = await session.execute(stmt)
                    existing_rate = res.scalar_one_or_none()
                    
                    if existing_rate:
                        existing_rate.price = price
                        existing_rate.is_sold_out = is_sold_out
                        existing_rate.fetched_at = datetime.utcnow()
                        session.add(existing_rate)
                    else:
                        new_rate = CompetitorRate(
                            competitor_id=comp_id,
                            check_in_date=check_in_date_obj,
                            price=price,
                            is_sold_out=is_sold_out,
                            fetched_at=datetime.utcnow()
                        )
                        session.add(new_rate)
                    
                    await session.commit()
                    logger.info(f"Ingested rate for {comp.name} on {check_in_date_obj.isoformat()}: {price} (Sold out: {is_sold_out})")
                    
                    # Clear cache immediately on every iteration so frontend sees updates as they happen
                    try:
                        r = redis_client.get_instance()
                        if r:
                            keys_to_delete = r.keys(f"rate_comparison:{comp.hotel_id}:*") + r.keys(f"market_analysis:{comp.hotel_id}:*")
                            if keys_to_delete:
                                r.delete(*keys_to_delete)
                    except Exception as cache_err:
                        logger.warning(f"Failed to clear competitor cache: {cache_err}")
                else:
                    has_errors = True
                    last_error_reason = rate_data.get("reason", "Unknown scraping failure")
                    logger.warning(f"Failed to scrape rate for {comp.name} on {check_in_date_obj.isoformat()}: {last_error_reason}")
            
            # Update final status
            comp = await session.get(Competitor, comp_id)
            if comp:
                if has_errors:
                    comp.last_scrape_status = "failed"
                    comp.last_scrape_error = f"Scraping encountered errors on some dates: {last_error_reason}"
                else:
                    comp.last_scrape_status = "success"
                    comp.last_scrape_error = None
                    comp.last_scraped_at = datetime.utcnow()
                session.add(comp)
                await session.commit()
                
    except Exception as e:
        logger.error(f"Background Scrape CRASHED for {comp_id}: {e}")
        try:
            async with async_session() as session:
                comp = await session.get(Competitor, comp_id)
                if comp:
                    comp.last_scrape_status = "failed"
                    comp.last_scrape_error = f"Internal system crash: {str(e)}"
                    session.add(comp)
                    await session.commit()
        except Exception as db_err:
            logger.error(f"Failed to record crash status in database: {db_err}")

@router.delete("/{comp_id}")
async def delete_competitor(comp_id: str, current_user: CurrentUser, session: DbSession):
    """Delete a competitor and all their rate history"""
    check_rate_shopper_feature(current_user)
    comp = await session.get(Competitor, comp_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
        
    if comp.hotel_id != current_user.hotel_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Delete rates explicitly first (if cascade not set, safe bet)
    rates_stmt = select(CompetitorRate).where(CompetitorRate.competitor_id == comp_id)
    rates_res = await session.execute(rates_stmt)
    rates = rates_res.scalars().all()
    for r in rates:
        await session.delete(r)
        
    await session.delete(comp)
    await session.commit()
    
    return {"message": "Competitor deleted successfully"}

# --- Market Analysis ---

class MarketAnalysisResult(BaseModel):
    date: str
    my_price: float
    lowest_market_price: float
    average_market_price: float
    highest_market_price: float
    market_position: str # "Premium", "Budget", "Average"
    suggestion: str

@router.get("/analysis", response_model=List[MarketAnalysisResult], dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_market_analysis(
    current_user: CurrentUser,
    session: DbSession,
    days: int = 7,
    start_date: date = None
):
    check_rate_shopper_feature(current_user)
    """
    Analyzes market rates for the next N days.
    Optimized: 15s -> <500ms using Redis + Efficient Queries
    """
    today = start_date if start_date else date.today()

    # 1. Check Redis Cache (Market Analysis is heavy, cache for 1 hour)
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

    # 1. Fetch My Rates (First Room Type)
    rt_query = select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    rt_res = await session.execute(rt_query)
    room_type = rt_res.scalars().first()

    if not room_type:
        return []

    # Get my rates map
    my_rates_map = {}
    base_price = room_type.base_price
    # Default to base price
    for i in range(days):
        d = today + timedelta(days=i)
        my_rates_map[d] = base_price

    # 2. Fetch Competitor Rates efficiently (Use Index!)
    # Instead of fetching ALL rates and filtering in Python, fetch only needed range
    # And crucially, we need the LATEST fetch only.

    comp_ids_result = await session.execute(select(Competitor.id).where(Competitor.hotel_id == current_user.hotel_id))
    comp_ids = comp_ids_result.scalars().all()
    
    rates_by_date = {}

    if comp_ids:
        # Optimized Query: Fetch only rates in range, ordered by fetch time DESC
        # We rely on Python to pick the first one (latest) per (comp, date) pair
        # This is faster than complex SQL subqueries for small N (days=7)
        rate_query = select(CompetitorRate).where(
            CompetitorRate.competitor_id.in_(comp_ids),
            CompetitorRate.check_in_date >= today,
            CompetitorRate.check_in_date < end_date
        ).order_by(
            CompetitorRate.competitor_id,
            CompetitorRate.check_in_date,
            desc(CompetitorRate.fetched_at)
        )

        rates_res = await session.execute(rate_query)
        all_rates = rates_res.scalars().all()

        # Group by date - Keeping only the FIRST encountered (which is Latest due to DESC sort)
        seen_keys = set()

        for r in all_rates:
            key = (r.competitor_id, r.check_in_date)
            if key not in seen_keys:
                seen_keys.add(key)
                if r.check_in_date not in rates_by_date:
                    rates_by_date[r.check_in_date] = []
                rates_by_date[r.check_in_date].append(r.price)

    # 3. Analyze
    results = []
    for i in range(days):
        d = today + timedelta(days=i)
        my_price = my_rates_map.get(d, 0)
        market_prices = rates_by_date.get(d, [])

        if not market_prices:
            # No data
            results.append({
                "date": d.isoformat(),
                "my_price": my_price,
                "lowest_market_price": 0,
                "average_market_price": 0,
                "highest_market_price": 0,
                "market_position": "Unknown",
                "suggestion": "No competitor data available. Please trigger a refresh to fetch latest rates."
            })
            continue

        lowest = min(market_prices)
        highest = max(market_prices)
        avg = sum(market_prices) / len(market_prices)

        # Position Logic
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
            "date": d.isoformat(),
            "my_price": my_price,
            "lowest_market_price": lowest,
            "average_market_price": int(avg),
            "highest_market_price": highest,
            "market_position": position,
            "suggestion": suggestion
        })

    # Cache for 1 Hour
    if r:
        try:
            r.setex(cache_key, 3600, json.dumps(results))
        except Exception as cache_err:
            logger.warning("Redis cache write failed for %s: %s", cache_key, cache_err)

    return results


@router.get("/rates/comparison", dependencies=[Depends(require_feature("feature_rate_shopper"))])
async def get_rate_comparison(current_user: CurrentUser, session: DbSession, start_date: date = None):
    check_rate_shopper_feature(current_user)
    """
    Get data for chart: My Rate vs Competitors for next 7 days.
    """
    today = start_date if start_date else date.today()
    end_date = today + timedelta(days=7)
    
    # Cache Check
    cache_key = f"rate_comparison:{current_user.hotel_id}:{today.isoformat()}"
    r = None
    try:
        r = redis_client.get_instance()
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as cache_err:
        logger.warning("Redis cache read failed for %s: %s", cache_key, cache_err)

    # 1. Fetch My Rates
    rt_query = select(RoomType).where(RoomType.hotel_id == current_user.hotel_id)
    rt_res = await session.execute(rt_query)
    room_type = rt_res.scalars().first()
    
    my_rates_map = {}
    if room_type:
        base_price = room_type.base_price
        for i in range(7):
            d = today + timedelta(days=i)
            my_rates_map[d] = base_price
            
    # 2. Fetch Competitor Rates
    comp_query = select(Competitor).where(Competitor.hotel_id == current_user.hotel_id)
    comp_res = await session.execute(comp_query)
    competitors = comp_res.scalars().all()
    
    # 3. Bulk Fetch Competitor Rates (Optimization)
    comp_ids = [c.id for c in competitors]
    rates_map = {} # (competitor_id, check_in_date) -> RateObj
    
    if comp_ids:
        # Fetch all rates for these competitors in the date range in ONE query
        rate_query = select(CompetitorRate).where(
            CompetitorRate.competitor_id.in_(comp_ids),
            CompetitorRate.check_in_date >= today,
            CompetitorRate.check_in_date < end_date
        ).order_by(desc(CompetitorRate.fetched_at)) # Latest first

        rate_res = await session.execute(rate_query)
        all_rates = rate_res.scalars().all()

        # Populate map (since ordered by fetched_at desc, first encounter is latest)
        for r in all_rates:
            key = (r.competitor_id, r.check_in_date)
            if key not in rates_map:
                rates_map[key] = r

    # 4. Build Response Data (Iterate 7 days)
    chart_data = [] 
    table_data = []
    
    for i in range(7):
        d = today + timedelta(days=i)
        date_str = d.strftime("%d %b")
        
        # Initialize Day Chart
        day_chart = {
            "date": date_str,
            "My Hotel": my_rates_map.get(d, 0)
        }
        
        # Initialize Day Table
        day_table = {
            "date": date_str,
            "full_date": d.isoformat(),
            "my_rate": {
                "price": my_rates_map.get(d, 0),
                "room_type": room_type.name if room_type else "Standard" 
            },
            "competitors": {}
        }
        
        # Fill Competitor Data for this day
        for comp in competitors:
            # O(1) Lookup from memory
            rate = rates_map.get((comp.id, d))
            
            if rate:
                day_chart[comp.name] = rate.price
                day_table["competitors"][comp.name] = {
                    "price": rate.price,
                    "room_type": rate.room_type,
                    "is_sold_out": rate.is_sold_out,
                    "source": comp.source,
                    "url": comp.url
                }
        
        # Append to Main Lists
        chart_data.append(day_chart)
        table_data.append(day_table)
        
    final_res = {
        "chart_data": chart_data,
        "table_data": table_data,
        "competitors": [c.name for c in competitors]
    }

    # Cache for 1 Hour
    if r:
        try:
            r.setex(cache_key, 3600, json.dumps(final_res))
        except Exception as cache_err:
            logger.warning("Redis cache write failed for %s: %s", cache_key, cache_err)

    return final_res

from redis.exceptions import LockError

@router.post("/rates/ingest", response_model=dict)
async def ingest_competitor_rates(
    payload: RateIngestRequest,
    session: DbSession,
    current_user: CurrentUser
):
    check_rate_shopper_feature(current_user)
    """
    Ingest rates from Chrome Extension (Authenticated).
    """
    if not payload.rates:
        return {"message": "No rates provided", "status": "warning"}

    comp_ids = {item.competitor_id for item in payload.rates}
    
    comp_query = select(Competitor.id).where(
        Competitor.id.in_(comp_ids),
        Competitor.hotel_id == current_user.hotel_id
    )
    valid_comp_ids = (await session.execute(comp_query)).scalars().all()
    valid_comp_ids = set(valid_comp_ids)

    if not valid_comp_ids:
        return {"message": "No valid competitors found for this user", "status": "warning"}

    valid_rates_payload = [r for r in payload.rates if r.competitor_id in valid_comp_ids]

    if not valid_rates_payload:
         return {"message": "No valid rates to ingest", "status": "warning"}

    keys = [(r.competitor_id, r.check_in_date) for r in valid_rates_payload]

    # Acquire distributed lock to prevent race conditions during concurrent ingestion
    lock_name = f"lock:rates_ingest:{current_user.hotel_id}"
    r_client = redis_client.get_instance()

    if r_client:
        lock = r_client.lock(lock_name, timeout=10, blocking_timeout=3)
        try:
            acquired = lock.acquire()
            if not acquired:
                return {"message": "System busy ingesting rates, please retry later.", "status": "warning"}
        except Exception as e:
            logger.warning(f"Failed to acquire redis lock: {e}")
            lock = None
    else:
        lock = None

    try:
        existing_rates_query = select(CompetitorRate).where(
            tuple_(CompetitorRate.competitor_id, CompetitorRate.check_in_date).in_(keys)
        )
        existing_rates_result = await session.execute(existing_rates_query)
        existing_rates = existing_rates_result.scalars().all()

        existing_map = {(r.competitor_id, r.check_in_date): r for r in existing_rates}

        count_new = 0
        count_update = 0

        for item in valid_rates_payload:
            key = (item.competitor_id, item.check_in_date)
            
            if key in existing_map:
                rate_obj = existing_map[key]
                rate_obj.price = item.price
                rate_obj.is_sold_out = item.is_sold_out
                rate_obj.room_type = item.room_type
                rate_obj.fetched_at = datetime.utcnow()
                session.add(rate_obj)
                count_update += 1
            else:
                new_rate = CompetitorRate(
                    competitor_id=item.competitor_id,
                    check_in_date=item.check_in_date,
                    price=item.price,
                    is_sold_out=item.is_sold_out,
                    room_type=item.room_type,
                    currency=item.currency,
                    fetched_at=datetime.utcnow()
                )
                session.add(new_rate)
                count_new += 1

        await session.commit()
    finally:
        if lock:
            try:
                lock.release()
            except Exception:
                pass

    # --- Redis Write-Through (Performance) ---
    try:
        r = redis_client.get_instance()
        pipe = r.pipeline()
        for item in valid_rates_payload:
            key = f"rate:{item.competitor_id}:{item.check_in_date.isoformat()}"
            pipe.setex(key, 86400, "1") # 24h Expiry

            # Invalidate Market Analysis Cache immediately
            # Because rate changed, analysis might change
            cache_key_analysis = f"market_analysis:{current_user.hotel_id}:{item.check_in_date.isoformat()}"
            pipe.delete(cache_key_analysis)

        pipe.execute()
    except Exception as e:
         logger.warning(f"Redis Write Failed (Ignored): {e}")

    return {
        "message": f"Processed {len(valid_rates_payload)} rates (New: {count_new}, Updated: {count_update})",
        "status": "success"
    }

class ScrapeJobItem(BaseModel):
    competitor_id: str
    check_in_date: date

class CheckFreshnessResponse(BaseModel):
    jobs_to_scrape: List[ScrapeJobItem]
    cached_count: int

@router.post("/check_freshness", response_model=CheckFreshnessResponse)
async def check_scrape_freshness(jobs: List[ScrapeJobItem], current_user: CurrentUser, session: DbSession):
    """
    Check if rates already exist in PostgreSQL (Supabase) instead of Redis.
    """
    # SECURITY (TEN-03): authenticate and scope to the caller's own competitors.
    # Previously anonymous + unscoped, which let anyone probe another tenant's
    # rate-shopping activity by guessing competitor ids.
    requested_ids = {job.competitor_id for job in jobs}
    if requested_ids:
        owned = (await session.execute(
            select(Competitor.id).where(
                Competitor.id.in_(requested_ids),
                Competitor.hotel_id == current_user.hotel_id,
            )
        )).scalars().all()
        owned_ids = set(owned)
        jobs = [j for j in jobs if j.competitor_id in owned_ids]

    to_scrape = []
    cached_hits = 0
    
    # 1. Fast Path: Check Redis
    redis_misses = [] # List of jobs not found in Redis
    try:
        r = redis_client.get_instance()
        pipe = r.pipeline()
        for job in jobs:
            key = f"rate:{job.competitor_id}:{job.check_in_date.isoformat()}"
            pipe.exists(key)
        results = pipe.execute()
        
        for i, exists in enumerate(results):
            if exists:
                cached_hits += 1
            else:
                redis_misses.append(jobs[i])
    except Exception as e:
        logger.warning(f"Redis Check Failed: {e}")
        redis_misses = jobs # Fallback to DB check for all if Redis fails
    
    if not redis_misses:
        return {"jobs_to_scrape": [], "cached_count": cached_hits}

    # 2. Slow Path: Check DB for Redis Misses
    comp_ids = {job.competitor_id for job in redis_misses}
    dates = {job.check_in_date for job in redis_misses}
    
    query = select(CompetitorRate.competitor_id, CompetitorRate.check_in_date).where(
        CompetitorRate.competitor_id.in_(comp_ids),
        CompetitorRate.check_in_date.in_(dates),
        CompetitorRate.fetched_at >= datetime.utcnow() - timedelta(hours=24)
    )
    
    res = await session.execute(query)
    existing = set(res.all())
    
    # 3. Populate Redis for DB Hits (Read-Repair)
    if existing:
        try:
            r = redis_client.get_instance()
            pipe = r.pipeline()
            for cid, cdate in existing:
                key = f"rate:{cid}:{cdate.isoformat()}"
                pipe.setex(key, 86400, "1")
            pipe.execute()
        except Exception as cache_err:
            logger.warning("Redis pipeline mark-existing failed: %s", cache_err)

    for job in redis_misses:
        if (job.competitor_id, job.check_in_date) in existing:
            cached_hits += 1
        else:
            to_scrape.append(job)
                
    return {"jobs_to_scrape": to_scrape, "cached_count": cached_hits}
