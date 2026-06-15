"""Public model surface for this package.

Thin re-export of the canonical model module (`app.rate_plans.rates_model`) so callers (and the
test suite) can `from app.rate_plans.models import ...` without
depending on the concrete file name. Keep model definitions in the canonical
module; this file should only re-export.
"""
from app.rate_plans.rates_model import *  # noqa: F401,F403
