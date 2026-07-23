"""add amocrm_lead_id to orders

Revision ID: 017
Revises: 016
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa

revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('orders', sa.Column('amocrm_lead_id', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('orders', 'amocrm_lead_id')
