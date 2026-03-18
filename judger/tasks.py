from __future__ import annotations

import logging

from judger.backend_client import complete_submission, mark_submission_running
from judger.runners.base_runner import RunResult
from judger.runners.cpp_runner import CppRunner
from judger.runners.js_runner import JSRunner
from judger.runners.python_io_runner import PythonIORunner
from judger.runners.python_numpy_runner import PythonNumPyRunner
from judger.runners.python_oop_runner import PythonOOPRunner
from judger.runners.sql_runner import SQLRunner
from judger.worker import celery

log = logging.getLogger(__name__)


def _to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_tests(raw_tests) -> list[dict]:
    if not isinstance(raw_tests, list):
        return []

    normalized = []
    for test in raw_tests:
        if not isinstance(test, dict):
            continue
        normalized.append(
            {
                "id": _to_int(test.get("id")),
                "test_type": str(test.get("test_type", "public")),
                "input_data": test.get("input_data"),
                "expected_output": test.get("expected_output"),
                "weight": float(test.get("weight", 1.0)),
                "order_index": _to_int(test.get("order_index"), 0),
            }
        )

    return sorted(normalized, key=lambda item: item["order_index"])


def _run_submission(submission_payload: dict, runner_cls) -> RunResult:
    runner = runner_cls()
    tests = _normalize_tests(submission_payload.get("tests", []))

    return runner.run(
        submission_payload.get("code", ""),
        tests,
        sql_schema=submission_payload.get("sql_schema", "") or "",
        sql_seed=submission_payload.get("sql_seed", "") or "",
    )


def _completion_payload(result: RunResult) -> dict:
    return {
        "verdict": result.verdict,
        "runtime": result.runtime,
        "memory": result.memory,
        "error_output": result.error_output or None,
        "test_results": [
            {
                "test_id": tr.test_id,
                "verdict": tr.verdict,
                "runtime": tr.runtime,
                "actual_output": tr.actual_output or None,
            }
            for tr in result.test_results
        ],
    }


def _process_submission(submission_payload: dict, runner_cls):
    submission_id = _to_int(submission_payload.get("submission_id"))
    if submission_id <= 0:
        raise ValueError("Invalid submission payload: submission_id")

    try:
        mark_submission_running(submission_id)
    except Exception:
        log.exception("Failed to mark submission %d as running", submission_id)

    try:
        result = _run_submission(submission_payload, runner_cls)
        log.info("Submission %d finished: %s", submission_id, result.verdict)
    except Exception as exc:
        log.exception("Error processing submission %d", submission_id)
        result = RunResult(verdict="IE", error_output=str(exc)[:2000])

    complete_submission(submission_id, _completion_payload(result))


@celery.task(name="judger.tasks.run_python_io")
def run_python_io(submission_payload: dict):
    _process_submission(submission_payload, PythonIORunner)


@celery.task(name="judger.tasks.run_pytest")
def run_pytest(submission_payload: dict):
    _process_submission(submission_payload, PythonOOPRunner)


@celery.task(name="judger.tasks.run_python_numpy")
def run_python_numpy(submission_payload: dict):
    _process_submission(submission_payload, PythonNumPyRunner)


@celery.task(name="judger.tasks.run_sql")
def run_sql(submission_payload: dict):
    _process_submission(submission_payload, SQLRunner)


@celery.task(name="judger.tasks.run_cpp")
def run_cpp(submission_payload: dict):
    _process_submission(submission_payload, CppRunner)


@celery.task(name="judger.tasks.run_js")
def run_js(submission_payload: dict):
    _process_submission(submission_payload, JSRunner)
