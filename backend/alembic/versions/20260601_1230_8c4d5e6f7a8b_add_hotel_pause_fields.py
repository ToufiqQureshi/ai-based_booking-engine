"""add_hotel_pause_fields

Adds the soft-pause fields to the hotel table so the super-admin can put
a hotel into "temporarily unavailable" mode without fully disabling it.

Revision ID: 8c4d5e6f7a8b
Revises: 47b53572f09c
Create Date: 2026-06-01 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c4d5e6f7a8b'
down_revision: Union[str, Sequence[str], None] = '47b53572f09c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'hotel',
        sa.Column('is_paused', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'hotel',
        sa.Column('pause_reason', sa.String(), nullable=True),
    )
    op.add_column(
        'hotel',
        sa.Column('paused_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('hotel', 'paused_at')
    op.drop_column('hotel', 'pause_reason')
    op.drop_column('hotel', 'is_paused')
