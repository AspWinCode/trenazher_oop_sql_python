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
    # Use raw SQL with IF EXISTS / IF NOT EXISTS throughout to be
    # idempotent regardless of which tables/indexes actually exist.

    # --- courses: remove is_visible if present ---
    op.execute("ALTER TABLE courses DROP COLUMN IF EXISTS is_visible")

    # --- course_nodes: replace enum status with coursestatus ---
    # coursestatus ('draft','published','archived') was created in migration 001.
    op.execute("ALTER TABLE course_nodes DROP COLUMN IF EXISTS status")
    op.execute(
        "ALTER TABLE course_nodes "
        "ADD COLUMN IF NOT EXISTS status coursestatus NOT NULL DEFAULT 'draft'"
    )

    # --- Indexes on course_nodes ---
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_nodes_course_id "
        "ON course_nodes(course_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_nodes_parent_id "
        "ON course_nodes(parent_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_nodes_course_parent_sort "
        "ON course_nodes(course_id, parent_id, sort_order)"
    )

    # --- Drop legacy step tables (004 created them, 005 replaces them) ---
    op.execute("DROP TABLE IF EXISTS user_step_progress CASCADE")
    op.execute("DROP TABLE IF EXISTS user_node_progress CASCADE")
    op.execute("DROP TABLE IF EXISTS user_course_progress CASCADE")
    op.execute("DROP TABLE IF EXISTS topic_steps CASCADE")

    # --- Drop legacy enums ---
    op.execute("DROP TYPE IF EXISTS topicstepstatus")
    op.execute("DROP TYPE IF EXISTS topicsteptype")
    op.execute("DROP TYPE IF EXISTS coursenodestatus")

    # --- New table: course_node_tasks ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS course_node_tasks (
            id          SERIAL PRIMARY KEY,
            node_id     INTEGER NOT NULL REFERENCES course_nodes(id) ON DELETE CASCADE,
            task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_required BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_node_tasks_node_sort "
        "ON course_node_tasks(node_id, sort_order)"
    )
    op.execute(
        "DO $$ BEGIN "
        "ALTER TABLE course_node_tasks "
        "ADD CONSTRAINT uq_course_node_tasks_node_task UNIQUE (node_id, task_id); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$"
    )

    # --- New table: user_course_progress (replacement, new schema) ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_course_progress (
            id                    SERIAL PRIMARY KEY,
            user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id             INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            progress_percent      FLOAT NOT NULL DEFAULT 0.0,
            completed_tasks_count INTEGER NOT NULL DEFAULT 0,
            total_tasks_count     INTEGER NOT NULL DEFAULT 0,
            current_node_id       INTEGER REFERENCES course_nodes(id) ON DELETE SET NULL,
            last_task_id          INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_course_progress_user_course "
        "ON user_course_progress(user_id, course_id)"
    )

    # --- Enum for node_task_progress_status ---
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE node_task_progress_status AS ENUM "
        "('not_started', 'in_progress', 'completed'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$"
    )

    # --- New table: user_course_node_task_progress ---
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_course_node_task_progress (
            id                  SERIAL PRIMARY KEY,
            user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            node_task_id        INTEGER NOT NULL REFERENCES course_node_tasks(id) ON DELETE CASCADE,
            status              node_task_progress_status NOT NULL DEFAULT 'not_started',
            best_submission_id  INTEGER REFERENCES submissions(id) ON DELETE SET NULL,
            completed_at        TIMESTAMPTZ,
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS "
        "ix_user_course_node_task_progress_user_node_task "
        "ON user_course_node_task_progress(user_id, node_task_id)"
    )


def downgrade() -> None:
    op.execute(
        "DROP INDEX IF EXISTS "
        "ix_user_course_node_task_progress_user_node_task"
    )
    op.execute("DROP TABLE IF EXISTS user_course_node_task_progress")
    op.execute("DROP TYPE IF EXISTS node_task_progress_status")

    op.execute(
        "DROP INDEX IF EXISTS ix_user_course_progress_user_course"
    )
    op.execute("DROP TABLE IF EXISTS user_course_progress")

    op.execute("DROP INDEX IF EXISTS ix_course_node_tasks_node_sort")
    op.execute("DROP TABLE IF EXISTS course_node_tasks CASCADE")

    op.execute("DROP INDEX IF EXISTS ix_course_nodes_course_parent_sort")
    op.execute("DROP INDEX IF EXISTS ix_course_nodes_parent_id")
    op.execute("DROP INDEX IF EXISTS ix_course_nodes_course_id")

    # Restore status column on course_nodes (minimal downgrade)
    op.execute("ALTER TABLE course_nodes DROP COLUMN IF EXISTS status")
    op.execute(
        "ALTER TABLE course_nodes "
        "ADD COLUMN IF NOT EXISTS status VARCHAR(16)"
    )

    # Restore is_visible in courses (minimal downgrade)
    op.execute(
        "ALTER TABLE courses "
        "ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true"
    )
