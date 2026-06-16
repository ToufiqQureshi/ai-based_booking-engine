import os
import subprocess
from pathlib import Path
import re
import shutil

FRONTEND_DIR = Path(r"d:\booking engine\ai-based-booking-engine-for-hotels-\frontend")

fixes = [
    ("src/core/api/api", "src/core/api"),
    ("src/core/contexts/contexts", "src/core/contexts"),
    ("src/core/hooks/hooks", "src/core/hooks"),
    ("src/core/lib/lib", "src/core/lib"),
    ("src/core/utils/utils", "src/core/utils"),
    ("src/core/types/types", "src/core/types"),
    ("src/superadmin/components/superadmin", "src/superadmin/components"),
    ("src/rooms/components/rooms", "src/rooms/components"),
    ("src/bookings/components/bookings", "src/bookings/components"),
    ("src/dashboard/components/dashboard", "src/dashboard/components"),
    ("src/guest_booking/components/public/public", "src/guest_booking/components/public"),
    ("src/settings/components/integration/integration", "src/settings/components/integration"),
    ("src/marketing/components/addons/addons", "src/marketing/components/addons"),
    ("src/finance/components/payments/payments", "src/finance/components/payments"),
    ("src/finance/components/rates/rates", "src/finance/components/rates"),
    ("src/dashboard/components/notifications/notifications", "src/dashboard/components/notifications"),
    ("src/guest_booking/components/support/support", "src/guest_booking/components/support"),
]

for src_str, dst_str in fixes:
    src_dir = FRONTEND_DIR / src_str
    dst_dir = FRONTEND_DIR / dst_str
    if src_dir.exists():
        for item in os.listdir(src_dir):
            item_path = src_dir / item
            dst_item_path = dst_dir / item
            subprocess.run(["git", "mv", str(item_path), str(dst_item_path)], cwd=FRONTEND_DIR)
        shutil.rmtree(src_dir)

# Now we need to fix the imports in the code that were double nested
# For example, import { ... } from '@/core/api/api/client' -> '@/core/api/client'

import_fixes = [
    ("@/core/api/api/", "@/core/api/"),
    ("@/core/contexts/contexts/", "@/core/contexts/"),
    ("@/core/hooks/hooks/", "@/core/hooks/"),
    ("@/core/lib/lib/", "@/core/lib/"),
    ("@/core/utils/utils/", "@/core/utils/"),
    ("@/core/types/types/", "@/core/types/"),
    ("@/superadmin/components/superadmin/", "@/superadmin/components/"),
    ("@/rooms/components/rooms/", "@/rooms/components/"),
    ("@/bookings/components/bookings/", "@/bookings/components/"),
    ("@/dashboard/components/dashboard/", "@/dashboard/components/"),
    ("@/guest_booking/components/public/public/", "@/guest_booking/components/public/"),
    ("@/settings/components/integration/integration/", "@/settings/components/integration/"),
    ("@/marketing/components/addons/addons/", "@/marketing/components/addons/"),
    ("@/finance/components/payments/payments/", "@/finance/components/payments/"),
    ("@/finance/components/rates/rates/", "@/finance/components/rates/"),
    ("@/dashboard/components/notifications/notifications/", "@/dashboard/components/notifications/"),
    ("@/guest_booking/components/support/support/", "@/guest_booking/components/support/"),
]

def update_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return

    original_content = content
    
    for old, new in import_fixes:
        content = content.replace(old, new)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed double-nesting imports in {filepath.relative_to(FRONTEND_DIR)}")

print("Fixing double nested imports...")
for root, _, files in os.walk(FRONTEND_DIR):
    if ".git" in root or "node_modules" in root or "dist" in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            update_file(Path(root) / file)

print("Done fixing double nesting!")
