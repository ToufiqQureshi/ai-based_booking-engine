"""add_hotel_social_proof_and_indexes

Two things in one migration so the deploy is atomic:

  1. New table `hotel_social_proof_settings` — per-hotel configuration
     for the public social proof widget. UNIQUE(hotel_id) so the
     PK lookup on the public endpoint is O(1).

  2. Composite / covering indexes on tables that the public booking
     flow and the social-proof refresh task scan, so they stay under
     100ms even with 100k+ rows:

       bookings(hotel_id, created_at DESC) — for "bookings this month"
                                              and "last booking"
       bookings(hotel_id, status)         — for status filter
       rooms   (hotel_id, is_active)      — for "available rooms" widget
       rate_plans(hotel_id, is_active)    — for "refundable" check
       integration_settings(hotel_id)     — for super-admin integrations
       promo_codes(hotel_id, code) UNIQUE — for promo lookup at checkout

Revision ID: a1b2c3d4e5f6
Revises: 8c4d5e6f7a8b
Create Date: 2026-06-01 13:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = '8c4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New social proof table
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if not inspector.has_table('hotel_social_proof_settings'):
        op.create_table(
            'hotel_social_proof_settings',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('hotel_id', sa.String(), nullable=False),
            sa.Column('is_enabled', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('show_viewers_count', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('show_last_booked', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('show_popular_badge', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('show_review_summary', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('popular_badge_text', sa.String(), server_default=sa.text("'Popular choice! {count} bookings this month'"), nullable=False),
            sa.Column('custom_badges', sa.JSON(), server_default=sa.text("'[]'::jsonb"), nullable=True),
            sa.Column('cached_booking_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
            sa.Column('cached_review_count', sa.Integer(), server_default=sa.text('0'), nullable=False),
            sa.Column('cached_avg_rating', sa.Float(), server_default=sa.text('0.0'), nullable=False),
            sa.Column('cached_hours_since_last_booking', sa.Float(), nullable=True),
            sa.Column('cache_refreshed_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['hotel_id'], ['hotels.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('hotel_id', name='uq_hotel_social_proof_settings_hotel_id')
        )
        op.create_index(
            'ix_hotel_social_proof_settings_is_enabled',
            'hotel_social_proof_settings',
            ['is_enabled'],
            unique=False
        )
        op.create_index(
            'ix_hotel_social_proof_settings_hotel_id',
            'hotel_social_proof_settings',
            ['hotel_id'],
            unique=False
        )

    # 2. Add config to Bookings table to track if we should show a booking in the popup
    columns = [col['name'] for col in inspector.get_columns('bookings')]
    if 'show_in_social_proof' not in columns:
        op.add_column(
            'bookings',
            sa.Column('show_in_social_proof', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        )

    def create_index_safe(idx_name, table_name, columns, unique=False):
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        if table_name in inspector.get_table_names():
            existing = {idx['name'] for idx in inspector.get_indexes(table_name)}
            if idx_name not in existing:
                op.create_index(idx_name, table_name, columns, unique=unique)

    # 2. Performance indexes (composite / covering)
    # Bookings — "this month" and "last booking" scans
    create_index_safe(
        'ix_bookings_hotel_id_created_at',
        'bookings',
        ['hotel_id', sa.text('created_at DESC')]
    )
    create_index_safe(
        'ix_bookings_hotel_id_status',
        'bookings',
        ['hotel_id', 'status']
    )

    # Room types — public "available rooms" widget
    create_index_safe(
        'ix_room_types_hotel_id_is_active',
        'room_types',
        ['hotel_id', 'is_active']
    )

    # Rate plans — refundable check on social proof
    create_index_safe(
        'ix_rate_plans_hotel_id_is_active',
        'rate_plans',
        ['hotel_id', 'is_active']
    )

    # Integration settings — super-admin integrations page
    create_index_safe(
        'ix_integration_settings_hotel_id',
        'integration_settings',
        ['hotel_id'],
        unique=False
    )

    # Promo codes — checkout-time promo lookup (if not already unique)
    create_index_safe(
        'ix_promo_codes_hotel_id_code',
        'promo_codes',
        ['hotel_id', 'code'],
        unique=True
    )


def downgrade() -> None:
    if 'promo_codes' in sa.inspect(op.get_bind()).get_table_names():
        op.drop_index('ix_promo_codes_hotel_id_code', table_name='promo_codes')
    op.drop_index('ix_integration_settings_hotel_id', table_name='integration_settings')
    op.drop_index('ix_rate_plans_hotel_id_is_active', table_name='rate_plans')
    op.drop_index('ix_room_types_hotel_id_is_active', table_name='room_types')
    op.drop_index('ix_bookings_hotel_id_status', table_name='bookings')
    op.drop_index('ix_bookings_hotel_id_created_at', table_name='bookings')
    op.drop_index('ix_hotel_social_proof_settings_is_enabled', table_name='hotel_social_proof_settings')
    op.drop_table('hotel_social_proof_settings')
