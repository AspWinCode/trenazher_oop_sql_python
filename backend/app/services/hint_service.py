from __future__ import annotations

from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student_progress import StudentProgress
from app.models.task_hint import TaskHint


async def get_available_hints(db: AsyncSession, user_id: int, task_id: int) -> List[TaskHint]:
    prog_result = await db.execute(
        select(StudentProgress).where(
            StudentProgress.user_id == user_id,
            StudentProgress.task_id == task_id,
        )
    )
    progress = prog_result.scalar_one_or_none()
    attempts = progress.attempts if progress else 0

    hints_result = await db.execute(
        select(TaskHint)
        .where(TaskHint.task_id == task_id, TaskHint.unlock_attempts <= attempts)
        .order_by(TaskHint.hint_level)
    )
    return list(hints_result.scalars().all())
