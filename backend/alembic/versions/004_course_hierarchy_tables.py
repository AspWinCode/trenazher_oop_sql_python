"""Course hierarchy tables: course_nodes, topic_steps, user progress.

Revision ID: 004
Revises: 003
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Enums: только сырой SQL, без создания типов при create_table ---
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

    node_type = sa.Enum("module", "submodule", "topic", "subtopic", name="coursenodetype", create_type=False)
    node_status = sa.Enum("active", "archived", name="coursenodestatus", create_type=False)
    step_type = sa.Enum("theory", "task", "text", "video", "quiz", name="topicsteptype", create_type=False)
    step_status = sa.Enum("active", "archived", name="topicstepstatus", create_type=False)

    # --- course_nodes ---
    op.create_table(
        "course_nodes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", node_type, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("status", node_status, server_default="active"),
        sa.Column("is_published", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- topic_steps ---
    op.create_table(
        "topic_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", step_type, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("status", step_status, server_default="active"),
        sa.Column("is_published", sa.Boolean(), server_default="false"),
        sa.Column("is_required", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- user_course_progress ---
    op.create_table(
        "user_course_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_steps", sa.Integer(), server_default="0"),
        sa.Column("total_steps", sa.Integer(), server_default="0"),
        sa.Column("completed_tasks", sa.Integer(), server_default="0"),
        sa.Column("total_tasks", sa.Integer(), server_default="0"),
        sa.Column("progress_percent", sa.Float(), server_default="0.0"),
        sa.Column("last_opened_node_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_opened_step_id", sa.Integer(), sa.ForeignKey("topic_steps.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_course_progress_user_course", "user_course_progress", ["user_id", "course_id"], unique=True)

    # --- user_node_progress ---
    op.create_table(
        "user_node_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_steps", sa.Integer(), server_default="0"),
        sa.Column("total_steps", sa.Integer(), server_default="0"),
        sa.Column("completed_required_tasks", sa.Integer(), server_default="0"),
        sa.Column("total_required_tasks", sa.Integer(), server_default="0"),
        sa.Column("progress_percent", sa.Float(), server_default="0.0"),
        sa.Column("is_completed", sa.Boolean(), server_default="false"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_node_progress_user_node", "user_node_progress", ["user_id", "node_id"], unique=True)

    # --- user_step_progress ---
    op.create_table(
        "user_step_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.Integer(), sa.ForeignKey("topic_steps.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_user_step_progress_user_step", "user_step_progress", ["user_id", "step_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_user_step_progress_user_step", "user_step_progress")
    op.drop_table("user_step_progress")
    op.drop_index("ix_user_node_progress_user_node", "user_node_progress")
    op.drop_table("user_node_progress")
    op.drop_index("ix_user_course_progress_user_course", "user_course_progress")
    op.drop_table("user_course_progress")
    op.drop_table("topic_steps")
    op.drop_table("course_nodes")
    op.execute("DROP TYPE IF EXISTS topicstepstatus")
    op.execute("DROP TYPE IF EXISTS topicsteptype")
    op.execute("DROP TYPE IF EXISTS coursenodestatus")
    op.execute("DROP TYPE IF EXISTS coursenodetype")
