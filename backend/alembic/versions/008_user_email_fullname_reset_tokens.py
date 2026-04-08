"""Add email/full_name to users and password_reset_tokens table

Revision ID: 008
Revises: 007
Create Date: 2024-01-01
"""
from __future__ import annotations

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("full_name", sa.String(255), nullable=True))
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_index("ix_password_reset_tokens_token", "password_reset_tokens", ["token"])


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "full_name")
    op.drop_column("users", "email")
