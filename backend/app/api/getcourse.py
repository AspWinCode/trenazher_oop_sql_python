"""
GetCourse webhook — автоматическое управление доступами.

Параметры запроса (GET или POST, всё в query string):
  Name       — имя пользователя
  lastName   — фамилия пользователя
  email      — email (ключевой идентификатор)
  Course     — курс: "Python" | "SQL"
  Status     — "active" (дать доступ) | "disabled" (забрать доступ)
  StudentId  — id пользователя в GetCourse (сохраняется в getcourse_id для автовхода)

Автовход:
  GET /api/getcourse/login?id=<StudentId> → выдаёт токены без пароля.
  Фронт-ссылка: https://itpractikum.sflearning.ru/gc?id=<StudentId>

Логика:
  Status=active:
    - Если пользователя нет → создаём, генерируем пароль, шлём письмо через Enkod
    - Находим курс по Course (ищем по названию, содержащему "python" или "sql")
    - Добавляем пользователя в курс (если ещё не добавлен)
  Status=disabled:
    - Находим пользователя по email
    - Убираем его из курса

URL для настройки в GetCourse:
  https://itpractikum.sflearning.ru/api/getcourse/webhook
  ?access_token=GcWh2024SecretItPraktikum
  &Name={object.name}
  &lastName={object.last_name}
  &email={object.email}
  &Course={object.Course}
  &Status={object.Status}
  &StudentId={object.id}
"""
from __future__ import annotations

import hmac
import logging
import re
import secrets as _secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.course import Course, CourseStatus
from app.models.user import User, UserRole, UserStatus
from app.models.user_course_enrollment import UserCourseEnrollment
from app.schemas.auth import TokenResponse
from app.schemas.user import UserOut
from app.services.auth_service import create_token_pair, hash_password
from app.services.email_service import send_welcome_email

logger = logging.getLogger(__name__)
router = APIRouter()

_PWD_ALPHABET = (
    string.ascii_letters.replace("I", "").replace("l", "").replace("O", "")
    + string.digits
)


def _gen_password(length: int = 12) -> str:
    return "".join(_secrets.choice(_PWD_ALPHABET) for _ in range(length))


