"""User preferences: reveal hidden tests / reveal all hints.

Revision ID: 020
Revises: 019
Create Date: 2026-11-26
"""
from alembic import op
import sqlalchemy as sa

revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column('reveal_hidden_tests', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'users',
        sa.Column('reveal_all_hints', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_column('users', 'reveal_all_hints')
    op.drop_column('users', 'reveal_hidden_tests')
