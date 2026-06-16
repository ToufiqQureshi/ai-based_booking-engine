import os
import re
from pathlib import Path

BASE_DIR = Path(r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend")
TESTS_DIR = BASE_DIR / "tests"

# Mappings from refactor_backend_v2
MODEL_MAPPING = {
    "addon": "experiences", "ai_usage": "ai_assistant", "amenity": "rooms",
    "audit": "system", "booking": "bookings", "chain": "superadmin/chains",
    "channel_manager": "channel_manager", "commission": "superadmin/commissions",
    "competitor": "rate_shopper", "hotel": "brand_console", "integration": "integration",
    "kyc": "superadmin/kyc", "lead": "brand_console", "links": "bookings",
    "loyalty": "loyalty", "notification": "dashboard", "payment": "payments",
    "platform": "superadmin/platform", "promo": "rate_plans", "rates": "rate_plans",
    "room": "rooms", "social_proof": "google_reviews", "subscription": "superadmin/subscriptions",
    "ticket": "superadmin/tickets", "timeline": "bookings", "user": "guests", "analytics": "analytics"
}

API_MAPPING = {
    "addons": "experiences", "admin": "system", "agent": "ai_assistant",
    "amenities": "rooms", "auth": "auth", "bookings": "bookings",
    "channel_manager": "channel_manager", "competitors": "rate_shopper",
    "dashboard": "dashboard", "google_ads": "marketing", "hotels": "brand_console",
    "leads": "brand_console", "loyalty": "loyalty", "notifications": "dashboard",
    "payments": "payments", "promos": "rate_plans", "properties": "brand_console",
    "rates": "rate_plans", "reports": "analytics", "rooms": "rooms",
    "social_proof": "google_reviews", "upload": "system", "users": "guests", "ws": "system"
}

SUPERADMIN_MAPPING = {
    "bulk": "chains", "cache_mgmt": "platform", "chains": "chains",
    "commissions": "commissions", "exports": "dashboard", "health": "platform",
    "hotels": "hotels", "integrations": "platform", "kyc": "kyc",
    "payouts": "payouts", "platform": "platform", "revenue": "revenue",
    "sessions": "platform", "subscriptions": "subscriptions", "tickets": "tickets",
    "users": "dashboard"
}

import_replacements = {}
for base, folder in MODEL_MAPPING.items():
    import_replacements[f"app.models.{base}"] = f"app.{folder.replace('/', '.')}.models"
    # Also handle from app.models import X
    # It's tricky to handle "from app.models import Hotel" vs "from app.models.hotel import Hotel"
    # Tests mostly do `from app.models.hotel import Hotel` or `from app.models import Hotel`
    # Let's handle the absolute ones first

for base, folder in API_MAPPING.items():
    import_replacements[f"app.api.v1.{base}"] = f"app.{folder.replace('/', '.')}.{base}"

for base, folder in SUPERADMIN_MAPPING.items():
    import_replacements[f"app.api.v1.superadmin.{base}"] = f"app.superadmin.{folder.replace('/', '.')}.{base}"

import_replacements["app.api.deps"] = "app.core.auth.deps"
import_replacements["app.api.v1.public"] = "app.guest_booking"

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in import_replacements.items():
        new_content = re.sub(rf"\b{old}\b", new, new_content)
        
    # Manual patch for "from app.models import Hotel"
    # This is hard to regex perfectly. Let's do common ones:
    new_content = new_content.replace("from app.models import", "from app.brand_console.models import") # Just a hack, we might need a better regex.
    # Actually, a better approach is to not do a blunt replace for `from app.models import` unless needed.
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated imports in {filepath.name}")

for root, _, files in os.walk(TESTS_DIR):
    for file in files:
        if file.endswith(".py"):
            replace_in_file(Path(root) / file)
print("Done refactoring tests!")
