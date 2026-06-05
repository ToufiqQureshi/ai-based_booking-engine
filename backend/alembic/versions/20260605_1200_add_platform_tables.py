"""add_platform_tables (KYC, commissions, payouts, tickets, api keys, domains, templates, sub-roles, invoices)

Revision ID: f1g2h3i4j5k6
Revises: 4e49118f6e51
Create Date: 2026-06-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1g2h3i4j5k6'
down_revision: Union[str, Sequence[str], None] = '4e49118f6e51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # KYC Profile
    op.create_table(
        'kyc_profiles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('overall_status', sa.String(), nullable=False, server_default='incomplete'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('legal_business_name', sa.String(), nullable=True),
        sa.Column('gst_number', sa.String(), nullable=True),
        sa.Column('pan_number', sa.String(), nullable=True),
        sa.Column('registration_number', sa.String(), nullable=True),
        sa.Column('owner_full_name', sa.String(), nullable=True),
        sa.Column('owner_phone', sa.String(), nullable=True),
        sa.Column('owner_email', sa.String(), nullable=True),
        sa.Column('business_address', sa.String(), nullable=True),
        sa.Column('docs_submitted', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('docs_approved', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('docs_rejected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hotel_id'),
    )
    op.create_index('ix_kyc_profiles_hotel_id', 'kyc_profiles', ['hotel_id'])
    op.create_index('ix_kyc_profiles_overall_status', 'kyc_profiles', ['overall_status'])

    # KYC Documents
    op.create_table(
        'kyc_documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('doc_type', sa.String(), nullable=False),
        sa.Column('doc_number', sa.String(), nullable=True),
        sa.Column('doc_url', sa.String(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('rejection_reason', sa.String(), nullable=True),
        sa.Column('reviewed_by', sa.String(), nullable=True),
        sa.Column('reviewed_by_email', sa.String(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('submitted_by', sa.String(), nullable=True),
        sa.Column('submitted_by_email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_kyc_documents_hotel_id', 'kyc_documents', ['hotel_id'])
    op.create_index('ix_kyc_documents_doc_type', 'kyc_documents', ['doc_type'])
    op.create_index('ix_kyc_documents_status', 'kyc_documents', ['status'])

    # Commission Rules
    op.create_table(
        'commission_rules',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=True),
        sa.Column('plan_name', sa.String(), nullable=True),
        sa.Column('commission_percent', sa.Float(), nullable=False, server_default='10.0'),
        sa.Column('fixed_fee', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('gst_on_commission', sa.Float(), nullable=False, server_default='18.0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Bank Accounts
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('account_holder_name', sa.String(), nullable=False),
        sa.Column('account_number', sa.String(), nullable=False),
        sa.Column('ifsc_code', sa.String(), nullable=False),
        sa.Column('bank_name', sa.String(), nullable=True),
        sa.Column('branch', sa.String(), nullable=True),
        sa.Column('upi_id', sa.String(), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('verified_by', sa.String(), nullable=True),
        sa.Column('verification_notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Payouts
    op.create_table(
        'payouts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('bank_account_id', sa.String(), sa.ForeignKey('bank_accounts.id'), nullable=True),
        sa.Column('period_start', sa.DateTime(), nullable=False),
        sa.Column('period_end', sa.DateTime(), nullable=False),
        sa.Column('gross_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('commission_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('gst_total', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('adjustments', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('net_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(), nullable=False, server_default='scheduled'),
        sa.Column('reference_number', sa.String(), nullable=True),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('initiated_by', sa.String(), nullable=True),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Commission Ledger
    op.create_table(
        'commission_ledger',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('booking_id', sa.String(), nullable=True),
        sa.Column('payment_id', sa.String(), nullable=True),
        sa.Column('booking_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('commission_percent', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('commission_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('fixed_fee', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('gst_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('platform_take', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('hotelier_payout', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('status', sa.String(), nullable=False, server_default='accrued'),
        sa.Column('payout_id', sa.String(), sa.ForeignKey('payouts.id'), nullable=True),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Platform Invoices
    op.create_table(
        'platform_invoices',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('invoice_number', sa.String(), nullable=False),
        sa.Column('invoice_type', sa.String(), nullable=False, server_default='subscription'),
        sa.Column('period_start', sa.DateTime(), nullable=True),
        sa.Column('period_end', sa.DateTime(), nullable=True),
        sa.Column('issue_date', sa.DateTime(), nullable=False),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('gst_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('total_amount', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('currency', sa.String(), nullable=False, server_default='INR'),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('line_items', sa.JSON(), nullable=True),
        sa.Column('pdf_url', sa.String(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number'),
    )

    # Support Tickets
    op.create_table(
        'support_tickets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('ticket_number', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=True),
        sa.Column('raised_by', sa.String(), nullable=True),
        sa.Column('raised_by_email', sa.String(), nullable=False),
        sa.Column('raised_by_name', sa.String(), nullable=True),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False, server_default='general'),
        sa.Column('priority', sa.String(), nullable=False, server_default='normal'),
        sa.Column('status', sa.String(), nullable=False, server_default='open'),
        sa.Column('assigned_to', sa.String(), nullable=True),
        sa.Column('assigned_to_email', sa.String(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(), nullable=True),
        sa.Column('sla_due_at', sa.DateTime(), nullable=True),
        sa.Column('first_response_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('attachments', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number'),
    )

    # Ticket Messages
    op.create_table(
        'ticket_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('ticket_id', sa.String(), sa.ForeignKey('support_tickets.id'), nullable=False),
        sa.Column('author_id', sa.String(), nullable=True),
        sa.Column('author_email', sa.String(), nullable=False),
        sa.Column('author_name', sa.String(), nullable=True),
        sa.Column('author_type', sa.String(), nullable=False, server_default='hotelier'),
        sa.Column('body', sa.String(), nullable=False),
        sa.Column('is_internal_note', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('attachments', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # API Keys
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('key_prefix', sa.String(), nullable=False),
        sa.Column('key_hash', sa.String(), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_ip', sa.String(), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_reason', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # Custom Domains
    op.create_table(
        'custom_domains',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=False),
        sa.Column('domain', sa.String(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('verification_token', sa.String(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('dns_records', sa.JSON(), nullable=True),
        sa.Column('ssl_status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('ssl_issued_at', sa.DateTime(), nullable=True),
        sa.Column('ssl_expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain'),
    )

    # Email Templates
    op.create_table(
        'email_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hotel_id', sa.String(), sa.ForeignKey('hotels.id'), nullable=True),
        sa.Column('template_key', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False, server_default='email'),
        sa.Column('subject', sa.String(), nullable=True),
        sa.Column('body_html', sa.String(), nullable=True),
        sa.Column('body_text', sa.String(), nullable=True),
        sa.Column('variables', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Super Admin Roles
    op.create_table(
        'super_admin_roles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('user_email', sa.String(), nullable=False),
        sa.Column('role_tier', sa.String(), nullable=False, server_default='support'),
        sa.Column('permissions', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    # Extend SystemBroadcast with scheduling + targeting
    with op.batch_alter_table('system_broadcasts') as b:
        b.add_column(sa.Column('scheduled_at', sa.DateTime(), nullable=True))
        b.add_column(sa.Column('expires_at', sa.DateTime(), nullable=True))
        b.add_column(sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('true')))
        b.add_column(sa.Column('target_plans', sa.JSON(), nullable=True))
        b.add_column(sa.Column('target_hotel_ids', sa.JSON(), nullable=True))
        b.add_column(sa.Column('created_by', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('system_broadcasts') as b:
        for c in ('created_by', 'target_hotel_ids', 'target_plans', 'is_published', 'expires_at', 'scheduled_at'):
            b.drop_column(c)
    for t in (
        'super_admin_roles', 'email_templates', 'custom_domains', 'api_keys',
        'ticket_messages', 'support_tickets', 'platform_invoices',
        'commission_ledger', 'payouts', 'bank_accounts', 'commission_rules',
        'kyc_documents', 'kyc_profiles',
    ):
        op.drop_table(t)
