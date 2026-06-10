from datetime import date, datetime, timedelta
from app.models.booking import BookingStatus

_COUNTRY_CODES: dict[str, str] = {
    "India": "IN", "United States": "US", "United Kingdom": "GB",
    "Germany": "DE", "France": "FR", "Australia": "AU", "Canada": "CA",
    "Singapore": "SG", "UAE": "AE", "United Arab Emirates": "AE",
    "Japan": "JP", "China": "CN", "Russia": "RU", "Brazil": "BR",
    "Italy": "IT", "Spain": "ES", "Netherlands": "NL", "Thailand": "TH",
    "Malaysia": "MY", "Indonesia": "ID", "Philippines": "PH",
    "Bangladesh": "BD", "Pakistan": "PK", "Nepal": "NP", "Sri Lanka": "LK",
    "South Africa": "ZA", "Kenya": "KE", "Nigeria": "NG",
    "Mexico": "MX", "Argentina": "AR", "Colombia": "CO",
}

def _nights(b) -> int:
    try:
        return max(1, (b.check_out - b.check_in).days)
    except Exception:
        return 1

def calculate_performance_metrics(performance_bookings, total_inventory, days, start_date, end_date):
    stayed_room_nights = 0
    stayed_revenue = 0.0
    for b in performance_bookings:
        overlap_start = max(start_date, b.check_in)
        overlap_end = min(end_date, b.check_out)
        overlap_days = max(0, (overlap_end - overlap_start).days)

        num_rooms = len(b.rooms or [])
        stayed_room_nights += num_rooms * overlap_days

        total_nights = _nights(b)
        revenue_per_night = float(b.total_amount or 0) / total_nights
        stayed_revenue += revenue_per_night * overlap_days

    total_available = total_inventory * days
    avg_daily_rate = round(stayed_revenue / stayed_room_nights, 2) if stayed_room_nights else 0
    rev_par = round(stayed_revenue / total_available, 2) if total_available else 0
    occupancy_rate = round(min(100.0, stayed_room_nights / total_available * 100), 2) if total_available else 0

    return avg_daily_rate, rev_par, occupancy_rate

def get_hotel_timezone(hotel_settings: dict) -> str:
    return (hotel_settings or {}).get("timezone", "Asia/Kolkata")
