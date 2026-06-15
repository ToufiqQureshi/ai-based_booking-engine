"""Public model surface for this package.

Thin re-export of the canonical model module (`app.ai_assistant.ai_usage`) so callers (and the
test suite) can `from app.ai_assistant.models import ...` without
depending on the concrete file name. Keep model definitions in the canonical
module; this file should only re-export.
"""
from app.ai_assistant.ai_usage import *  # noqa: F401,F403
