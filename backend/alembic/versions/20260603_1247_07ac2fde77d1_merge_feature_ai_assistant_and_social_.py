"""merge feature_ai_assistant and social_proof heads

Revision ID: 07ac2fde77d1
Revises: b2c3d4e5f6g7, f1a2b3c4d5e6
Create Date: 2026-06-03 12:47:19.094946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07ac2fde77d1'
down_revision: Union[str, Sequence[str], None] = ('b2c3d4e5f6g7', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
