"""drop_rate_shopper_tables — NEUTRALIZED (2026-07-02 production audit)

This migration was written on 2026-06-11 to remove the rate-shopper feature,
but the feature was restored: app/rate_shopper/ is mounted in main.py, the
frontend ships /rate-shopper, and production still has competitors /
competitor_rates / scraper_usage tables with live data (the Supabase-side
migration 20260615123017 even patched competitor_rates schema drift).

Production's alembic_version never advanced past 4e49118f6e51, so this
migration never ran there. Executing it now — e.g. on a fresh environment or
if someone runs `alembic upgrade head` against prod — would drop live tables
that the mounted router depends on. Both directions are therefore no-ops;
the revision id is kept so the migration chain (payment_txn_unique revises
this) stays intact.

Revision ID: drop_rate_shopper_tables
Revises: f1g2h3i4j5k6
Create Date: 2026-06-11 17:50:00.000000

"""
from typing import Sequence, Union


revision: str = 'drop_rate_shopper_tables'
down_revision: Union[str, Sequence[str], None] = 'f1g2h3i4j5k6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op: the rate-shopper feature this migration removed was restored."""
    pass


def downgrade() -> None:
    """No-op counterpart."""
    pass
