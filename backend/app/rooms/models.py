"""Public model surface for this package.

Thin re-export of the canonical model module (`app.rooms.room`) so callers (and the
test suite) can `from app.rooms.models import ...` without
depending on the concrete file name. Keep model definitions in the canonical
module; this file should only re-export.
"""
from app.rooms.room import *  # noqa: F401,F403
