"""
GetCourse webhook integration.

Когда в GetCourse открывают доступ к курсу пользователю,
GetCourse отправляет POST-запрос на этот эндпоинт.
Если пользователь (по email) ещё не существует — создаётся автоматически.
Если email уже есть — ничего не делается (дублей нет).

Настройка в GetCourse:
  Настройки → Интеграции → Уведомления (Webhooks) → добавить URL:
  https://<ваш-домен>/api/getcourse/webhook?secret=<GETCOURSE_WEBHOOK_SECRET>

GetCourse шлёт POST (application/x-www-form-urlencoded или JSON) с полями:
  user[email], user[name] (или email, name в плоском JSON)
"""
from __future__ import annotations

import logging
import secrets as _secrets
import string

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.services.auth_service import hash_password
from app.services.email_service import send_welcome_email

logger = logging.getLogger(__name__)

router = APIRouter()

# Алфавит для авто-генерации пароля (читаемый, без I/l/0/O)
_PWD_ALPHABET = string.ascii_letters.replace("I", "").replace("l", "").replace("O", "") + string.digits


def _generate_password(length: int = 12) -> str:
    return "".join(_secrets.choice(_PWD_ALPHABET) for _ in range(length))


def _extract_field(data: dict, *keys: str) -> str:
    """Ищет первое ненулевое значение по одному из ключей."""
    for k in keys:
        v = data.get(k)
        if v:
            return str(v).strip()
    return ""


@router.post("/webhook")
async def getcourse_webhook(
    request: Request,
    secret: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Принимает уведомление от GetCourse.
    Поддерживаются форматы: JSON-тело и form-urlencoded.
    """
    # --- Проверка секрета ---
    expected = settings.GETCOURSE_WEBHOOK_SECRET
    if expected and secret != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    # --- Парсинг тела ---
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
    else:
        form = await request.form()
        raw = dict(form)

    logger.info("GetCourse webhook payload: %s", raw)

    # --- Извлечение email ---
    # GetCourse может слать: user[email], email, USER_EMAIL
    email = (
        _extract_field(raw, "email", "USER_EMAIL")
        or _extract_field(raw.get("user", {}) if isinstance(raw.get("user"), dict) else {}, "email")
        or _extract_field(raw, "user[email]")
    )

    if not email or "@" not in email:
        logger.warning("GetCourse webhook: no valid email in payload, skipping")
        return {"status": "skipped", "reason": "no_email"}

    # --- Извлечение имени ---
    name = (
        _extract_field(raw, "name", "full_name", "USER_NAME")
        or _extract_field(raw.get("user", {}) if isinstance(raw.get("user"), dict) else {}, "name", "full_name")
        or _extract_field(raw, "user[name]", "user[full_name]")
    )
    first_name = _extract_field(raw, "first_name", "USER_FIRST_NAME") \
        or _extract_field(raw.get("user", {}) if isinstance(raw.get("user"), dict) else {}, "first_name")
    last_name = _extract_field(raw, "last_name", "USER_LAST_NAME") \
        or _extract_field(raw.get("user", {}) if isinstance(raw.get("user"), dict) else {}, "last_name")

    full_name = name or " ".join(filter(None, [first_name, last_name])) or None

    # --- Проверяем, существует ли пользователь с таким email ---
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        logger.info("GetCourse webhook: user %s already exists, skipping", email)
        return {"status": "exists"}

    # --- Генерируем логин из email (часть до @) ---
    base_login = email.split("@")[0].lower()
    # Убираем запрещённые символы — оставляем только [a-zA-Z0-9_.-]
    import re
    base_login = re.sub(r"[^a-zA-Z0-9_.-]", "_", base_login)[:40]
    # Если логин занят — добавляем суффикс
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

    # Отправляем логин/пароль через Enkod
    send_welcome_email(email, login, password)

    logger.info(
        "GetCourse webhook: created user id=%s login=%s email=%s",
        user.id, login, email,
    )
    return {"status": "created", "login": login}
