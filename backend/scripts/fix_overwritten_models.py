import os
import re
from pathlib import Path

BASE_DIR = Path(r"d:\booking engine\ai-based-booking-engine-for-hotels-\backend")
APP_DIR = BASE_DIR / "app"

# We must change references that were wrongly mapped to the router file, to point to the new _model file
replacements = {
    # rates
    r"from app\.rate_plans\.rates import\b(.*?)(RatePlan)": r"from app.rate_plans.rates_model import\1\2",
    r"from app\.rate_plans\.rates import RatePlan": r"from app.rate_plans.rates_model import RatePlan",
    
    # channel_manager
    r"from app\.channel_manager\.channel_manager import\b(.*?)(OTAIntegration|OTAMapping)": r"from app.channel_manager.channel_manager_model import\1\2",
    
    # loyalty
    r"from app\.loyalty\.loyalty import\b(.*?)(Loyalty)": r"from app.loyalty.loyalty_model import\1\2",
    
    # social_proof
    r"from app\.google_reviews\.social_proof import\b(.*?)(Review)": r"from app.google_reviews.social_proof_model import\1\2",
}

# A broader replace just in case:
# If a file does `import RatePlan` from `app.rate_plans.rates`, change the module to `rates_model`
module_replacements = {
    "app.rate_plans.rates": "app.rate_plans.rates_model",
    "app.channel_manager.channel_manager": "app.channel_manager.channel_manager_model",
    "app.loyalty.loyalty": "app.loyalty.loyalty_model",
    "app.google_reviews.social_proof": "app.google_reviews.social_proof_model",
}

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    new_content = content
    
    # Let's do a smart regex replace.
    # Look for "from MODULE import"
    for module, new_module in module_replacements.items():
        # Find all lines starting with "from {module} import "
        pattern = re.compile(rf"^from {re.escape(module)} import (.*)$", re.MULTILINE)
        
        def replacer(match):
            imports = match.group(1)
            if "router" in imports:
                return match.group(0) # don't change router imports
            return f"from {new_module} import {imports}"
            
        new_content = pattern.sub(replacer, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed models in {filepath.name}")

for root, _, files in os.walk(APP_DIR):
    for file in files:
        if file.endswith(".py"):
            fix_file(Path(root) / file)
print("Done fixing overwritten models.")
