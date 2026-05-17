"""Add test_files JSON column to task_tests for sandbox file support

Revision ID: 010
Revises: 009
Create Date: 2024-01-01
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_tests",
        sa.Column("test_files", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("task_tests", "test_files")