def _clean_login(raw: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", raw.lower())[:40] or "user"


async def _find_course(db: AsyncSession, course_param: str) -> Optional[Course]:
    """
    Находит курс по значению параметра Course.
    "Python" → ищет курс с python/питон в названии
    "SQL"    → ищет курс с sql в названии
    """
    keyword = course_param.lower().strip()

    # Маппинг ключевых слов → что искать в названии курса
    search_map = {
        "python": ["python", "питон", "oop"],
        "sql":    ["sql"],
    }

    keywords = search_map.get(keyword, [keyword])

    result = await db.execute(
        select(Course).where(Course.status == CourseStatus.published)
    )
    courses = result.scalars().all()

    for course in courses:
        title_lower = course.title.lower()
        if any(kw in title_lower for kw in keywords):
            return course

    logger.warning("GetCourse webhook: course not found for param '%s'", course_param)
    return None


async def _get_or_create_user(
    db: AsyncSession,
    email: str,
    first_name: str,
    last_name: str,
    student_id: str = "",
) -> tuple[User, bool, str]:
    """
    Возвращает (user, is_new, plain_password).
    plain_password непустой только для новых пользователей.
    Для существующего пользователя проставляет getcourse_id, если он ещё не задан.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        if student_id and not user.getcourse_id:
            # Привязываем GetCourse ID к уже существующему аккаунту (если свободен).
            clash = await db.execute(
                select(User).where(User.getcourse_id == student_id, User.id != user.id)
            )
            if not clash.scalar_one_or_none():
                user.getcourse_id = student_id
                await db.flush()
        return user, False, ""

    full_name = " ".join(filter(None, [first_name.strip(), last_name.strip()])) or None

    base_login = _clean_login(email.split("@")[0])
    login = base_login
    suffix = 2
    while True:
        dup = await db.execute(select(User).where(User.login == login))
        if not dup.scalar_one_or_none():
            break
        login = f"{base_login}_{suffix}"
        suffix += 1

    password = _gen_password()
    user = User(
        login=login,
        password_hash=hash_password(password),
        role=UserRole.student,
        status=UserStatus.active,
        email=email,
        full_name=full_name,
        getcourse_id=student_id or None,
    )
    db.add(user)
    try:
        await db.flush()
        await db.refresh(user)
        return user, True, password
    except IntegrityError:
        # Race condition: another request created the same user simultaneously
        await db.rollback()
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            return user, False, ""
        raise


async def _enroll(db: AsyncSession, user_id: int, course_id: int) -> bool:
    """Добавляет запись в enrollments. Возвращает True если добавил, False если уже был."""
    existing = await db.execute(
        select(UserCourseEnrollment).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.course_id == course_id,
        )
    )
    if existing.scalar_one_or_none():
        return False
    db.add(UserCourseEnrollment(user_id=user_id, course_id=course_id))
    await db.flush()
    return True


async def _unenroll(db: AsyncSession, user_id: int, course_id: int) -> bool:
    """Убирает запись из enrollments. Возвращает True если убрал."""
    result = await db.execute(
        select(UserCourseEnrollment).where(
            UserCourseEnrollment.user_id == user_id,
            UserCourseEnrollment.course_id == course_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if enrollment:
        await db.delete(enrollment)
        await db.flush()
        return True
    return False


async def _handle(
    db: AsyncSession,
    name: str,
    last_name: str,
    email: str,
    course_param: str,
    status_param: str,
    access_token: str,
    student_id: str = "",
) -> dict:
    # --- Проверка токена ---
    expected = settings.GETCOURSE_WEBHOOK_SECRET
    if not expected:
        logger.error("GetCourse webhook: GETCOURSE_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=503, detail="Webhook not configured")
    if not hmac.compare_digest(access_token, expected):
        logger.warning("GetCourse webhook: invalid access_token")
        raise HTTPException(status_code=403, detail="Invalid access_token")

    logger.info(
        "GetCourse webhook: email=%s Course=%s Status=%s",
        email, course_param, status_param,
    )

    # --- Валидация email ---
    email = email.strip().lower()
    if not email or "@" not in email:
        return {"status": "error", "reason": "no_valid_email"}

    # --- Валидация статуса ---
    status_lower = status_param.strip().lower()
    if status_lower not in ("active", "disabled"):
        return {"status": "error", "reason": f"unknown_status={status_param}"}

    # --- Находим курс ---
    course = await _find_course(db, course_param)
    if not course:
        return {"status": "error", "reason": f"course_not_found: {course_param}"}
    # Фиксируем скаляры сразу — дальше идут операции, которые могут «протухлить» объект.
    course_id = course.id
    course_title = course.title

    # ──────────────────────────────────────────────
    #  STATUS = active → выдаём доступ
    # ──────────────────────────────────────────────
    if status_lower == "active":
        user, is_new, plain_password = await _get_or_create_user(
            db, email, name, last_name, student_id.strip()
        )
        user_login = user.login

        enrolled = await _enroll(db, user.id, course_id)

        if is_new:
            sent = send_welcome_email(email, user_login, plain_password)
            logger.info(
                "GetCourse webhook: CREATED user=%s course=%s email_sent=%s",
                user_login, course_title, sent,
            )
            return {
                "status": "created",
                "login": user_login,
                "course": course_title,
                "email_sent": sent,
            }
        else:
            action = "enrolled" if enrolled else "already_enrolled"
            logger.info(
                "GetCourse webhook: EXISTING user=%s course=%s action=%s",
                user_login, course_title, action,
            )
            return {
                "status": "exists",
                "login": user_login,
                "course": course_title,
                "action": action,
            }

    # ──────────────────────────────────────────────
    #  STATUS = disabled → забираем доступ
    # ──────────────────────────────────────────────
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("GetCourse webhook: DISABLE — user not found: %s", email)
        return {"status": "not_found"}
    user_login = user.login

    removed = await _unenroll(db, user.id, course_id)
    logger.info(
        "GetCourse webhook: DISABLED user=%s course=%s removed=%s",
        user_login, course_title, removed,
    )
    return {
        "status": "disabled",
        "login": user_login,
        "course": course_title,
        "removed": removed,
    }


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.get("/webhook")
async def getcourse_webhook_get(
    access_token: str = Query(""),
    Name: str = Query(""),
    lastName: str = Query(""),
    email: str = Query(""),
    Course: str = Query(""),
    Status: str = Query(""),
    StudentId: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    return await _handle(db, Name, lastName, email, Course, Status, access_token, StudentId)


@router.post("/webhook")
async def getcourse_webhook_post(
    access_token: str = Query(""),
    Name: str = Query(""),
    lastName: str = Query(""),
    email: str = Query(""),
    Course: str = Query(""),
    Status: str = Query(""),
    StudentId: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    return await _handle(db, Name, lastName, email, Course, Status, access_token, StudentId)


@router.get("/login", response_model=TokenResponse)
async def getcourse_autologin(
    id: str = Query(..., description="GetCourse StudentId"),
    db: AsyncSession = Depends(get_db),
):
    """Бесшовный вход по GetCourse StudentId — выдаёт токены без пароля.
    Ссылка вида: FRONTEND_URL/gc?id=<StudentId>."""
    student_id = id.strip()
    if not student_id:
        raise HTTPException(status_code=400, detail="Не указан id")

    result = await db.execute(select(User).where(User.getcourse_id == student_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь с таким GetCourse ID не найден")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован")

    access, refresh = create_token_pair(user.id, user.role.value)
    from app.services.activity_service import log_login

    try:
        await log_login(db, user.id)
    except Exception:
        pass
    return TokenResponse(token=access, refresh_token=refresh, user=UserOut.model_validate(user))
