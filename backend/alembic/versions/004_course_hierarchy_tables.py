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
    # Enums are already created by migration 003 via DO EXCEPTION blocks.
    # We use raw SQL for table creation to avoid SQLAlchemy auto-emitting
    # CREATE TYPE even when create_type=False (SQLAlchemy 2.0 behaviour).

    op.execute("""
        CREATE TABLE course_nodes (
            id          SERIAL PRIMARY KEY,
            course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            parent_id   INTEGER REFERENCES course_nodes(id) ON DELETE CASCADE,
            type        coursenodetype NOT NULL,
            title       VARCHAR(255) NOT NULL,
            description TEXT,
            content     TEXT,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            status      coursenodestatus NOT NULL DEFAULT 'active',
            is_published BOOLEAN NOT NULL DEFAULT false,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            archived_at TIMESTAMPTZ
        )
    """)

    op.execute("""
        CREATE TABLE topic_steps (
            id          SERIAL PRIMARY KEY,
            node_id     INTEGER NOT NULL REFERENCES course_nodes(id) ON DELETE CASCADE,
            type        topicsteptype NOT NULL,
            title       VARCHAR(255) NOT NULL,
            content     TEXT,
            task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            status      topicstepstatus NOT NULL DEFAULT 'active',
            is_published BOOLEAN NOT NULL DEFAULT false,
            is_required  BOOLEAN NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE user_course_progress (
            id                  SERIAL PRIMARY KEY,
            user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            course_id           INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            completed_steps     INTEGER NOT NULL DEFAULT 0,
            total_steps         INTEGER NOT NULL DEFAULT 0,
            completed_tasks     INTEGER NOT NULL DEFAULT 0,
            total_tasks         INTEGER NOT NULL DEFAULT 0,
            progress_percent    FLOAT   NOT NULL DEFAULT 0.0,
            last_opened_node_id INTEGER REFERENCES course_nodes(id) ON DELETE SET NULL,
            last_opened_step_id INTEGER REFERENCES topic_steps(id) ON DELETE SET NULL,
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ix_user_course_progress_user_course UNIQUE (user_id, course_id)
        )
    """)

    op.execute("""
        CREATE TABLE user_node_progress (
            id                      SERIAL PRIMARY KEY,
            user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            node_id                 INTEGER NOT NULL REFERENCES course_nodes(id) ON DELETE CASCADE,
            completed_steps         INTEGER NOT NULL DEFAULT 0,
            total_steps             INTEGER NOT NULL DEFAULT 0,
            completed_required_tasks INTEGER NOT NULL DEFAULT 0,
            total_required_tasks    INTEGER NOT NULL DEFAULT 0,
            progress_percent        FLOAT   NOT NULL DEFAULT 0.0,
            is_completed            BOOLEAN NOT NULL DEFAULT false,
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ix_user_node_progress_user_node UNIQUE (user_id, node_id)
        )
    """)

    op.execute("""
        CREATE TABLE user_step_progress (
            id           SERIAL PRIMARY KEY,
            user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            step_id      INTEGER NOT NULL REFERENCES topic_steps(id) ON DELETE CASCADE,
            completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT ix_user_step_progress_user_step UNIQUE (user_id, step_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_step_progress")
    op.execute("DROP TABLE IF EXISTS user_node_progress")
    op.execute("DROP TABLE IF EXISTS user_course_progress")
    op.execute("DROP TABLE IF EXISTS topic_steps")
    op.execute("DROP TABLE IF EXISTS course_nodes")
    op.execute("DROP TYPE IF EXISTS topicstepstatus")
    op.execute("DROP TYPE IF EXISTS topicsteptype")
    op.execute("DROP TYPE IF EXISTS coursenodestatus")
    op.execute("DROP TYPE IF EXISTS coursenodetype")
