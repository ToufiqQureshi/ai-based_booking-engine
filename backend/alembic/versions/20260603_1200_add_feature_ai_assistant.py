"""add_feature_ai_assistant

Adds the `feature_ai_assistant` flag to the hotel table so the super-admin can
toggle the internal hotelier AI assistant independently of the WhatsApp AI
agent (`feature_ai_agent`) and the guest chat bot (`feature_guest_bot`).

Revision ID: f1a2b3c4d5e6
Revises: 20260602_0900_pay_txn
Create Date: 2026-06-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '20260602_0900_pay_txn'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c['name'] for c in sa.inspect(bind).get_columns('hotels')}
    if 'feature_ai_assistant' not in existing:
        op.add_column(
            'hotels',
            sa.Column('feature_ai_assistant', sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    existing = {c['name'] for c in sa.inspect(bind).get_columns('hotels')}
    if 'feature_ai_assistant' in existing:
        op.drop_column('hotels', 'feature_ai_assistant')
