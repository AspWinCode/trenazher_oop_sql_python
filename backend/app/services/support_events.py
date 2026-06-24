"""Публикация событий поддержки в Redis pub/sub.

Зеркало submission_events: WS-листенер ([app.api.ws]) подписан на этот канал и
доставляет события подключённым клиентам (студенту — ответ менеджера, админам —
сигнал о новом вопросе/обновлении бейджа).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from app.config import settings

log = logging.getLogger(__name__)

_CHANNEL = "support_updates"


async def publish_support_event(payload: dict[str, Any]) -> None:
    try:
        import redis.asyncio as redis

        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await client.publish(_CHANNEL, json.dumps(payload, default=str))
        finally:
            await client.aclose()
    except Exception:
        log.warning("Failed to publish support event", exc_info=True)


def support_updates_channel() -> str:
    return _CHANNEL
