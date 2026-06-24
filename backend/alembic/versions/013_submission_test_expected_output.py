"""Добавить expected_output в submission_tests (эталонный результат, вычисленный
раннером — например, строки SQL — для показа студенту рядом с его выводом).

Ветвится от 012; heads в проде станут {002, 013} — штатный кейс.

Revision ID: 013
Revises: 012
Create Date: 2026-06-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "submission_tests",
        sa.Column("expected_output", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("submission_tests", "expected_output")
