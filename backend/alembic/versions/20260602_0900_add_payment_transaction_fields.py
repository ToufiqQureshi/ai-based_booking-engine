"""add transaction_id and reference_number to payments

Revision ID: 20260602_0900_pay_txn
Revises: a1b2c3d4e5f6
Create Date: 2026-06-02 09:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '20260602_0900_pay_txn'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade():
    # Idempotent: these columns may already exist in some environments where
    # they were applied out-of-band (alembic version table diverged from the
    # actual schema). Skip any column that is already present.
    bind = op.get_bind()
    existing = {c['name'] for c in sa.inspect(bind).get_columns('payments')}
    with op.batch_alter_table('payments') as batch_op:
        if 'transaction_id' not in existing:
            batch_op.add_column(sa.Column('transaction_id', sa.String(), nullable=True))
        if 'reference_number' not in existing:
            batch_op.add_column(sa.Column('reference_number', sa.String(), nullable=True))

def downgrade():
    bind = op.get_bind()
    existing = {c['name'] for c in sa.inspect(bind).get_columns('payments')}
    with op.batch_alter_table('payments') as batch_op:
        if 'reference_number' in existing:
            batch_op.drop_column('reference_number')
        if 'transaction_id' in existing:
            batch_op.drop_column('transaction_id')
