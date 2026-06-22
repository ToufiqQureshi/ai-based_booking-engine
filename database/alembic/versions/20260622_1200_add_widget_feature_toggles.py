"""add widget feature toggles to integration_settings and chain widget settings

Revision ID: c7d8e9f0a1b2
Revises: f1a2b3c4d5e6
Create Date: 2026-06-22 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Single-hotel widget feature toggles. Default true so existing widgets keep
    # showing promo / packages / flexible-dates exactly as before.
    op.add_column('integration_settings', sa.Column('widget_show_promo', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('integration_settings', sa.Column('widget_show_packages', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('integration_settings', sa.Column('widget_show_flexible_dates', sa.Boolean(), nullable=False, server_default=sa.true()))

    # Chain widget appearance + brand features (parity with the single-hotel widget).
    op.add_column('chains', sa.Column('widget_layout', sa.String(), nullable=False, server_default='modern'))
    op.add_column('chains', sa.Column('widget_bg_color', sa.String(), nullable=False, server_default='#FFFFFF'))
    op.add_column('chains', sa.Column('widget_theme', sa.String(), nullable=False, server_default='light'))
    op.add_column('chains', sa.Column('widget_show_price', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('chains', sa.Column('widget_show_loyalty', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('chains', sa.Column('widget_show_property_count', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('chains', 'widget_show_property_count')
    op.drop_column('chains', 'widget_show_loyalty')
    op.drop_column('chains', 'widget_show_price')
    op.drop_column('chains', 'widget_theme')
    op.drop_column('chains', 'widget_bg_color')
    op.drop_column('chains', 'widget_layout')
    op.drop_column('integration_settings', 'widget_show_flexible_dates')
    op.drop_column('integration_settings', 'widget_show_packages')
    op.drop_column('integration_settings', 'widget_show_promo')
