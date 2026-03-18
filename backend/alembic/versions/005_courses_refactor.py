"""Refactor courses: drop step logic, add course_node_tasks and new progress.

Revision ID: 005
Revises: 004
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- courses: убрать is_visible, если есть ---
    try:
        with op.batch_alter_table("courses") as batch_op:
            batch_op.drop_column("is_visible")
    except Exception:
        # колонки может уже не быть – игнорируем
        pass

    # --- course_nodes: привести к целевой модели статусов и индексов ---
    try:
        with op.batch_alter_table("course_nodes") as batch_op:
            # дроп старого status, если есть
            try:
                batch_op.drop_column("status")
            except Exception:
                pass

            # coursestatus уже создавался в 001 как enum для courses.status
            status_enum = sa.Enum(
                "draft", "published", "archived", name="coursestatus", create_type=False
            )
            batch_op.add_column(
                sa.Column("status", status_enum, nullable=False, server_default="draft")
            )
    except Exception:
        # если таблицы нет / другая схема – не ломаем миграцию
        pass

    # Индексы для course_nodes
    for name, cols in [
        ("ix_course_nodes_course_id", ["course_id"]),
        ("ix_course_nodes_parent_id", ["parent_id"]),
        ("ix_course_nodes_course_parent_sort", ["course_id", "parent_id", "sort_order"]),
    ]:
        try:
            op.create_index(name, "course_nodes", cols)
        except Exception:
            pass

    # --- Удаляем старую step‑логику и старый прогресс ---
    for idx, table in [
        ("ix_user_step_progress_user_step", "user_step_progress"),
        ("ix_user_node_progress_user_node", "user_node_progress"),
        ("ix_user_course_progress_user_course", "user_course_progress"),
    ]:
        try:
            op.drop_index(idx, table)
        except Exception:
            pass

    for table in ["user_step_progress", "user_node_progress", "user_course_progress", "topic_steps"]:
        try:
            op.drop_table(table)
        except Exception:
            pass

    # удалить enum'ы topic* и старый coursenodestatus, если ещё остались
    for enum_name in ["topicstepstatus", "topicsteptype", "coursenodestatus"]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

    # --- Новые таблицы: course_node_tasks и прогресс ---

    # Связь узла с задачами
    op.create_table(
        "course_node_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_required", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_course_node_tasks_node_sort",
        "course_node_tasks",
        ["node_id", "sort_order"],
    )
    op.create_unique_constraint(
        "uq_course_node_tasks_node_task",
        "course_node_tasks",
        ["node_id", "task_id"],
    )

    # Прогресс по курсу
    op.create_table(
        "user_course_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("progress_percent", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("completed_tasks_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_tasks_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("current_node_id", sa.Integer(), sa.ForeignKey("course_nodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_user_course_progress_user_course",
        "user_course_progress",
        ["user_id", "course_id"],
        unique=True,
    )

    # Прогресс по задаче узла
    op.execute(
        "DO $$ BEGIN CREATE TYPE node_task_progress_status AS ENUM ('not_started', 'in_progress', 'completed'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$"
    )
    status_enum = sa.Enum(
        "not_started", "in_progress", "completed", name="node_task_progress_status", create_type=False
    )

    op.create_table(
        "user_course_node_task_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_task_id", sa.Integer(), sa.ForeignKey("course_node_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", status_enum, server_default="not_started", nullable=False),
        sa.Column("best_submission_id", sa.Integer(), sa.ForeignKey("submissions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_user_course_node_task_progress_user_node_task",
        "user_course_node_task_progress",
        ["user_id", "node_task_id"],
        unique=True,
    )


def downgrade() -> None:
    # Откат новых таблиц прогресса и связок
    op.drop_index(
        "ix_user_course_node_task_progress_user_node_task",
        "user_course_node_task_progress",
    )
    op.drop_table("user_course_node_task_progress")

    op.execute("DROP TYPE IF EXISTS node_task_progress_status")

    op.drop_index("ix_user_course_progress_user_course", "user_course_progress")
    op.drop_table("user_course_progress")

    op.drop_index("ix_course_node_tasks_node_sort", "course_node_tasks")
    op.drop_constraint("uq_course_node_tasks_node_task", "course_node_tasks", type_="unique")
    op.drop_table("course_node_tasks")

    # Индексы course_nodes
    for idx in [
        "ix_course_nodes_course_parent_sort",
        "ix_course_nodes_parent_id",
        "ix_course_nodes_course_id",
    ]:
        try:
            op.drop_index(idx, "course_nodes")
        except Exception:
            pass

    # Вернуть status узла как простой VARCHAR (минимальный даунгрейд)
    try:
        with op.batch_alter_table("course_nodes") as batch_op:
            try:
                batch_op.drop_column("status")
            except Exception:
                pass
            batch_op.add_column(sa.Column("status", sa.String(length=16), nullable=True))
    except Exception:
        pass

    # Вернуть is_visible в courses (минимальный даунгрейд)
    try:
        with op.batch_alter_table("courses") as batch_op:
            batch_op.add_column(
                sa.Column("is_visible", sa.Boolean(), server_default="true", nullable=False)
            )
    except Exception:
        pass

