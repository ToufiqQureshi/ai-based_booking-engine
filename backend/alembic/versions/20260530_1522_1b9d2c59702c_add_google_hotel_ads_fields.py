"""add_google_hotel_ads_fields

Revision ID: 1b9d2c59702c
Revises: e0b7eb25bb68
Create Date: 2026-05-30 15:22:37.092790

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b9d2c59702c'
down_revision: Union[str, Sequence[str], None] = 'e0b7eb25bb68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add feature_google_ads to hotels table
    op.add_column('hotels', sa.Column('feature_google_ads', sa.Boolean(), server_default='false', nullable=False))

    # Add Google Hotel Ads fields to integration_settings table
    op.add_column('integration_settings', sa.Column('google_hotel_ads_enabled', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('integration_settings', sa.Column('google_hotel_center_id', sa.String(), nullable=True))
    op.add_column('integration_settings', sa.Column('google_ads_account_id', sa.String(), nullable=True))
    op.add_column('integration_settings', sa.Column('google_ads_last_ari_sync', sa.DateTime(), nullable=True))
    op.add_column('integration_settings', sa.Column('google_ads_status', sa.String(), server_default='inactive', nullable=False))


def downgrade() -> None:
    op.drop_column('integration_settings', 'google_ads_status')
    op.drop_column('integration_settings', 'google_ads_last_ari_sync')
    op.drop_column('integration_settings', 'google_ads_account_id')
    op.drop_column('integration_settings', 'google_hotel_center_id')
    op.drop_column('integration_settings', 'google_hotel_ads_enabled')
    op.drop_column('hotels', 'feature_google_ads')
