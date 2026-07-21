from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth_middleware import require_admin
from app.models.course import Course
from app.models.course_node import CourseNode, CourseNodeStatus
from app.models.course_node_task import CourseNodeTask
from app.models.password_reset_token import PasswordResetToken
from app.models.student_progress import StudentProgress
from app.models.user import User
from app.models.user_course_enrollment import UserCourseEnrollment
from app.models.user_course_node_task_progress import (
    NodeTaskProgressStatus,
    UserCourseNodeTaskProgress,
)
from app.models.user_login_event import UserLoginEvent
from app.schemas.user import (
    ForgotPasswordRequest,
    ResetPassword,
    ResetPasswordByToken,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services.auth_service import hash_password
from app.services.email_service import send_password_reset_email, send_welcome_email

router = APIRouter()


class EnrollmentOut(BaseModel):
    course_id: int
    course_title: str

    model_config = {"from_attributes": True}


class UsersListOut(BaseModel):
    users: List[UserOut]
    total: int


@router.get("", response_model=UsersListOut)
async def list_users(
    page: int = 1,
    limit: int = 50,
    search: str = "",
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    limit = min(max(limit, 1), 200)
    page = max(page, 1)
    offset = (page - 1) * limit

    q = select(User)
    count_q = select(func.count()).select_from(User)

    if search.strip():
        s = f"%{search.strip()}%"
        filt = or_(
            User.login.ilike(s),
            User.email.ilike(s),
            User.full_name.ilike(s),
        )
        q = q.where(filt)
        count_q = count_q.where(filt)

    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(User.id).offset(offset).limit(limit))
    users = [UserOut.model_validate(u) for u in result.scalars().all()]

    return UsersListOut(users=users, total=total)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    from app.models.user import GUEST_LOGIN_PREFIX

    if body.login.startswith(GUEST_LOGIN_PREFIX):
        raise HTTPException(
            status_code=400,
            detail=f"Префикс «{GUEST_LOGIN_PREFIX}» зарезервирован для гостевого режима",
        )
    existing = await db.execute(select(User).where(User.login == body.login))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Login already exists")
    if body.email:
        dup = await db.execute(select(User).where(User.email == body.email))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        login=body.login,
        password_hash=hash_password(body.password),
        role=body.role,
        email=body.email or None,
        full_name=body.full_name or None,
        getcourse_id=body.getcourse_id or None,
    )
    db.add(user)
    try:
        await db.flush()
        await db.refresh(user)
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Логин или email уже существует")
    # Send welcome email if email provided
    if body.email:
        send_welcome_email(body.email, body.login, body.password)
    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if body.email is not None and body.email != user.email:
        dup = await db.execute(select(User).where(User.email == body.email))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
    if body.getcourse_id and body.getcourse_id != user.getcourse_id:
        dup = await db.execute(
            select(User).where(User.getcourse_id == body.getcourse_id, User.id != user_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="GetCourse ID уже привязан к другому пользователю")
    updates = body.model_dump(exclude_unset=True)
    # Пустые строки email/getcourse_id трактуем как очистку поля (None) для сохранения уникальности.
    if "email" in updates and not updates["email"]:
        updates["email"] = None
    if "getcourse_id" in updates and not updates["getcourse_id"]:
        updates["getcourse_id"] = None
    for field, value in updates.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)


