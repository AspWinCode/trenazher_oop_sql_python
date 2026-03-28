"""Add user_course_enrollments table.

Revision ID: 006
Revises: 005
Create Date: 2026-03-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_course_enrollments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "course_id", name="uq_user_course_enrollment"),
    )
    op.create_index("ix_user_course_enrollments_user_id", "user_course_enrollments", ["user_id"])
    op.create_index("ix_user_course_enrollments_course_id", "user_course_enrollments", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_user_course_enrollments_course_id", table_name="user_course_enrollments")
    op.drop_index("ix_user_course_enrollments_user_id", table_name="user_course_enrollments")
    op.drop_table("user_course_enrollments")
