from __future__ import annotations

import requests

from judger.config import BACKEND_INTERNAL_URL, BACKEND_REQUEST_TIMEOUT, JUDGER_INTERNAL_TOKEN


def _headers() -> dict[str, str]:
    return {"X-Judger-Token": JUDGER_INTERNAL_TOKEN}


def mark_submission_running(submission_id: int) -> None:
    resp = requests.post(
        f"{BACKEND_INTERNAL_URL}/{submission_id}/start",
        headers=_headers(),
        timeout=BACKEND_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()


def complete_submission(submission_id: int, payload: dict) -> None:
    resp = requests.post(
        f"{BACKEND_INTERNAL_URL}/{submission_id}/complete",
        headers=_headers(),
        json=payload,
        timeout=BACKEND_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
