"""Course hierarchy: extend courses table and declare enums.

Revision ID: 003
Revises: 001
Create Date: 2026-03-15

Note: table creation (course_nodes, topic_steps, progress tables) is handled
by migration 004, which uses create_type=False for all enum columns.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Extend courses ---
    op.add_column("courses", sa.Column("slug", sa.String(255), nullable=True))
    op.add_column("courses", sa.Column("short_description", sa.String(500), nullable=True))
    op.add_column("courses", sa.Column("cover_image_url", sa.String(500), nullable=True))
    op.add_column("courses", sa.Column("is_visible", sa.Boolean(), server_default="true"))
    op.add_column("courses", sa.Column("sort_order", sa.Integer(), server_default="0"))
    op.add_column("courses", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("courses", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("courses", "description", existing_type=sa.String(2000), type_=sa.Text(), existing_nullable=True)
    op.create_index("ix_courses_slug", "courses", ["slug"], unique=True)

    # --- Enums (via raw SQL to avoid duplicate-type errors) ---
    op.execute(
        "DO $$ BEGIN CREATE TYPE coursenodetype AS ENUM ('module', 'submodule', 'topic', 'subtopic'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE coursenodestatus AS ENUM ('active', 'archived'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE topicsteptype AS ENUM ('theory', 'task', 'text', 'video', 'quiz'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE topicstepstatus AS ENUM ('active', 'archived'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    )

    # Tables (course_nodes, topic_steps, progress) are created in migration 004.


def downgrade() -> None:
    # Enums are dropped by migration 004 downgrade.
    op.drop_index("ix_courses_slug", "courses")
    op.drop_column("courses", "archived_at")
    op.drop_column("courses", "updated_at")
    op.drop_column("courses", "sort_order")
    op.drop_column("courses", "is_visible")
    op.drop_column("courses", "cover_image_url")
    op.drop_column("courses", "short_description")
    op.drop_column("courses", "slug")
    op.alter_column("courses", "description", existing_type=sa.Text(), type_=sa.String(2000), existing_nullable=True)
