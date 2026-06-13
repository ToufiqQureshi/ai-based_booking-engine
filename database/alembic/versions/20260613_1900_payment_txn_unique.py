"""payment transaction_id unique constraint

PAY-2: A gateway transaction must never be recorded twice. Without a DB-level
unique constraint, a replayed Razorpay webhook (or a verify+webhook race) could
write duplicate `payments` rows and double-credit loyalty. We add a unique index
on `payments.transaction_id` (NULLs allowed for manual/non-gateway payments).

Defensive: collapse any pre-existing duplicate transaction_ids (keep the earliest
row) before creating the unique index, so the migration cannot fail on dirty data.

Revision ID: f1a2b3c4d5e6
Revises: drop_rate_shopper_tables
Create Date: 2026-06-13 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'drop_rate_shopper_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_NAME = "uq_payments_transaction_id"


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Collapse duplicate non-null transaction_ids (keep earliest by created_at).
    bind.execute(sa.text(
        """
        DELETE FROM payments p
        USING payments q
        WHERE p.transaction_id IS NOT NULL
          AND p.transaction_id = q.transaction_id
          AND (
              p.created_at > q.created_at
              OR (p.created_at = q.created_at AND p.id > q.id)
          )
        """
    ))

    # 2. Create the unique index if it doesn't already exist.
    existing = {ix['name'] for ix in sa.inspect(bind).get_indexes('payments')}
    if _INDEX_NAME not in existing:
        op.create_index(
            _INDEX_NAME, 'payments', ['transaction_id'], unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    existing = {ix['name'] for ix in sa.inspect(bind).get_indexes('payments')}
    if _INDEX_NAME in existing:
        op.drop_index(_INDEX_NAME, table_name='payments')
