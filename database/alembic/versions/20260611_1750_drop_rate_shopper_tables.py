"""drop_rate_shopper_tables

Drops competitor-related tables and columns from the database.

Revision ID: drop_rate_shopper_tables
Revises: f1g2h3i4j5k6
Create Date: 2026-06-11 17:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'drop_rate_shopper_tables'
down_revision: Union[str, Sequence[str], None] = 'f1g2h3i4j5k6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop indices first if they exist
    try:
        op.drop_index('idx_competitor_rates_lookup', table_name='competitor_rates')
    except Exception:
        pass
        
    try:
        op.drop_index('ix_scraper_usage_hotel_id', table_name='scraper_usage')
    except Exception:
        pass

    try:
        op.drop_index('ix_competitors_hotel_id', table_name='competitors')
    except Exception:
        pass

    # Drop tables
    op.drop_table('scraper_usage')
    op.drop_table('competitor_rates')
    op.drop_table('competitors')

    # Drop columns from hotels
    with op.batch_alter_table('hotels') as batch_op:
        batch_op.drop_column('max_competitors')
        batch_op.drop_column('feature_rate_shopper')


def downgrade() -> None:
    # Recreate columns in hotels
    with op.batch_alter_table('hotels') as batch_op:
        batch_op.add_column(sa.Column('max_competitors', sa.Integer(), nullable=False, server_default='5'))
        batch_op.add_column(sa.Column('feature_rate_shopper', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # Recreate competitors table
    op.create_table(
        'competitors',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=False, server_default='BOOKING'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_scheduled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_scrape_status', sa.String(), nullable=True),
        sa.Column('last_scrape_error', sa.Text(), nullable=True),
        sa.Column('last_scraped_at', sa.DateTime(), nullable=True),
        sa.Column('scrape_started_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Recreate competitor_rates table
    op.create_table(
        'competitor_rates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('competitor_id', sa.String(), sa.ForeignKey('competitors.id'), nullable=False),
        sa.Column('check_in_date', sa.Date(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('room_type', sa.String(), nullable=True, server_default='Standard'),
        sa.Column('is_sold_out', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('fetched_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Recreate scraper_usage table
    op.create_table(
        'scraper_usage',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('competitor_id', sa.String(), sa.ForeignKey('competitors.id'), nullable=False),
        sa.Column('scraped_at', sa.DateTime(), nullable=False),
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('status', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index('idx_competitor_rates_lookup', 'competitor_rates', ['competitor_id', 'check_in_date', 'fetched_at'])
