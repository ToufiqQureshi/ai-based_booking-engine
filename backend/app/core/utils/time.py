"""
Timezone-aware time helpers.

`datetime.utcnow()` is deprecated in Python 3.12+ (it returns a naive
datetime that pretends to be UTC, which is the worst of both worlds).
`datetime.now(timezone.utc)` is the correct replacement, but it returns
a tz-aware datetime that does NOT match our SQLModel columns, which are
typed as naive `datetime` and stored without timezone info.

This module provides `utcnow()` and `now_utc()` — a single source of
truth for "the current moment in UTC, as a naive datetime" so that:
  1. We get a DeprecationWarning-free replacement for `datetime.utcnow()`.
  2. The returned value is still a naive datetime (no tzinfo) so SQLModel
     happily stores it in the existing `TIMESTAMP WITHOUT TIME ZONE` columns
     we use for `created_at` / `updated_at` everywhere.
  3. Servers running in a non-UTC timezone no longer silently produce
     timestamps that are off by the local offset — which was the real
     footgun with `datetime.now()` (no args) sprinkled through the codebase.

When we eventually migrate the schema to `TIMESTAMP WITH TIME ZONE`, switch
this helper to return tz-aware datetimes and the rest of the codebase
won't need to change.
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return the current UTC time as a naive datetime.

    Equivalent to the old `datetime.utcnow()` but doesn't emit the
    Python 3.12+ DeprecationWarning, and is timezone-safe on hosts
    that run in a non-UTC zone.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now_utc() -> datetime:
    """Alias for `utcnow()`. Preferred name in new code."""
    return utcnow()
