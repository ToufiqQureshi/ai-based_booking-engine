import requests
from bs4 import BeautifulSoup
import re
import time
import csv
import urllib.parse
import json
import os
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_param_from_url(url, param):
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query)
    val = params.get(param, [None])[0]
    if val:
        return urllib.parse.unquote(val)
    return ""

def update_url_dates(url, checkin_date, checkout_date):
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query)
    params['checkin'] = [checkin_date.strftime("%m%d%Y")]
    params['checkout'] = [checkout_date.strftime("%m%d%Y")]
    new_query = urllib.parse.urlencode(params, doseq=True)
    return urllib.parse.urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

def classify_meal_plan(meal_detail_code, filter_codes, plan_name):
    meal_detail_code = (meal_detail_code or "").upper()
    filter_codes = [c.upper() for c in (filter_codes or [])]
    plan_name = (plan_name or "").lower()
    
    if "RO" in meal_detail_code or "EP" in meal_detail_code or "ROOM_ONLY" in meal_detail_code:
        return "EP"
    if "CP" in meal_detail_code or "BB" in meal_detail_code:
        return "CP"
    if "MAP" in meal_detail_code:
        return "MAP"
    if "AP" in meal_detail_code:
        return "AP"
        
    if "ALL_MEAL_AVAIL" in filter_codes:
        return "AP"
    if "TWO_MEAL_AVAIL" in filter_codes:
        return "MAP"
    if "FREE_BREAKFAST" in filter_codes:
        return "CP"
        
    if "breakfast + lunch + dinner" in plan_name or "all meals" in plan_name:
        return "AP"
    if "breakfast + dinner" in plan_name or "breakfast + lunch" in plan_name or "half board" in plan_name or "two meal" in plan_name:
        return "MAP"
    if "breakfast" in plan_name:
        return "CP"
    if "room only" in plan_name or "no meal" in plan_name or "only room" in plan_name:
        return "EP"
        
    return "EP"

def extract_initial_state(html):
    start_marker = "window.__INITIAL_STATE__ ="
    start_idx = html.find(start_marker)
    if start_idx == -1:
        start_marker = "window.__INITIAL_STATE__="
        start_idx = html.find(start_marker)
        
    if start_idx != -1:
        json_start_idx = html.find("{", start_idx)
        if json_start_idx != -1:
            brace_count = 0
            json_end_idx = -1
            for idx in range(json_start_idx, len(html)):
                char = html[idx]
                if char == "{":
                    brace_count += 1
                elif char == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        json_end_idx = idx + 1
                        break
            if json_end_idx != -1:
                try:
                    return json.loads(html[json_start_idx:json_end_idx])
                except Exception:
                    pass
    return None

