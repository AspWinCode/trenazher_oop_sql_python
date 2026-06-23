"""Add user_login_events table (метрики активной аудитории и сессий).

Revision ID: 011
Revises: 010
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_login_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_user_login_events_user_id", "user_login_events", ["user_id"]
    )
    op.create_index(
        "ix_user_login_events_created_at", "user_login_events", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_login_events_created_at", table_name="user_login_events")
    op.drop_index("ix_user_login_events_user_id", table_name="user_login_events")
    op.drop_table("user_login_events")
