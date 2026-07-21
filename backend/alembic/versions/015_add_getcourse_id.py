"""add getcourse_id to users

Revision ID: 015
Revises: 014
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('getcourse_id', sa.String(64), nullable=True))
    op.create_index('ix_users_getcourse_id', 'users', ['getcourse_id'], unique=True)


def downgrade():
    op.drop_index('ix_users_getcourse_id', table_name='users')
    op.drop_column('users', 'getcourse_id')
