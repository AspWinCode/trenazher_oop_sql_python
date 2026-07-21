"""add buyer contact fields to orders

Revision ID: 016
Revises: 015
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('buyer_email', sa.String(255), nullable=True))
    op.add_column('orders', sa.Column('buyer_name', sa.String(255), nullable=True))
    op.add_column('orders', sa.Column('buyer_phone', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('orders', 'buyer_phone')
    op.drop_column('orders', 'buyer_name')
    op.drop_column('orders', 'buyer_email')