def scrape_single_hotel_date(target_url, auth_token, max_retries=5):
    """
    Scrapes MakeMyTrip for a specific hotel and date.
    Returns status and extracted rate plans.
    """
    API_URL = "https://scraper-api.decodo.com/v2/scrape"
    hotel_name = get_param_from_url(target_url, "searchText") or "Unknown Hotel"
    checkin = get_param_from_url(target_url, "checkin")
    
    # Format date nicely
    checkin_formatted = f"{checkin[:2]}-{checkin[2:4]}-{checkin[4:]}"
    
    payload = {
        "url": target_url,
        "target": "universal",
        "proxy_pool": "premium",
        "headless": "html",
        "geo": "India",
        "device_type": "desktop_chrome"
    }
    
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": auth_token
    }
    
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(API_URL, json=payload, headers=headers, timeout=120)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "failed":
                    if attempt < max_retries:
                        time.sleep(5)
                        continue
                    return {"hotel_name": hotel_name, "date": checkin_formatted, "status": "Failed", "error": data.get("message"), "rooms": []}
                
                if "results" in data and len(data["results"]) > 0:
                    html = data["results"][0]["content"]
                    
                    # 1. Check if Sold Out on page
                    soup = BeautifulSoup(html, "html.parser")
                    sold_out_el = soup.find(class_=re.compile("soldOutTxt"))
                    if sold_out_el or "You Just Missed It" in html:
                        return {"hotel_name": hotel_name, "date": checkin_formatted, "status": "Sold Out", "error": "", "rooms": []}
                    
                    # 2. Extract JSON State
                    state = extract_initial_state(html)
                    if not state:
                        if attempt < max_retries:
                            time.sleep(5)
                            continue
                        return {"hotel_name": hotel_name, "date": checkin_formatted, "status": "Failed", "error": "JSON state extraction failed", "rooms": []}
                    
                    hotel_detail = state.get("hotelDetail", {})
                    search_rooms = hotel_detail.get("searchRooms", {})
                    rooms_detail = search_rooms.get("exactRoomsDetail", [])
                    
                    if not rooms_detail:
                        # Sometimes empty rooms list also means sold out or dynamic filter block
                        return {"hotel_name": hotel_name, "date": checkin_formatted, "status": "Sold Out", "error": "", "rooms": []}
                    
                    parsed_rooms = []
                    for room in rooms_detail:
                        room_name = room.get("roomName")
                        rates = {"EP": None, "CP": None, "MAP": None, "AP": None}
                        
                        for plan in room.get("ratePlans", []):
                            plan_name = plan.get("name")
                            meal_detail_code = plan.get("mealDetailCode")
                            filter_codes = plan.get("filterCode", [])
                            
                            meal_type = classify_meal_plan(meal_detail_code, filter_codes, plan_name)
                            
                            price_details = plan.get("priceDetails", {})
                            price_breakup = price_details.get("priceBreakup", {})
                            
                            price_val = price_breakup.get("PRICE_AFTER_DISCOUNT") or price_breakup.get("TOTAL_AMOUNT")
                            taxes_val = price_breakup.get("TAXES") or 0
                            
                            if price_val:
                                total_val = price_val + taxes_val
                                # Store dict of values
                                if not rates[meal_type] or (price_val < rates[meal_type]["base"]):
                                    rates[meal_type] = {
                                        "base": price_val,
                                        "tax": taxes_val,
                                        "total": total_val
                                    }
                        
                        parsed_rooms.append({
                            "room_name": room_name,
                            "rates": rates
                        })
                        
                    return {
                        "hotel_name": hotel_name,
                        "date": checkin_formatted,
                        "status": "Available",
                        "error": "",
                        "rooms": parsed_rooms
                    }
            else:
                if attempt < max_retries:
                    time.sleep(5)
                    continue
        except Exception as e:
            if attempt < max_retries:
                time.sleep(5)
                continue
            return {"hotel_name": hotel_name, "date": checkin_formatted, "status": "Failed", "error": str(e), "rooms": []}
            
    return {"hotel_name": hotel_name, "date": checkin_formatted, "status": "Failed", "error": "Max retries reached", "rooms": []}

