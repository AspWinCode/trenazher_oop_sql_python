"""Агрегации для админ-дашборда метрик платформы (Фаза 1).

Все запросы портируемы между postgres (прод) и sqlite (тесты): группировка по
месяцам делается в Python, без date_trunc. Гости (login LIKE 'guest_%')
исключаются из всех метрик.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.submission import Submission, Verdict
from app.models.task import Task
from app.models.user import GUEST_LOGIN_PREFIX, User
from app.models.user_login_event import UserLoginEvent

TASK_TYPE_LABELS = {
    "python_io": "Python (ввод-вывод)",
    "python_oop": "ООП",
    "python_numpy": "NumPy",
    "sql_query": "SQL",
    "cpp_io": "C++",
    "js_io": "JavaScript",
}

_GUEST_LIKE = f"{GUEST_LOGIN_PREFIX}%"


def _month_key(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


async def _registrations(db: AsyncSession, months: int = 12) -> list[dict]:
    """Регистрации по месяцам (последние `months`) с накопительным итогом.

    Бакетинг в Python ради переносимости (sqlite в тестах не умеет date_trunc)."""
    result = await db.execute(
        select(User.created_at).where(User.login.not_like(_GUEST_LIKE))
    )
    created = [row[0] for row in result.all() if row[0] is not None]

    per_month: dict[str, int] = defaultdict(int)
    for dt in created:
        per_month[_month_key(dt)] += 1

    now = datetime.now(timezone.utc)
    # последовательность последних N месяцев (включая текущий)
    keys: list[str] = []
    y, m = now.year, now.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()

    # накопительный итог считаем по ВСЕМ месяцам до начала окна
    before_window = sum(c for k, c in per_month.items() if k < keys[0])
    series: list[dict] = []
    running = before_window
    for k in keys:
        running += per_month.get(k, 0)
        series.append({"month": k, "count": per_month.get(k, 0), "cumulative": running})
    return series


async def _top_tasks(db: AsyncSession, limit: int = 10) -> dict:
    """Топ задач по числу отправок и по числу неверных попыток (без гостей)."""
    base = (
        select(
            Submission.task_id,
            Task.title,
            func.count(Submission.id).label("total"),
        )
        .join(User, User.id == Submission.user_id)
        .join(Task, Task.id == Submission.task_id)
        .where(User.login.not_like(_GUEST_LIKE))
        .group_by(Submission.task_id, Task.title)
    )

    most_attempted_q = base.order_by(func.count(Submission.id).desc()).limit(limit)
    r1 = await db.execute(most_attempted_q)
    most_attempted = [
        {"task_id": tid, "title": title, "submissions": total}
        for tid, title, total in r1.all()
    ]

    wrong_q = (
        select(
            Submission.task_id,
            Task.title,
            func.count(Submission.id).label("wrong"),
        )
        .join(User, User.id == Submission.user_id)
        .join(Task, Task.id == Submission.task_id)
        .where(User.login.not_like(_GUEST_LIKE), Submission.verdict != Verdict.AC)
        .group_by(Submission.task_id, Task.title)
        .order_by(func.count(Submission.id).desc())
        .limit(limit)
    )
    r2 = await db.execute(wrong_q)
    most_failed = [
        {"task_id": tid, "title": title, "wrong_attempts": wrong}
        for tid, title, wrong in r2.all()
    ]

    return {"most_attempted": most_attempted, "most_failed": most_failed}


async def _sections(db: AsyncSession) -> list[dict]:
    """Активность по разделам (тип задачи): число отправок и решавших."""
    q = (
        select(
            Task.task_type,
            func.count(Submission.id).label("submissions"),
            func.count(func.distinct(Submission.user_id)).label("solvers"),
        )
        .join(User, User.id == Submission.user_id)
        .join(Task, Task.id == Submission.task_id)
        .where(User.login.not_like(_GUEST_LIKE))
        .group_by(Task.task_type)
        .order_by(func.count(Submission.id).desc())
    )
    result = await db.execute(q)
    sections = []
    for task_type, submissions, solvers in result.all():
        key = task_type.value if hasattr(task_type, "value") else str(task_type)
        sections.append(
            {
                "task_type": key,
                "label": TASK_TYPE_LABELS.get(key, key),
                "submissions": submissions,
                "solvers": solvers,
            }
        )
    return sections


async def _active_audience(db: AsyncSession) -> dict:
    """Активная аудитория за 30 дней и вовлечённость (сессии/мес на активного).

    Сессия = событие login или session_start. Гости исключены."""
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    active_30d_q = (
        select(func.count(func.distinct(UserLoginEvent.user_id)))
        .join(User, User.id == UserLoginEvent.user_id)
        .where(
            User.login.not_like(_GUEST_LIKE),
            UserLoginEvent.created_at >= cutoff_30d,
        )
    )
    active_30d = (await db.execute(active_30d_q)).scalar_one() or 0

    sessions_q = (
        select(func.count(UserLoginEvent.id))
        .join(User, User.id == UserLoginEvent.user_id)
        .where(
            User.login.not_like(_GUEST_LIKE),
            UserLoginEvent.created_at >= month_start,
        )
    )
    sessions_month = (await db.execute(sessions_q)).scalar_one() or 0

    active_month_q = (
        select(func.count(func.distinct(UserLoginEvent.user_id)))
        .join(User, User.id == UserLoginEvent.user_id)
        .where(
            User.login.not_like(_GUEST_LIKE),
            UserLoginEvent.created_at >= month_start,
        )
    )
    active_month = (await db.execute(active_month_q)).scalar_one() or 0

    avg = round(sessions_month / active_month, 2) if active_month else 0.0
    return {
        "active_users_30d": active_30d,
        "engagement": {
            "sessions_this_month": sessions_month,
            "active_users_this_month": active_month,
            "avg_sessions_per_user": avg,
        },
    }


async def get_platform_metrics(db: AsyncSession) -> dict:
    total_users_r = await db.execute(
        select(func.count(User.id)).where(User.login.not_like(_GUEST_LIKE))
    )
    total_users = total_users_r.scalar_one()

    registrations = await _registrations(db)
    tasks = await _top_tasks(db)
    sections = await _sections(db)
    audience = await _active_audience(db)

    return {
        "total_users": total_users,
        "active_users_30d": audience["active_users_30d"],
        "engagement": audience["engagement"],
        "registrations": registrations,
        "tasks": tasks,
        "sections": sections,
    }
