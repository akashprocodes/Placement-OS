"""add_partial_unique_index_active_learning_plans

Revision ID: 28eda297c110
Revises: 99eea6fc197d
Create Date: 2026-10-13 18:42:45.336501

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28eda297c110'
down_revision: Union[str, Sequence[str], None] = '99eea6fc197d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema safely with duplicate handling and partial unique index."""
    # 1. Safely handle any pre-existing duplicate active plans by archiving older duplicates (never delete user data)
    op.execute(sa.text("""
        WITH ranked_plans AS (
            SELECT id, ROW_NUMBER() OVER(
                PARTITION BY user_id, content_id 
                ORDER BY created_at DESC, id DESC
            ) as rn
            FROM learning_plans
            WHERE status = 'active'
        )
        UPDATE learning_plans
        SET status = 'archived'
        WHERE id IN (
            SELECT id FROM ranked_plans WHERE rn > 1
        );
    """))

    # 2. Create partial unique index on (user_id, content_id) for active plans
    op.create_index(
        'uq_learning_plans_user_active_content',
        'learning_plans',
        ['user_id', 'content_id'],
        unique=True,
        postgresql_where=sa.text("status = 'active'")
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_learning_plans_user_active_content', table_name='learning_plans')