def run_rate_shopper(hotel_base_urls, auth_token, num_days=7, output_csv="scraped_hotel_matrix.csv"):
    import random
    today = datetime.today()
    tasks = []
    
    for i in range(num_days):
        checkin_date = today + timedelta(days=i)
        checkout_date = checkin_date + timedelta(days=1)
        for base_url in hotel_base_urls:
            dynamic_url = update_url_dates(base_url, checkin_date, checkout_date)
            tasks.append(dynamic_url)
            
    print(f"Starting Scraper for {len(hotel_base_urls)} hotels over {num_days} days ({len(tasks)} requests total)...", flush=True)
    print("Running sequentially with a 5-8 second delay between each request to avoid blocking.\n", flush=True)
    
    results = []
    for idx, url in enumerate(tasks):
        if idx > 0:
            delay = random.randint(5, 8)
            print(f"Waiting {delay} seconds before starting the next request...", flush=True)
            time.sleep(delay)
            
        res = scrape_single_hotel_date(url, auth_token)
        results.append(res)
        
        if res["status"] == "Available":
            print(f"[SUCCESS] {res['hotel_name']} | Date: {res['date']} | Status: Available ({len(res['rooms'])} room types)", flush=True)
        elif res["status"] == "Sold Out":
            print(f"[SOLD OUT] {res['hotel_name']} | Date: {res['date']}", flush=True)
        else:
            print(f"[FAILED] {res['hotel_name']} | Date: {res['date']} | Error: {res['error']}", flush=True)

    # Write results to CSV (Flattening rooms data into row per Room Type & Date)
    with open(output_csv, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = ["Hotel Name", "Date", "Status", "Room Type", "EP (Base)", "EP (Total)", "CP (Base)", "CP (Total)", "MAP (Base)", "MAP (Total)", "AP (Base)", "AP (Total)"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for r in results:
            if r["status"] == "Available" and r["rooms"]:
                for room in r["rooms"]:
                    rates = room["rates"]
                    row = {
                        "Hotel Name": r["hotel_name"],
                        "Date": r["date"],
                        "Status": r["status"],
                        "Room Type": room["room_name"],
                        "EP (Base)": rates["EP"]["base"] if rates["EP"] else "",
                        "EP (Total)": rates["EP"]["total"] if rates["EP"] else "",
                        "CP (Base)": rates["CP"]["base"] if rates["CP"] else "",
                        "CP (Total)": rates["CP"]["total"] if rates["CP"] else "",
                        "MAP (Base)": rates["MAP"]["base"] if rates["MAP"] else "",
                        "MAP (Total)": rates["MAP"]["total"] if rates["MAP"] else "",
                        "AP (Base)": rates["AP"]["base"] if rates["AP"] else "",
                        "AP (Total)": rates["AP"]["total"] if rates["AP"] else "",
                    }
                    writer.writerow(row)
            else:
                row = {
                    "Hotel Name": r["hotel_name"],
                    "Date": r["date"],
                    "Status": r["status"],
                    "Room Type": "",
                    "EP (Base)": "", "EP (Total)": "",
                    "CP (Base)": "", "CP (Total)": "",
                    "MAP (Base)": "", "MAP (Total)": "",
                    "AP (Base)": "", "AP (Total)": ""
                }
                writer.writerow(row)
                
    print(f"\nAll scraping complete. Results saved in: {output_csv}")

async def run_rate_shopper_for_hotel(hotel_id: str, num_days: int = 7):
    """
    Asynchronously runs the rate shopper scraper for a specific hotel,
    loading its configured competitors, executing MMT calls, and saving directly to DB.
    """
    import logging
    import asyncio
    from app.core.database import async_session
    from app.models.competitor import Competitor, CompetitorRate
    from sqlmodel import select
    from sqlalchemy import delete
    import random
    
    logger = logging.getLogger(__name__)
    
    # Auth token from previous integration (mocked / static key for Decodo API)
    auth_token = "Basic VTAwMDA0MzIyMjA6UFdfMTliMGU2OGVmMWI3ZWMzMTgyNDI2ZDkwYjg2NzMyYmQ1"
    
    async with async_session() as session:
        # Load active competitors
        stmt = select(Competitor).where(Competitor.hotel_id == hotel_id, Competitor.is_active == True)
        res = await session.execute(stmt)
        competitors = res.scalars().all()
        
        if not competitors:
            logger.warning(f"No active competitors configured for hotel {hotel_id}")
            return
            
        today_dt = datetime.today()
        start_date = today_dt.date()
        end_date = (today_dt + timedelta(days=num_days - 1)).date()
        
        for comp in competitors:
            logger.info(f"Starting scraping competitor {comp.name} ({comp.id}) for hotel {hotel_id}")
            comp.last_scrape_status = "Running"
            comp.scrape_started_at = datetime.utcnow()
            session.add(comp)
            await session.commit()
            
            try:
                # Clear existing rates in range for this competitor to avoid dupes
                del_stmt = delete(CompetitorRate).where(
                    CompetitorRate.competitor_id == comp.id,
                    CompetitorRate.check_in_date >= start_date,
                    CompetitorRate.check_in_date <= end_date
                )
                await session.execute(del_stmt)
                await session.commit()
                
                # Execute daily scrapes
                for i in range(num_days):
                    checkin_date = today_dt + timedelta(days=i)
                    checkout_date = checkin_date + timedelta(days=1)
                    
                    # Wait between calls to avoid block (2-4 seconds dynamically)
                    if i > 0:
                        await asyncio.sleep(random.randint(2, 4))
                        
                    dynamic_url = update_url_dates(comp.url, checkin_date, checkout_date)
                    
                    # Call synchronous scrape_single_hotel_date
                    res_data = scrape_single_hotel_date(dynamic_url, auth_token)
                    
                    # Save results to DB
                    if res_data["status"] == "Available" and res_data["rooms"]:
                        for room in res_data["rooms"]:
                            rates = room["rates"]
                            new_rate = CompetitorRate(
                                competitor_id=comp.id,
                                check_in_date=checkin_date.date(),
                                room_type=room["room_name"],
                                status="Available",
                                ep_base=rates["EP"]["base"] if rates["EP"] else None,
                                ep_total=rates["EP"]["total"] if rates["EP"] else None,
                                cp_base=rates["CP"]["base"] if rates["CP"] else None,
                                cp_total=rates["CP"]["total"] if rates["CP"] else None,
                                map_base=rates["MAP"]["base"] if rates["MAP"] else None,
                                map_total=rates["MAP"]["total"] if rates["MAP"] else None,
                                ap_base=rates["AP"]["base"] if rates["AP"] else None,
                                ap_total=rates["AP"]["total"] if rates["AP"] else None,
                            )
                            session.add(new_rate)
                    elif res_data["status"] == "Sold Out":
                        new_rate = CompetitorRate(
                            competitor_id=comp.id,
                            check_in_date=checkin_date.date(),
                            room_type="Standard Room",
                            status="Sold Out"
                        )
                        session.add(new_rate)
                    else:
                        # Failed date
                        logger.error(f"Failed to scrape date {checkin_date.date()} for competitor {comp.name}: {res_data.get('error')}")
                
                await session.commit()
                
                # Update competitor status
                comp.last_scrape_status = "Completed"
                comp.last_scraped_at = datetime.utcnow()
                comp.last_scrape_error = None
                
            except Exception as e:
                logger.exception(f"Scraper thread failed for competitor {comp.name}")
                comp.last_scrape_status = "Failed"
                comp.last_scrape_error = str(e)
                comp.last_scraped_at = datetime.utcnow()
                
            finally:
                session.add(comp)
                await session.commit()

if __name__ == "__main__":
    auth = "Basic VTAwMDA0MzIyMjA6UFdfMTliMGU2OGVmMWI3ZWMzMTgyNDI2ZDkwYjg2NzMyYmQ1"
    
    # Target hotels: Fariyas Resort with the new URL structure
    hotels = [
        "https://www.makemytrip.com/hotels/hotel-details/?hotelId=200701211419334358&_uCurrency=INR&checkin=06122026&checkout=06132026&city=CTXLK&country=IN&lat=18.7625&lng=73.39229&locusId=RGPNQ&locusType=region&rank=1&reference=hotel&rf=directSearch&roomStayQualifier=1e0e&rsc=1e1e0e&searchText=Fariyas+Resort&topHtlId=200701211419334358&type=hotel&viewType=PREMIUM&mtkeys=undefined&isPropSearch=T"
    ]
    
    # Run for 2 days as a quick verification test
    run_rate_shopper(hotels, auth, num_days=2)