@router.post("/{user_id}/reset-password", response_model=UserOut)
async def reset_password(user_id: int, body: ResetPassword, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


# --- Course Enrollments ---

@router.get("/{user_id}/enrollments", response_model=List[EnrollmentOut])
async def list_enrollments(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(UserCourseEnrollment, Course)
        .join(Course, Course.id == UserCourseEnrollment.course_id)
        .where(UserCourseEnrollment.user_id == user_id)
        .order_by(Course.title)
    )
    return [EnrollmentOut(course_id=row.Course.id, course_title=row.Course.title) for row in result.all()]


@router.post("/{user_id}/enrollments/{course_id}", status_code=status.HTTP_201_CREATED)
async def enroll_user(user_id: int, course_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    user_r = await db.execute(select(User).where(User.id == user_id))
    if not user_r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    course_r = await db.execute(select(Course).where(Course.id == course_id))
    if not course_r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")
    existing = await db.execute(
        select(UserCourseEnrollment).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.course_id == course_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"detail": "Already enrolled"}
    enrollment = UserCourseEnrollment(user_id=user_id, course_id=course_id)
    db.add(enrollment)
    await db.flush()
    return {"detail": "Enrolled"}


@router.delete("/{user_id}/enrollments/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_user(user_id: int, course_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(UserCourseEnrollment).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.course_id == course_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if enrollment:
        await db.delete(enrollment)


# --- Student statistics ---

class StudentStatsOut(BaseModel):
    user_id: int
    total_attempts: int
    solved_tasks: int
    in_progress_tasks: int

@router.get("/{user_id}/stats", response_model=StudentStatsOut)
async def get_student_stats(user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(
        select(StudentProgress).where(StudentProgress.user_id == user_id)
    )
    progress_list = result.scalars().all()
    total_attempts = sum(p.attempts for p in progress_list)
    solved_tasks = sum(1 for p in progress_list if p.best_verdict == "AC")
    in_progress_tasks = sum(1 for p in progress_list if p.best_verdict != "AC" and p.attempts > 0)
    return StudentStatsOut(
        user_id=user_id,
        total_attempts=total_attempts,
        solved_tasks=solved_tasks,
        in_progress_tasks=in_progress_tasks,
    )


# --- Per-user course progress (admin card) ---

class CourseTaskProgressOut(BaseModel):
    task_title: str
    completed: bool
    completed_at: Optional[datetime] = None


class CourseProgressBlockOut(BaseModel):
    course_id: int
    course_title: str
    passed: int
    total: int
    tasks: List[CourseTaskProgressOut]


class UserCourseProgressDetailOut(BaseModel):
    user_id: int
    total_tasks: int
    total_passed: int
    last_online: Optional[datetime] = None
    courses: List[CourseProgressBlockOut]


async def _ordered_course_node_tasks(db: AsyncSession, course_id: int):
    """(node_task_id, task_id, title) задач курса в порядке обхода дерева.

    Только опубликованные узлы, дедуп по task_id (первое вхождение) — тот же
    порядок, что видит студент."""
    result = await db.execute(
        select(CourseNode)
        .options(selectinload(CourseNode.node_tasks).selectinload(CourseNodeTask.task))
        .where(
            CourseNode.course_id == course_id,
            CourseNode.status == CourseNodeStatus.published,
        )
        .order_by(CourseNode.sort_order, CourseNode.id)
    )
    nodes = result.scalars().unique().all()

    children_by_parent: dict = {}
    for node in nodes:
        children_by_parent.setdefault(node.parent_id, []).append(node)

    ordered: list = []
    seen: set = set()

    def walk(parent_id):
        for node in children_by_parent.get(parent_id, []):
            for nt in sorted(node.node_tasks, key=lambda x: (x.sort_order, x.id)):
                if nt.task_id in seen:
                    continue
                seen.add(nt.task_id)
                title = nt.task.title if nt.task else f"Задача #{nt.task_id}"
                ordered.append((nt.id, nt.task_id, title))
            walk(node.id)

    walk(None)
    return ordered


@router.get("/{user_id}/course-progress", response_model=UserCourseProgressDetailOut)
async def get_user_course_progress(
    user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)
):
    """Карточка пользователя: прогресс по каждому доступному курсу + итоги."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    last_online = (
        await db.execute(
            select(func.max(UserLoginEvent.created_at)).where(
                UserLoginEvent.user_id == user_id
            )
        )
    ).scalar_one_or_none()

    progress_rows = (
        await db.execute(
            select(UserCourseNodeTaskProgress).where(
                UserCourseNodeTaskProgress.user_id == user_id
            )
        )
    ).scalars().all()
    progress_by_node_task = {p.node_task_id: p for p in progress_rows}

    courses = (
        await db.execute(
            select(Course)
            .join(UserCourseEnrollment, UserCourseEnrollment.course_id == Course.id)
            .where(UserCourseEnrollment.user_id == user_id)
            .order_by(Course.sort_order, Course.id)
        )
    ).scalars().all()

    blocks: List[CourseProgressBlockOut] = []
    total_tasks = 0
    total_passed = 0
    for course in courses:
        ordered = await _ordered_course_node_tasks(db, course.id)
        tasks_out: List[CourseTaskProgressOut] = []
        passed = 0
        for node_task_id, _task_id, title in ordered:
            p = progress_by_node_task.get(node_task_id)
            completed = bool(p and p.status == NodeTaskProgressStatus.completed)
            if completed:
                passed += 1
            tasks_out.append(
                CourseTaskProgressOut(
                    task_title=title,
                    completed=completed,
                    completed_at=p.completed_at if (p and completed) else None,
                )
            )
        blocks.append(
            CourseProgressBlockOut(
                course_id=course.id,
                course_title=course.title,
                passed=passed,
                total=len(ordered),
                tasks=tasks_out,
            )
        )
        total_tasks += len(ordered)
        total_passed += passed

    return UserCourseProgressDetailOut(
        user_id=user_id,
        total_tasks=total_tasks,
        total_passed=total_passed,
        last_online=last_online,
        courses=blocks,
    )


# --- Password recovery (public endpoints) ---

@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request password reset link. Always returns 200 to prevent user enumeration."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        prt = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
        db.add(prt)
        await db.flush()
        send_password_reset_email(user.email, token)
    return {"detail": "Если email найден, письмо отправлено"}


@router.post("/reset-password-by-token")
async def reset_password_by_token(body: ResetPasswordByToken, db: AsyncSession = Depends(get_db)):
    """Reset password using a token received by email."""
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    )
    prt = result.scalar_one_or_none()
    if prt is None or prt.used:
        raise HTTPException(status_code=400, detail="Ссылка недействительна")
    if prt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Ссылка устарела")
    user_r = await db.execute(select(User).where(User.id == prt.user_id))
    user = user_r.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.password_hash = hash_password(body.new_password)
    prt.used = True
    await db.flush()
    return {"detail": "Пароль изменён"}
