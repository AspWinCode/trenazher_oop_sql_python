from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.metrics import SUBMISSIONS_TOTAL, SUBMISSIONS_VERDICT, SUBMISSION_LATENCY
from app.middleware.auth_middleware import (
    get_current_user,
    require_judger_internal_token,
)
from app.middleware.rate_limiter import submission_limiter
from app.models.submission import Submission
from app.models.submission_test import SubmissionTest
from app.models.user import User
from app.schemas.submission import (
    SubmissionCompleteIn,
    SubmissionCreate,
    SubmissionDetailOut,
    SubmissionOut,
    SubmissionTestOut,
)
from app.services.submission_events import publish_submission_update
from app.services.submission_finalize_service import (
    finalize_submission,
    get_submission,
    mark_submission_running,
)
from app.services.submission_lifecycle_service import create_submission_and_enqueue

router = APIRouter()


def _submission_event(submission: Submission) -> dict:
    return {
        "type": "submission_update",
        "submission_id": submission.id,
        "user_id": submission.user_id,
        "status": submission.status.value,
        "verdict": submission.verdict.value if submission.verdict else None,
        "runtime": submission.runtime,
        "memory": submission.memory,
        "error_output": submission.error_output,
    }


@router.post("", response_model=SubmissionOut, status_code=201)
async def submit_solution(
    body: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    allowed, _ = submission_limiter.check("ratelimit:submission:{}".format(user.id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many submissions. Please wait before trying again.",
        )
    if user.is_guest:
        from app.services.guest_service import get_guest_config, is_task_allowed_for_guest

        config = await get_guest_config(db)
        if not await is_task_allowed_for_guest(db, body.task_id, config):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Эта задача недоступна в демо-режиме. Зарегистрируйтесь для полного доступа.",
            )
    try:
        submission, task_type = await create_submission_and_enqueue(
            db,
            user_id=user.id,
            task_id=body.task_id,
            code=body.code,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Task not found")

    SUBMISSIONS_TOTAL.labels(task_type=task_type).inc()
    return SubmissionOut.model_validate(submission)


@router.get("/{submission_id}", response_model=SubmissionDetailOut)
async def get_submission_detail(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.test_results).selectinload(SubmissionTest.test),
            selectinload(Submission.task),
        )
        .where(Submission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.user_id != user.id and user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    is_admin = user.role.value == "admin"
    # IO-задачи: expected_output в задаче — литеральный ожидаемый вывод, его можно
    # показать. У oop/sql/numpy в этом поле лежит код теста/SQL — НЕ показываем.
    io_task_types = {"python_io", "cpp_io", "js_io"}
    task_type_value = submission.task.task_type.value if submission.task else ""
    is_io_task = task_type_value in io_task_types
    test_results = []
    for tr in submission.test_results:
        is_public = bool(tr.test and tr.test.test_type.value == "public")
        # Эталон, вычисленный раннером (строки SQL и т.п.) — безопасное содержимое;
        # литеральный expected из задачи годится только для IO-типов. У pytest
        # (oop/numpy) в expected_output лежит КОД теста — его не показываем никому
        # (даже админу), чтобы фронт показал «Разбор ошибки», а не код теста.
        runner_expected = tr.expected_output
        cfg_expected = tr.test.expected_output if tr.test else None
        meaningful_expected = runner_expected or (cfg_expected if is_io_task else None)
        # скрытые тесты эталон не раскрывают студенту (чтобы нельзя было захардкодить)
        if is_admin or is_public:
            expected = meaningful_expected
        else:
            expected = None
        t = SubmissionTestOut(
            id=tr.id,
            test_id=tr.test_id,
            verdict=tr.verdict,
            runtime=tr.runtime,
            actual_output=tr.actual_output,
            test_type=tr.test.test_type if tr.test else None,
            # input_data — по-прежнему только админу
            input_data=tr.test.input_data if (tr.test and is_admin) else None,
            expected_output=expected,
        )
        test_results.append(t)

    out = SubmissionDetailOut.model_validate(submission)
    out.task_type = submission.task.task_type.value if submission.task else ""
    out.test_results = test_results
    if submission.verdict:
        SUBMISSIONS_VERDICT.labels(verdict=submission.verdict.value).inc()
    if submission.runtime is not None:
        SUBMISSION_LATENCY.observe(submission.runtime)
    return out


@router.get("", response_model=List[SubmissionOut])
async def list_submissions(
    task_id: Optional[int] = None,
    offset: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = min(limit, 100)
    q = select(Submission).order_by(Submission.created_at.desc())
    if user.role.value != "admin":
        q = q.where(Submission.user_id == user.id)
    if task_id is not None:
        q = q.where(Submission.task_id == task_id)
    q = q.offset(offset).limit(limit)
    result = await db.execute(q)
    return [SubmissionOut.model_validate(s) for s in result.scalars().all()]


@router.post(
    "/internal/{submission_id}/start",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def start_submission_internal(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_judger_internal_token),
):
    submission = await mark_submission_running(db, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    await publish_submission_update(_submission_event(submission))


@router.post(
    "/internal/{submission_id}/complete",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def complete_submission_internal(
    submission_id: int,
    body: SubmissionCompleteIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_judger_internal_token),
):
    submission = await get_submission(db, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    await finalize_submission(db, submission, body)
    await publish_submission_update(_submission_event(submission))
