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
    with op.batch_alter_table('payments') as batch_op:
        batch_op.add_column(sa.Column('transaction_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('reference_number', sa.String(), nullable=True))

def downgrade():
    with op.batch_alter_table('payments') as batch_op:
        batch_op.drop_column('reference_number')
        batch_op.drop_column('transaction_id')
