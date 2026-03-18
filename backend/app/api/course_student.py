"""Student API: course progress and node-task progress."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.course import Course, CourseStatus
from app.models.course_node import CourseNode, CourseNodeStatus
from app.models.course_node_task import CourseNodeTask
from app.models.task import TaskStatus
from app.models.user import User
from app.models.user_course_node_task_progress import UserCourseNodeTaskProgress
from app.models.user_course_progress import UserCourseProgress
from app.schemas.course_hierarchy import (
    UserCourseProgressOut,
    UserNodeTaskProgressOut,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/courses/{course_id}/progress", response_model=UserCourseProgressOut)
async def student_get_course_progress(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Общий прогресс пользователя по курсу."""
    r_course = await db.execute(select(Course).where(Course.id == course_id))
    course = r_course.scalar_one_or_none()
    if not course or course.status != CourseStatus.published:
        raise HTTPException(status_code=404, detail="Course not found")

    r = await db.execute(
        select(UserCourseProgress).where(
            UserCourseProgress.user_id == user.id,
            UserCourseProgress.course_id == course_id,
        )
    )
    p = r.scalar_one_or_none()
    if not p:
        # По умолчанию прогресс нулевой
        p = UserCourseProgress(
            user_id=user.id,
            course_id=course_id,
            progress_percent=0.0,
            completed_tasks_count=0,
            total_tasks_count=0,
        )
        db.add(p)
        await db.flush()
    return UserCourseProgressOut.model_validate(p)


@router.get("/nodes/{node_id}/tasks", response_model=List[UserNodeTaskProgressOut])
async def student_get_node_tasks_with_progress(
    node_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Список задач конечного узла с прогрессом пользователя."""
    r_node = await db.execute(
        select(CourseNode)
        .options(selectinload(CourseNode.children))
        .where(CourseNode.id == node_id)
    )
    node = r_node.scalar_one_or_none()
    if not node or node.status != CourseNodeStatus.published:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.children:
        raise HTTPException(status_code=400, detail="Node is not a leaf")

    r_tasks = await db.execute(
        select(CourseNodeTask)
        .options(selectinload(CourseNodeTask.task))
        .where(CourseNodeTask.node_id == node_id)
        .order_by(CourseNodeTask.sort_order, CourseNodeTask.id)
    )
    node_tasks = r_tasks.scalars().all()

    if not node_tasks:
        return []

    task_ids = [nt.id for nt in node_tasks]
    r_progress = await db.execute(
        select(UserCourseNodeTaskProgress).where(
            UserCourseNodeTaskProgress.user_id == user.id,
            UserCourseNodeTaskProgress.node_task_id.in_(task_ids),
        )
    )
    progress_by_node_task = {
        p.node_task_id: p for p in r_progress.scalars().all()
    }

    result: List[UserNodeTaskProgressOut] = []
    for nt in node_tasks:
        p = progress_by_node_task.get(nt.id)
        status = p.status.value if p else "not_started"
        completed_at = p.completed_at if p else None
        result.append(
            UserNodeTaskProgressOut(
                node_task_id=nt.id,
                task_id=nt.task_id,
                status=status,
                completed_at=completed_at,
            )
        )
    return result
