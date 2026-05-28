import os
import re

public_py = r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend\app\api\v1\public.py"
service_py = r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend\app\services\public_service.py"

with open(public_py, 'r', encoding='utf-8') as f:
    content = f.read()

# We want to extract search_public_rooms and create_public_booking

# 1. Extract search_public_rooms
match = re.search(r'(@router\.get\("/hotels/\{hotel_identifier\}/rooms"[^:]+:\n(?: {4}.*\n)*?)(?=@router)', content, re.MULTILINE)
search_rooms_block = match.group(1) if match else None

# 2. Extract create_public_booking
match2 = re.search(r'(@router\.post\("/bookings"[^:]+:\n(?: {4}.*\n)*?)(?=@router)', content, re.MULTILINE)
create_booking_block = match2.group(1) if match2 else None

if not search_rooms_block or not create_booking_block:
    print("Could not find the blocks.")
else:
    print(f"Found search rooms block, length: {len(search_rooms_block.splitlines())}")
    print(f"Found create booking block, length: {len(create_booking_block.splitlines())}")

