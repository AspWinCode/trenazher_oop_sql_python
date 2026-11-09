from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field

from app.models.submission import SubmissionStatus, Verdict
from app.models.task_test import TestType


class SubmissionCreate(BaseModel):
    task_id: int
    code: Optional[str] = Field(None, max_length=100_000)
    # Student's answer for interactive exercises; shape depends on the task's mechanic.
    answer_data: Optional[Any] = None


class SubmissionOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    code: Optional[str] = None
    answer_data: Optional[Any] = None
    status: SubmissionStatus
    verdict: Optional[Verdict]
    runtime: Optional[float]
    memory: Optional[float]
    error_output: Optional[str]
    score: Optional[float] = None
    max_score: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionTestOut(BaseModel):
    id: int
    test_id: int
    verdict: Optional[Verdict]
    runtime: Optional[float]
    actual_output: Optional[str]
    test_type: Optional[TestType] = None
    input_data: Optional[str] = None
    expected_output: Optional[str] = None

    model_config = {"from_attributes": True}


class SubmissionDetailOut(SubmissionOut):
    task_type: str = ""
    mechanic: Optional[str] = None
    grading_details: Optional[Any] = None
    test_results: List[SubmissionTestOut] = []


class SubmissionExecutionTest(BaseModel):
    id: int
    test_type: str
    input_data: Optional[str] = None
    expected_output: Optional[str] = None
    verification_sql: Optional[str] = None
    test_files: Optional[List] = None  # [{"name": "data.csv", "content": "..."}]
    weight: float = 1.0
    order_index: int = 0


class SubmissionExecutionPayload(BaseModel):
    submission_id: int
    user_id: int
    task_id: int
    task_type: str
    runner_type: str
    code: str
    sql_schema: Optional[str] = None
    sql_seed: Optional[str] = None
    tests: List[SubmissionExecutionTest] = []


class SubmissionTestResultIn(BaseModel):
    test_id: int
    verdict: Verdict
    runtime: Optional[float] = None
    actual_output: Optional[str] = None
    expected_output: Optional[str] = None


class SubmissionCompleteIn(BaseModel):
    verdict: Verdict
    runtime: Optional[float] = None
    memory: Optional[float] = None
    error_output: Optional[str] = None
    test_results: List[SubmissionTestResultIn] = []
    # Only populated by synchronous interactive-exercise grading; the external
    # Judger never sends these, so they default to None for code submissions.
    score: Optional[float] = None
    max_score: Optional[float] = None
    grading_details: Optional[Any] = None
