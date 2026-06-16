import os
import subprocess
from pathlib import Path
import re

BACKEND_DIR = Path(r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend")
APP_DIR = BACKEND_DIR / "app"
CORE_DIR = APP_DIR / "core"

# 1. Create Directories
dirs_to_create = [
    CORE_DIR / "db",
    CORE_DIR / "auth",
    CORE_DIR / "cache",
    CORE_DIR / "utils",
    APP_DIR / "ai_engine"
]

for d in dirs_to_create:
    d.mkdir(parents=True, exist_ok=True)
    # create __init__.py
    (d / "__init__.py").touch(exist_ok=True)

# 2. Define File Moves (Source -> Destination relative to backend dir)
moves = {
    "app/core/database.py": "app/core/db/database.py",
    "app/core/supabase.py": "app/core/db/supabase.py",
    "app/core/security.py": "app/core/auth/security.py",
    "app/core/deps.py": "app/core/auth/deps.py",
    "app/core/vault.py": "app/core/auth/vault.py",
    "app/core/sensitive_fields.py": "app/core/auth/sensitive_fields.py",
    "app/core/cache.py": "app/core/cache/cache.py",
    "app/core/redis_client.py": "app/core/cache/redis_client.py",
    "app/core/config.py": "app/core/utils/config.py",
    "app/core/time.py": "app/core/utils/time.py",
    "app/core/limiter.py": "app/core/utils/limiter.py",
    "app/core/exceptions.py": "app/core/utils/exceptions.py",
    "app/core/feature_flags.py": "app/core/utils/feature_flags.py",
    "app/core/tasks.py": "app/core/utils/tasks.py",
    "app/core/scheduler.py": "app/core/utils/scheduler.py",
    "app/core/plan_features.json": "app/core/utils/plan_features.json",
    
    "app/core/agent.py": "app/ai_engine/agent.py",
    "app/core/guest_agent.py": "app/ai_engine/guest_agent.py",
    "app/core/global_agent.py": "app/ai_engine/global_agent.py",
    "app/core/ai_usage.py": "app/ai_engine/ai_usage.py",
    "app/core/tools": "app/ai_engine/tools",
    
    "app/core/cancellation.py": "app/guest_booking/cancellation.py",
    "app/core/rate_signals.py": "app/revenue/rate_signals.py",
    "app/core/external_sync.py": "app/integration/external_sync.py",
    "app/core/social_proof_refresh.py": "app/google_reviews/social_proof_refresh.py",
}

print("Moving files...")
for src, dst in moves.items():
    src_path = BACKEND_DIR / src
    dst_path = BACKEND_DIR / dst
    if src_path.exists():
        # use git mv if possible, else shutil.move
        try:
            subprocess.run(["git", "mv", src, dst], cwd=BACKEND_DIR, check=True, capture_output=True)
            print(f"git mv {src} -> {dst}")
        except subprocess.CalledProcessError as e:
            print(f"git mv failed for {src}, falling back to mv. Error: {e.stderr.decode()}")
            import shutil
            shutil.move(src_path, dst_path)
    else:
        print(f"Warning: {src} does not exist.")

# 3. Import Rewrites
replacements = {
    "app.core.db.database": "app.core.db.database",
    "app.core.db.supabase": "app.core.db.supabase",
    "app.core.auth.security": "app.core.auth.security",
    "app.core.auth.deps": "app.core.auth.deps",
    "app.core.auth.vault": "app.core.auth.vault",
    "app.core.auth.sensitive_fields": "app.core.auth.sensitive_fields",
    "app.core.cache.cache": "app.core.cache.cache.cache",
    "app.core.cache.redis_client": "app.core.cache.cache.redis_client",
    "app.core.utils.config": "app.core.utils.config",
    "app.core.utils.time": "app.core.utils.time",
    "app.core.utils.limiter": "app.core.utils.limiter",
    "app.core.utils.exceptions": "app.core.utils.exceptions",
    "app.core.utils.feature_flags": "app.core.utils.feature_flags",
    "app.core.utils.tasks": "app.core.utils.tasks",
    "app.core.utils.scheduler": "app.core.utils.scheduler",
    "app.ai_engine.agent": "app.ai_engine.agent",
    "app.ai_engine.guest_agent": "app.ai_engine.guest_agent",
    "app.ai_engine.global_agent": "app.ai_engine.global_agent",
    "app.ai_engine.ai_usage": "app.ai_engine.ai_usage",
    "app.ai_engine.tools": "app.ai_engine.tools",
    "app.guest_booking.cancellation": "app.guest_booking.cancellation",
    "app.revenue.rate_signals": "app.revenue.rate_signals",
    "app.integration.external_sync": "app.integration.external_sync",
    "app.google_reviews.social_proof_refresh": "app.google_reviews.social_proof_refresh",
}

def update_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return

    original_content = content
    
    # Handle "from app.core import X"
    for module in replacements.keys():
        name = module.split('.')[-1]
        pattern = rf"from app\.core import\s+{name}\b"
        content = re.sub(pattern, f"import {replacements[module]} as {name}", content)
    
    # Handle standard replacements
    for old, new in replacements.items():
        # Match word boundaries to prevent partial matches
        pattern = rf"\b{old.replace('.', r'\.')}\b"
        content = re.sub(pattern, new, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated imports in {filepath.relative_to(BACKEND_DIR)}")

print("Updating imports...")
for root, _, files in os.walk(BACKEND_DIR):
    if ".git" in root or "__pycache__" in root or ".pytest_cache" in root or "venv" in root:
        continue
    for file in files:
        if file.endswith('.py') or file == "main.py":
            update_file(Path(root) / file)

print("Done!")
