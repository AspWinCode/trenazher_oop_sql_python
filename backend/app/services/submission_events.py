from __future__ import annotations

import json
import logging
from typing import Any

from app.config import settings
from app.models.submission import Submission

log = logging.getLogger(__name__)

_CHANNEL = "submission_updates"


def build_submission_event(submission: Submission) -> dict[str, Any]:
    """Shared WS payload shape, used both by the Judger-backed internal endpoints
    and by synchronous interactive-exercise grading."""
    return {
        "type": "submission_update",
        "submission_id": submission.id,
        "user_id": submission.user_id,
        "status": submission.status.value,
        "verdict": submission.verdict.value if submission.verdict else None,
        "runtime": submission.runtime,
        "memory": submission.memory,
        "error_output": submission.error_output,
        "score": submission.score,
        "max_score": submission.max_score,
    }


async def publish_submission_update(payload: dict[str, Any]) -> None:
    try:
        import redis.asyncio as redis

        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await client.publish(_CHANNEL, json.dumps(payload, default=str))
        finally:
            await client.aclose()
    except Exception:
        log.warning("Failed to publish submission update", exc_info=True)


def submission_updates_channel() -> str:
    return _CHANNEL
