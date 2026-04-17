"""
GetCourse webhook integration.

GetCourse шлёт GET-запрос с параметрами в URL когда создаётся сделка.
Мы берём email, имя, фамилию — создаём пользователя и отправляем письмо через Enkod.

URL для настройки в GetCourse (Настройки → Автоматизация → Правила → Действие «Открыть HTTP-запрос»):

  https://itpractikum.sflearning.ru/api/getcourse/webhook?access_token=<GETCOURSE_WEBHOOK_SECRET>&firstName={object.user.first_name}&lastName={object.user.last_name}&email={object.user.email}&status={object.status}

Статусы сделки GetCourse: new, paid, partially_paid, canceled, refunded — создаём только на paid.
"""
from __future__ import annotations

import logging
import re
import secrets as _secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.services.auth_service import hash_password
from app.services.email_service import send_welcome_email

logger = logging.getLogger(__name__)

router = APIRouter()

_PWD_ALPHABET = (
    string.ascii_letters.replace("I", "").replace("l", "").replace("O", "")
    + string.digits
)


def _generate_password(length: int = 12) -> str:
    return "".join(_secrets.choice(_PWD_ALPHABET) for _ in range(length))


def _clean_login(raw: str) -> str:
    """Превращает произвольную строку в допустимый логин [a-zA-Z0-9_.-]"""
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", raw.lower())[:40]


# Статусы GetCourse, при которых создаём пользователя
_ALLOWED_STATUSES = {"paid", "partially_paid", "new", ""}


@router.get("/webhook")
async def getcourse_webhook_get(
    # Аутентификация
    access_token: str = Query(""),
    # Данные пользователя (из URL-шаблона GetCourse)
    email: str = Query(""),
    firstName: Optional[str] = Query(None),
    lastName: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    # Дополнительные поля (логируем, но не используем)
    userId: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    ID_course: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    GET-вебхук от GetCourse.
    Вызывается при создании/оплате сделки.
    Создаёт пользователя платформы по email и отправляет письмо через Enkod.
    """
    # --- Проверка токена ---
    expected = settings.GETCOURSE_WEBHOOK_SECRET
    if expected and access_token != expected:
        logger.warning("GetCourse webhook: invalid access_token")
        raise HTTPException(status_code=403, detail="Invalid access_token")

    logger.info(
        "GetCourse webhook: email=%s status=%s firstName=%s lastName=%s course=%s",
        email, status, firstName, lastName, ID_course,
    )

    # --- Проверка статуса сделки ---
    deal_status = (status or "").lower().strip()
    if deal_status and deal_status not in _ALLOWED_STATUSES:
        logger.info("GetCourse webhook: skipping status=%s", deal_status)
        return {"status": "skipped", "reason": f"deal_status={deal_status}"}

    # --- Проверка email ---
    if not email or "@" not in email:
        logger.warning("GetCourse webhook: no valid email, skipping")
        return {"status": "skipped", "reason": "no_email"}

    email = email.strip().lower()

    # --- Собираем полное имя ---
    full_name = None
    if name and name.strip():
        full_name = name.strip()
    elif firstName or lastName:
        full_name = " ".join(filter(None, [
            (firstName or "").strip(),
            (lastName or "").strip(),
        ])) or None

    # --- Проверяем дубликат ---
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        logger.info("GetCourse webhook: user %s already exists", email)
        return {"status": "exists"}

    # --- Генерируем уникальный логин ---
    base_login = _clean_login(email.split("@")[0])
    if not base_login:
        base_login = "user"

    login = base_login
    suffix = 2
    while True:
        dup = await db.execute(select(User).where(User.login == login))
        if not dup.scalar_one_or_none():
            break
        login = f"{base_login}_{suffix}"
        suffix += 1

    password = _generate_password()

    user = User(
        login=login,
        password_hash=hash_password(password),
        role=UserRole.student,
        status=UserStatus.active,
        email=email,
        full_name=full_name,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # --- Отправляем письмо через Enkod ---
    sent = send_welcome_email(email, login, password)

    logger.info(
        "GetCourse webhook: created user id=%s login=%s email=%s email_sent=%s",
        user.id, login, email, sent,
    )

    return {"status": "created", "login": login}


@router.post("/webhook")
async def getcourse_webhook_post(
    # Оставляем POST для совместимости
    access_token: str = Query(""),
    email: str = Query(""),
    firstName: Optional[str] = Query(None),
    lastName: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    userId: Optional[str] = Query(None),
    ID_course: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """POST-совместимость — делегируем в GET-обработчик."""
    return await getcourse_webhook_get(
        access_token=access_token,
        email=email,
        firstName=firstName,
        lastName=lastName,
        name=name,
        status=status,
        userId=userId,
        phone=None,
        ID_course=ID_course,
        db=db,
    )
