"""add example_input/example_output to task_tests

Revision ID: 018
Revises: 017
Create Date: 2026-07-30
"""
from alembic import op
import sqlalchemy as sa

revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('task_tests', sa.Column('example_input', sa.Text(), nullable=True))
    op.add_column('task_tests', sa.Column('example_output', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('task_tests', 'example_output')
    op.drop_column('task_tests', 'example_input')
