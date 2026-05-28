import os
import shutil

public_py = r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend\app\api\v1\public.py"
public_dir = r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend\app\api\v1\public"

if not os.path.exists(public_dir):
    os.makedirs(public_dir)

with open(public_py, 'r', encoding='utf-8') as f:
    lines = f.readlines()

imports_end = 128  # Line 128 is right before @router.get("/hotels/slug/{hotel_slug}")
imports_and_schemas = "".join(lines[:imports_end])

splits = {
    "hotels.py": lines[128:210], # 129 to 210
    "rooms.py": lines[210:586],  # 211 to 586
    "chat.py": lines[863:958],   # 864 to 958 
    "payments.py": lines[1183:], # 1184 to end (includes razorpay schemas and patch)
}

# 587 - 863 (create booking)
# 959 - 1183 (loyalty, cancel)
bookings_lines = lines[586:863] + lines[958:1183]
splits["bookings.py"] = bookings_lines

for filename, route_lines in splits.items():
    filepath = os.path.join(public_dir, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(imports_and_schemas)
        f.write("".join(route_lines))

init_content = """from fastapi import APIRouter

from .hotels import router as hotels_router
from .rooms import router as rooms_router
from .bookings import router as bookings_router
from .chat import router as chat_router
from .payments import router as payments_router

router = APIRouter()
router.include_router(hotels_router)
router.include_router(rooms_router)
router.include_router(bookings_router)
router.include_router(chat_router)
router.include_router(payments_router)
"""

with open(os.path.join(public_dir, "__init__.py"), 'w', encoding='utf-8') as f:
    f.write(init_content)

print("Split complete!")
