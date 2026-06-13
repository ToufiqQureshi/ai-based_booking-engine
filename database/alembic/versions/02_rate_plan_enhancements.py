"""add rate plan enhancement fields

Revision ID: 20240209_rate_plan_enhancements
Revises: 20023f02b43d
Create Date: 2026-02-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = '20240209_rate_plan_enhancements'
down_revision: Union[str, None] = '20023f02b43d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add min_los column
    op.add_column('rate_plans', sa.Column('min_los', sa.Integer(), nullable=True, server_default='1'))
    
    # Add advance_purchase_days column
    op.add_column('rate_plans', sa.Column('advance_purchase_days', sa.Integer(), nullable=True, server_default='0'))
    
    # Add inclusions column (JSONB)
    op.add_column('rate_plans', sa.Column('inclusions', JSONB(), nullable=True, server_default='[]'))


def downgrade() -> None:
    op.drop_column('rate_plans', 'inclusions')
    op.drop_column('rate_plans', 'advance_purchase_days')
    op.drop_column('rate_plans', 'min_los')
