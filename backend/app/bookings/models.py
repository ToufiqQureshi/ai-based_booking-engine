"""Public model surface for this package.

Thin re-export of the canonical model module (`app.bookings.booking`) so callers (and the
test suite) can `from app.bookings.models import ...` without
depending on the concrete file name. Keep model definitions in the canonical
module; this file should only re-export.
"""
from app.bookings.booking import *  # noqa: F401,F403
