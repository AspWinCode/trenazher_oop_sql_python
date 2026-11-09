from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.submission import Submission, Verdict
from app.models.task import Task
from app.schemas.submission import SubmissionCompleteIn
from app.services.interactive import get_checker
from app.services.interactive.base import ConfigError
from app.services.submission_events import build_submission_event, publish_submission_update
from app.services.submission_finalize_service import finalize_submission, mark_submission_running


async def grade_interactive_submission(db: AsyncSession, submission: Submission, task: Task) -> None:
    """Synchronous, in-process grading for interactive exercises — no Celery/Judger
    involved. Reuses finalize_submission/publish_submission_update exactly as the
    external Judger does via the internal HTTP endpoints, so progress tracking,
    course completion and the frontend's existing WS flow all keep working
    unchanged."""
    from app.services.interactive.base import CheckResult

    if task.interactive_config is None:
        # Task was never configured by an admin — nothing to grade against.
        result = CheckResult(status="WA", score=0.0, max_score=1.0, details={"error": "task_not_configured"})
    else:
        try:
            checker = get_checker(task.mechanic)
            checker.validate_answer(task.interactive_config, submission.answer_data)
            result = checker.check(task.interactive_config, submission.answer_data)
        except ConfigError:
            result = CheckResult(status="WA", score=0.0, max_score=1.0, details={"error": "invalid_answer_shape"})

    verdict = Verdict.AC if result.status == "AC" else Verdict.WA
    body = SubmissionCompleteIn(
        verdict=verdict,
        runtime=None,
        memory=None,
        error_output=None,
        test_results=[],
        score=result.score,
        max_score=result.max_score,
        grading_details=result.details,
    )

    await mark_submission_running(db, submission.id)
    await finalize_submission(db, submission, body)
    await db.commit()
    await publish_submission_update(build_submission_event(submission))
