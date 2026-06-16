import os
import re
from pathlib import Path

BASE_DIR = Path(r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend")
APP_DIR = BASE_DIR / "app"

MODEL_MAPPING = {
    "addon": "experiences",
    "ai_usage": "ai_assistant",
    "amenity": "rooms",
    "audit": "system",
    "booking": "bookings",
    "chain": "superadmin/chains",
    "channel_manager": "channel_manager",
    "commission": "superadmin/commissions",
    "competitor": "rate_shopper",
    "hotel": "brand_console",
    "integration": "integration",
    "kyc": "superadmin/kyc",
    "lead": "brand_console",
    "links": "bookings",
    "loyalty": "loyalty",
    "notification": "dashboard",
    "payment": "payments",
    "platform": "superadmin/platform",
    "promo": "rate_plans",
    "rates": "rate_plans",
    "room": "rooms",
    "social_proof": "google_reviews",
    "subscription": "superadmin/subscriptions",
    "ticket": "superadmin/tickets",
    "timeline": "bookings",
    "user": "guests"
}

API_MAPPING = {
    "addons": "experiences",
    "admin": "system",
    "agent": "ai_assistant",
    "amenities": "rooms",
    "auth": "auth",
    "bookings": "bookings",
    "channel_manager": "channel_manager",
    "competitors": "rate_shopper",
    "dashboard": "dashboard",
    "google_ads": "marketing",
    "hotels": "brand_console",
    "leads": "brand_console",
    "loyalty": "loyalty",
    "notifications": "dashboard",
    "payments": "payments",
    "promos": "rate_plans",
    "properties": "brand_console",
    "rates": "rate_plans",
    "reports": "analytics",
    "rooms": "rooms",
    "social_proof": "google_reviews",
    "upload": "system",
    "users": "guests",
    "ws": "system",
    "deps": "core" # deps.py was moved to core/deps.py maybe? Wait! No, let's assume it was moved to core.
}

SUPERADMIN_MAPPING = {
    "bulk": "chains",
    "cache_mgmt": "platform",
    "chains": "chains",
    "commissions": "commissions",
    "exports": "dashboard",
    "health": "platform",
    "hotels": "hotels",
    "integrations": "platform",
    "kyc": "kyc",
    "payouts": "payouts",
    "platform": "platform",
    "revenue": "revenue",
    "sessions": "platform",
    "subscriptions": "subscriptions",
    "tickets": "tickets",
    "users": "dashboard"
}

import_replacements = {}

for base, folder in MODEL_MAPPING.items():
    import_replacements[f"app.models.{base}"] = f"app.{folder.replace('/', '.')}.{base}"
    import_replacements[f"from app.models import {base}"] = f"from app.{folder.replace('/', '.')} import {base}"

for base, folder in API_MAPPING.items():
    import_replacements[f"app.api.v1.{base}"] = f"app.{folder.replace('/', '.')}.{base}"

for base, folder in SUPERADMIN_MAPPING.items():
    import_replacements[f"app.api.v1.superadmin.{base}"] = f"app.superadmin.{folder.replace('/', '.')}.{base}"

# Additional custom mappings
import_replacements["app.features.analytics.routers"] = "app.analytics.reports"
import_replacements["app.social_proof"] = "app.google_reviews.social_proof"
import_replacements["app.chain"] = "app.superadmin.chains"
import_replacements["app.api.deps"] = "app.core.auth.deps"
import_replacements["app.api.v1.availability"] = "app.calendar.availability"


def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in import_replacements.items():
        new_content = re.sub(rf"\b{old}\b", new, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated imports in {filepath.name}")

for root, _, files in os.walk(APP_DIR):
    for file in files:
        if file.endswith(".py"):
            replace_in_file(Path(root) / file)

print("Imports refactored.")
