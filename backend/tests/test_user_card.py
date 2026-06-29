from __future__ import annotations

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _build_course_with_two_tasks(db: AsyncSession, student_id: int):
    from app.models.course import Course, CourseStatus
    from app.models.course_node import CourseNode, CourseNodeStatus, CourseNodeType
    from app.models.course_node_task import CourseNodeTask
    from app.models.task import RunnerType, Task, TaskStatus, TaskType
    from app.models.user_course_enrollment import UserCourseEnrollment
    from app.models.user_course_node_task_progress import (
        NodeTaskProgressStatus,
        UserCourseNodeTaskProgress,
    )
    from app.models.user_login_event import UserLoginEvent

    course = Course(title="Python с нуля", status=CourseStatus.published, sort_order=1)
    db.add(course)
    await db.flush()

    node = CourseNode(
        course_id=course.id, parent_id=None, type=CourseNodeType.module,
        title="Модуль 1", sort_order=1, status=CourseNodeStatus.published,
    )
    db.add(node)
    await db.flush()

    t1 = Task(title="Задача A", task_type=TaskType.python_io, runner_type=RunnerType.stdin_runner, status=TaskStatus.published)
    t2 = Task(title="Задача B", task_type=TaskType.python_io, runner_type=RunnerType.stdin_runner, status=TaskStatus.published)
    db.add_all([t1, t2])
    await db.flush()

    nt1 = CourseNodeTask(node_id=node.id, task_id=t1.id, sort_order=1)
    nt2 = CourseNodeTask(node_id=node.id, task_id=t2.id, sort_order=2)
    db.add_all([nt1, nt2])
    await db.flush()

    db.add(UserCourseEnrollment(user_id=student_id, course_id=course.id))
    # первая задача пройдена, вторая нет
    db.add(UserCourseNodeTaskProgress(
        user_id=student_id, node_task_id=nt1.id,
        status=NodeTaskProgressStatus.completed,
        completed_at=datetime(2026, 6, 24, 14, 30, tzinfo=timezone.utc),
    ))
    db.add(UserLoginEvent(user_id=student_id, event_type="login"))
    await db.flush()
    return course


@pytest.mark.asyncio
async def test_user_course_progress_card(client: AsyncClient, db: AsyncSession, admin_headers, student_user):
    await _build_course_with_two_tasks(db, student_user.id)

    resp = await client.get(f"/api/users/{student_user.id}/course-progress", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_tasks"] == 2
    assert data["total_passed"] == 1
    assert data["last_online"] is not None
    assert len(data["courses"]) == 1

    block = data["courses"][0]
    assert block["course_title"] == "Python с нуля"
    assert block["passed"] == 1
    assert block["total"] == 2
    assert [t["task_title"] for t in block["tasks"]] == ["Задача A", "Задача B"]
    assert block["tasks"][0]["completed"] is True
    assert block["tasks"][0]["completed_at"] is not None
    assert block["tasks"][1]["completed"] is False
    assert block["tasks"][1]["completed_at"] is None


@pytest.mark.asyncio
async def test_user_course_progress_no_courses(client: AsyncClient, admin_headers, student_user):
    resp = await client.get(f"/api/users/{student_user.id}/course-progress", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_tasks"] == 0
    assert data["total_passed"] == 0
    assert data["courses"] == []


@pytest.mark.asyncio
async def test_user_course_progress_requires_admin(client: AsyncClient, student_headers, student_user):
    resp = await client.get(f"/api/users/{student_user.id}/course-progress", headers=student_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_user_course_progress_404(client: AsyncClient, admin_headers):
    resp = await client.get("/api/users/999999/course-progress", headers=admin_headers)
    assert resp.status_code == 404
