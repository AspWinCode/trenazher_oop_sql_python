"""Interactive exercises: mechanic/config on tasks, answer/score on submissions.

Revision ID: 019
Revises: 018
Create Date: 2026-11-09
"""
from alembic import op
import sqlalchemy as sa

revision = '019'
down_revision = '018'
branch_labels = None
depends_on = None


def upgrade():
    # --- tasks: interactive-exercise fields ---
    op.add_column('tasks', sa.Column('mechanic', sa.String(50), nullable=True))
    op.add_column('tasks', sa.Column('interactive_config', sa.JSON(), nullable=True))

    # New enum values. Postgres 12+ allows ADD VALUE ... IF NOT EXISTS inside a
    # transaction, which is what Alembic runs each migration in by default here.
    op.execute("ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'interactive'")
    op.execute("ALTER TYPE runnertype ADD VALUE IF NOT EXISTS 'interactive_runner'")

    # --- submissions: answer payload + partial-credit score ---
    op.alter_column('submissions', 'code', existing_type=sa.Text(), nullable=True)
    op.add_column('submissions', sa.Column('answer_data', sa.JSON(), nullable=True))
    op.add_column('submissions', sa.Column('score', sa.Float(), nullable=True))
    op.add_column('submissions', sa.Column('max_score', sa.Float(), nullable=True))
    op.add_column('submissions', sa.Column('grading_details', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('submissions', 'grading_details')
    op.drop_column('submissions', 'max_score')
    op.drop_column('submissions', 'score')
    op.drop_column('submissions', 'answer_data')
    # Only safe if no submission ever ended up with a NULL code (i.e. no
    # interactive submissions exist yet) — accepted limitation of this downgrade.
    op.alter_column('submissions', 'code', existing_type=sa.Text(), nullable=False)

    op.drop_column('tasks', 'interactive_config')
    op.drop_column('tasks', 'mechanic')
    # Postgres cannot drop a single enum value (ALTER TYPE ... DROP VALUE does not
    # exist) — the 'interactive'/'interactive_runner' enum labels are left in place
    # on downgrade. This is a known, accepted one-way part of the migration.
