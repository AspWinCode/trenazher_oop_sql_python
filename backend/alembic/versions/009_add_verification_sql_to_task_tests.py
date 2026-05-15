"""Add verification_sql to task_tests for DML task support

Revision ID: 009
Revises: 008
Create Date: 2024-01-01
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_tests",
        sa.Column("verification_sql", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("task_tests", "verification_sql")
