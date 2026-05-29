"""auto cleanup public.users on auth user delete

Revision ID: a1b2c3d4e5f6
Revises: 517bb6e1d3fb
Create Date: 2026-05-29 07:18:00.000000

"""
from typing import Sequence, Union
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '517bb6e1d3fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Creates a PostgreSQL trigger on auth.users so that whenever a user is
    deleted from Supabase Auth, their corresponding record in public.users
    is automatically deleted too. Prevents stale/orphaned records.
    """
    op.execute("""
        CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            -- Match by supabase_id (preferred) or by id directly
            DELETE FROM public.users
            WHERE supabase_id = OLD.id::text
               OR id::text = OLD.id::text;
            RETURN OLD;
        END;
        $$;
    """)

    op.execute("""
        DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
    """)

    op.execute("""
        CREATE TRIGGER on_auth_user_deleted
            AFTER DELETE ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_auth_user_delete();
    """)


def downgrade() -> None:
    """Remove the auto-cleanup trigger and function."""
    op.execute("DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;")
    op.execute("DROP FUNCTION IF EXISTS public.handle_auth_user_delete();")
