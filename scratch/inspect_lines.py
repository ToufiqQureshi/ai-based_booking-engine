import re

filepath = r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend\src\pages\superadmin\SuperAdminDashboard.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's inspect the lines around 962
lines = content.splitlines(keepends=True)
for i in range(955, 970):
    if i < len(lines):
        print(f"{i+1}: {repr(lines[i])}")
