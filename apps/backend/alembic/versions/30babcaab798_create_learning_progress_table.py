"""Create learning_progress table

Revision ID: 30babcaab798
Revises: 2495f3449ea2
Create Date: 2026-09-29 15:56:30.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '30babcaab798'
down_revision: Union[str, None] = '2495f3449ea2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'learning_progress',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('content_id', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('progress_seconds', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('progress_percent', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_watched_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'content_id', 'content_type', name='uq_user_content_progress'),
    )
    op.create_index('ix_learning_progress_user_id', 'learning_progress', ['user_id'])
    op.create_index('ix_learning_progress_user_type', 'learning_progress', ['user_id', 'content_type'])
    op.create_index('ix_learning_progress_user_content', 'learning_progress', ['user_id', 'content_id'])


def downgrade() -> None:
    op.drop_index('ix_learning_progress_user_content', table_name='learning_progress')
    op.drop_index('ix_learning_progress_user_type', table_name='learning_progress')
    op.drop_index('ix_learning_progress_user_id', table_name='learning_progress')
    op.drop_table('learning_progress')
