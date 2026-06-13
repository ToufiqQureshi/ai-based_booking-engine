"""performance_indexes

Revision ID: 08_performance_indexes
Revises: 07_subscription_table
Create Date: 2024-03-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision = '08_performance_indexes'
down_revision = '0fc148106c40'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Booking Index for Dashboard Revenue (created_at)
    # Allows "Today's Revenue" query to be instant.
    op.create_index(
        'idx_bookings_created_at',
        'bookings',
        ['created_at'],
        unique=False
    )

    # 2. Competitor Rate Lookup (Composite Index)
    # Optimized for: WHERE competitor_id = X AND check_in_date = Y ORDER BY fetched_at DESC
    op.create_index(
        'idx_competitor_rates_lookup',
        'competitor_rates',
        ['competitor_id', 'check_in_date', 'fetched_at'],
        unique=False
    )

    # 3. Room Rate Lookup (Availability)
    # Optimized for: WHERE room_type_id = X AND date_from <= Y AND date_to >= Z
    op.create_index(
        'idx_room_rates_lookup',
        'room_rates',
        ['room_type_id', 'date_from', 'date_to'],
        unique=False
    )

    # 4. Booking Check-in/Check-out for Availability
    op.create_index(
        'idx_bookings_dates',
        'bookings',
        ['hotel_id', 'check_in', 'check_out'],
        unique=False
    )


def downgrade():
    op.drop_index('idx_bookings_dates', table_name='bookings')
    op.drop_index('idx_room_rates_lookup', table_name='room_rates')
    op.drop_index('idx_competitor_rates_lookup', table_name='competitor_rates')
    op.drop_index('idx_bookings_created_at', table_name='bookings')
