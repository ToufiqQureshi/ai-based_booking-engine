"""performance_optimizations_indexes

Revision ID: 47b53572f09c
Revises: 1b9d2c59702c
Create Date: 2026-06-01 11:47:08.271401

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '47b53572f09c'
down_revision: Union[str, Sequence[str], None] = '1b9d2c59702c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Missing Foreign Key Indexes
    op.create_index('ix_channel_room_mappings_local_room_id', 'channel_room_mappings', ['local_room_id'], unique=False)
    op.create_index('ix_room_amenity_links_amenity_id', 'room_amenity_links', ['amenity_id'], unique=False)
    op.create_index('ix_user_hotel_links_hotel_id', 'user_hotel_links', ['hotel_id'], unique=False)

    # Drop Unused Indexes
    op.drop_index('ix_audit_logs_action', table_name='audit_logs', if_exists=True)
    op.drop_index('ix_analytics_events_event_type', table_name='analytics_events', if_exists=True)
    op.drop_index('ix_booking_timeline_booking_id', table_name='booking_timeline', if_exists=True)
    op.drop_index('ix_bookings_status', table_name='bookings', if_exists=True)
    op.drop_index('ix_competitor_rates_check_in_date', table_name='competitor_rates', if_exists=True)
    op.drop_index('ix_competitor_rates_is_sold_out', table_name='competitor_rates', if_exists=True)
    op.drop_index('ix_payments_booking_id', table_name='payments', if_exists=True)
    op.drop_index('ix_promo_codes_code', table_name='promo_codes', if_exists=True)
    op.drop_index('ix_promo_codes_hotel_id', table_name='promo_codes', if_exists=True)
    op.drop_index('ix_room_rates_hotel_id', table_name='room_rates', if_exists=True)
    op.drop_index('ix_room_rates_rate_plan_id', table_name='room_rates', if_exists=True)
    op.drop_index('ix_subscriptions_hotel_id', table_name='subscriptions', if_exists=True)


def downgrade() -> None:
    # Recreate Unused Indexes
    op.create_index('ix_subscriptions_hotel_id', 'subscriptions', ['hotel_id'], unique=False)
    op.create_index('ix_room_rates_rate_plan_id', 'room_rates', ['rate_plan_id'], unique=False)
    op.create_index('ix_room_rates_hotel_id', 'room_rates', ['hotel_id'], unique=False)
    op.create_index('ix_promo_codes_hotel_id', 'promo_codes', ['hotel_id'], unique=False)
    op.create_index('ix_promo_codes_code', 'promo_codes', ['code'], unique=False)
    op.create_index('ix_payments_booking_id', 'payments', ['booking_id'], unique=False)
    op.create_index('ix_competitor_rates_is_sold_out', 'competitor_rates', ['is_sold_out'], unique=False)
    op.create_index('ix_competitor_rates_check_in_date', 'competitor_rates', ['check_in_date'], unique=False)
    op.create_index('ix_bookings_status', 'bookings', ['status'], unique=False)
    op.create_index('ix_booking_timeline_booking_id', 'booking_timeline', ['booking_id'], unique=False)
    op.create_index('ix_analytics_events_event_type', 'analytics_events', ['event_type'], unique=False)
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'], unique=False)

    # Drop Missing Foreign Key Indexes
    op.drop_index('ix_user_hotel_links_hotel_id', table_name='user_hotel_links', if_exists=True)
    op.drop_index('ix_room_amenity_links_amenity_id', table_name='room_amenity_links', if_exists=True)
    op.drop_index('ix_channel_room_mappings_local_room_id', table_name='channel_room_mappings', if_exists=True)
