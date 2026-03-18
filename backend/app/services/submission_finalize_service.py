from __future__ import annotations

from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.submission import Submission, SubmissionStatus, Verdict
from app.models.submission_test import SubmissionTest
from app.schemas.submission import SubmissionCompleteIn
from app.services.course_progress_service import mark_task_completed_in_courses
from app.services.progress_service import update_progress


async def get_submission(db: AsyncSession, submission_id: int) -> Optional[Submission]:
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    return result.scalar_one_or_none()


async def mark_submission_running(db: AsyncSession, submission_id: int) -> Optional[Submission]:
    submission = await get_submission(db, submission_id)
    if submission is None:
        return None
    if submission.status != SubmissionStatus.finished:
        submission.status = SubmissionStatus.running
        await db.flush()
    return submission


async def finalize_submission(db: AsyncSession, submission: Submission, body: SubmissionCompleteIn) -> None:
    if submission.status == SubmissionStatus.finished and submission.verdict is not None:
        return

    submission.status = SubmissionStatus.finished
    submission.verdict = body.verdict
    submission.runtime = body.runtime
    submission.memory = body.memory
    submission.error_output = body.error_output

    await db.execute(delete(SubmissionTest).where(SubmissionTest.submission_id == submission.id))

    for tr in body.test_results:
        db.add(
            SubmissionTest(
                submission_id=submission.id,
                test_id=tr.test_id,
                verdict=tr.verdict,
                runtime=tr.runtime,
                actual_output=tr.actual_output,
            )
        )

    await update_progress(
        db,
        user_id=submission.user_id,
        task_id=submission.task_id,
        submission_id=submission.id,
        verdict=body.verdict.value,
    )
    # Если решение успешное, обновляем прогресс по курсам/узлам
    if body.verdict == Verdict.AC:
        await mark_task_completed_in_courses(
            db,
            user_id=submission.user_id,
            task_id=submission.task_id,
            submission_id=submission.id,
        )
    await db.flush()
