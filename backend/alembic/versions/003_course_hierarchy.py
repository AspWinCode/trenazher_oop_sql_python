"""Course hierarchy: CourseNode, TopicStep, user progress

Revision ID: 003
Revises: 002
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
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

    # --- Enums for course_nodes and topic_steps ---
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

    # --- course_nodes ---
    op.create_table(
        "course_nodes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", sa.Enum("module", "submodule", "topic", "subtopic", name="coursenodetype"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("status", sa.Enum("active", "archived", name="coursenodestatus"), server_default="active"),
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
        sa.Column("type", sa.Enum("theory", "task", "text", "video", "quiz", name="topicsteptype"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("status", sa.Enum("active", "archived", name="topicstepstatus"), server_default="active"),
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
    op.drop_table("user_step_progress")
    op.drop_table("user_node_progress")
    op.drop_table("user_course_progress")
    op.drop_table("topic_steps")
    op.drop_table("course_nodes")
    op.drop_index("ix_courses_slug", "courses")
    op.drop_column("courses", "archived_at")
    op.drop_column("courses", "updated_at")
    op.drop_column("courses", "sort_order")
    op.drop_column("courses", "is_visible")
    op.drop_column("courses", "cover_image_url")
    op.drop_column("courses", "short_description")
    op.drop_column("courses", "slug")
    op.alter_column("courses", "description", existing_type=sa.Text(), type_=sa.String(2000), existing_nullable=True)
    op.execute("DROP TYPE IF EXISTS topicstepstatus")
    op.execute("DROP TYPE IF EXISTS topicsteptype")
    op.execute("DROP TYPE IF EXISTS coursenodestatus")
    op.execute("DROP TYPE IF EXISTS coursenodetype")
