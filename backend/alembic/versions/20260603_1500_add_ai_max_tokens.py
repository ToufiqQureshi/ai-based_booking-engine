"""add_ai_max_tokens

Adds `ai_max_tokens` to `hotels` and `integration_settings` so super-admin can
control token limits per hotel from the dashboard instead of code constants.

Revision ID: a9b8c7d6e5f4
Revises: 07ac2fde77d1
Create Date: 2026-06-03 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, Sequence[str], None] = '07ac2fde77d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    hotels_cols = {c['name'] for c in sa.inspect(bind).get_columns('hotels')}
    if 'ai_max_tokens' not in hotels_cols:
        op.add_column('hotels', sa.Column('ai_max_tokens', sa.Integer(), nullable=True))

    int_cols = {c['name'] for c in sa.inspect(bind).get_columns('integration_settings')}
    if 'ai_max_tokens' not in int_cols:
        op.add_column('integration_settings', sa.Column('ai_max_tokens', sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()

    hotels_cols = {c['name'] for c in sa.inspect(bind).get_columns('hotels')}
    if 'ai_max_tokens' in hotels_cols:
        op.drop_column('hotels', 'ai_max_tokens')

    int_cols = {c['name'] for c in sa.inspect(bind).get_columns('integration_settings')}
    if 'ai_max_tokens' in int_cols:
        op.drop_column('integration_settings', 'ai_max_tokens')
