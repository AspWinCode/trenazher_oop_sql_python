"""Запись событий входа/активности для метрик."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_login_event import (
    EVENT_LOGIN,
    EVENT_SESSION_START,
    UserLoginEvent,
)

# Простой более 30 минут считается новой сессией.
SESSION_IDLE = timedelta(minutes=30)


async def log_login(db: AsyncSession, user_id: int) -> None:
    """Явный вход — всегда начало новой сессии."""
    db.add(UserLoginEvent(user_id=user_id, event_type=EVENT_LOGIN))
    await db.flush()


async def record_activity(db: AsyncSession, user_id: int) -> bool:
    """Отметка активности с фронта. Пишет session_start, только если у
    пользователя не было событий более 30 минут. Возвращает True, если
    зафиксирована новая сессия."""
    r = await db.execute(
        select(UserLoginEvent.created_at)
        .where(UserLoginEvent.user_id == user_id)
        .order_by(desc(UserLoginEvent.created_at))
        .limit(1)
    )
    last = r.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if last is not None:
        last_dt = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        if now - last_dt < SESSION_IDLE:
            return False

    db.add(UserLoginEvent(user_id=user_id, event_type=EVENT_SESSION_START))
    await db.flush()
    return True
