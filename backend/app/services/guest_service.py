"""Гостевой (демо) режим: конфигурация, доступ к задачам, очистка.

Личность гостя определяется по зарезервированному префиксу логина, поэтому
новых колонок в БД не требуется. Конфиг хранится в platform_settings
одним JSON-значением под ключом ``guest_mode``.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course import Course, CourseStatus
from app.models.course_node import CourseNode, CourseNodeStatus
from app.models.platform_settings import PlatformSetting
from app.models.user import GUEST_LOGIN_PREFIX as GUEST_PREFIX, User

GUEST_SETTINGS_KEY = "guest_mode"
# Через сколько эфемерные гости считаются устаревшими и подлежат удалению.
GUEST_TTL = timedelta(hours=6)

DEFAULT_CONFIG = {"enabled": False, "task_limit": 3, "course_ids": []}


def is_guest_login(login: str) -> bool:
    return login.startswith(GUEST_PREFIX)


async def get_guest_config(db: AsyncSession) -> dict:
    """Возвращает {enabled: bool, task_limit: int, course_ids: list[int]}."""
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == GUEST_SETTINGS_KEY)
    )
    row = result.scalar_one_or_none()
    if not row or not row.value:
        return dict(DEFAULT_CONFIG)
    try:
        data = json.loads(row.value)
    except (json.JSONDecodeError, TypeError):
        return dict(DEFAULT_CONFIG)
    return {
        "enabled": bool(data.get("enabled", False)),
        "task_limit": max(0, int(data.get("task_limit", DEFAULT_CONFIG["task_limit"]))),
        "course_ids": [int(c) for c in data.get("course_ids", []) if str(c).strip()],
    }


async def set_guest_config(
    db: AsyncSession, *, enabled: bool, task_limit: int, course_ids: List[int]
) -> dict:
    config = {
        "enabled": bool(enabled),
        "task_limit": max(0, int(task_limit)),
        "course_ids": [int(c) for c in course_ids],
    }
    payload = json.dumps(config)
    result = await db.execute(
        select(PlatformSetting).where(PlatformSetting.key == GUEST_SETTINGS_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = payload
    else:
        db.add(PlatformSetting(key=GUEST_SETTINGS_KEY, value=payload))
    await db.flush()
    return config


async def ordered_course_task_ids(db: AsyncSession, course_id: int) -> List[int]:
    """Плоский список task_id курса в порядке обхода дерева.

    Порядок совпадает с тем, как фронтенд строит список задач:
    узлы по sort_order (DFS), внутри узла — задачи по sort_order. Только
    опубликованные узлы. Каждая задача учитывается один раз (первое вхождение).
    """
    result = await db.execute(
        select(CourseNode)
        .options(selectinload(CourseNode.node_tasks))
        .where(CourseNode.course_id == course_id)
        .order_by(CourseNode.sort_order, CourseNode.id)
    )
    nodes = result.scalars().all()

    children_by_parent: dict[int | None, list[CourseNode]] = {}
    for node in nodes:
        children_by_parent.setdefault(node.parent_id, []).append(node)

    ordered: List[int] = []
    seen: set[int] = set()

    def walk(parent_id):
        for node in children_by_parent.get(parent_id, []):
            if node.status != CourseNodeStatus.published:
                continue
            node_tasks = sorted(
                node.node_tasks, key=lambda nt: (nt.sort_order, nt.id)
            )
            for nt in node_tasks:
                if nt.task_id not in seen:
                    seen.add(nt.task_id)
                    ordered.append(nt.task_id)
            walk(node.id)

    # node_tasks загружаем лениво — гарантируем доступность через selectinload в вызове
    walk(None)
    return ordered


async def is_task_allowed_for_guest(db: AsyncSession, task_id: int, config: dict) -> bool:
    """Задача доступна гостю, если входит в первые N задач хотя бы одного
    разрешённого курса."""
    if not config.get("enabled"):
        return False
    limit = config.get("task_limit", 0)
    if limit <= 0:
        return False
    for course_id in config.get("course_ids", []):
        # курс должен быть опубликован
        r = await db.execute(
            select(Course.id).where(
                Course.id == course_id, Course.status == CourseStatus.published
            )
        )
        if r.scalar_one_or_none() is None:
            continue
        ordered = await ordered_course_task_ids(db, course_id)
        if task_id in ordered[:limit]:
            return True
    return False


async def create_guest_user(db: AsyncSession) -> User:
    """Создаёт эфемерного гостя со случайным логином/паролем."""
    from app.services.auth_service import hash_password
    from app.models.user import UserRole, UserStatus

    login = f"{GUEST_PREFIX}{uuid.uuid4().hex[:16]}"
    user = User(
        login=login,
        password_hash=hash_password(uuid.uuid4().hex),
        role=UserRole.student,
        status=UserStatus.active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def cleanup_stale_guests(db: AsyncSession) -> None:
    """Best-effort удаление устаревших гостей. Любые ошибки игнорируются,
    чтобы не ломать вход новых гостей."""
    try:
        cutoff = datetime.now(timezone.utc) - GUEST_TTL
        result = await db.execute(
            select(User).where(
                User.login.like(f"{GUEST_PREFIX}%"),
                User.created_at < cutoff,
            )
        )
        for user in result.scalars().all():
            await db.delete(user)
        await db.flush()
    except Exception:
        pass
