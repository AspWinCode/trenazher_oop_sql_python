"""Бизнес-логика поддержки (Вариант A — админ-инбокс, без внешних каналов).

Один активный (open) тред на студента. Новое сообщение студента переоткрывает
существующий тред или создаёт первый. Ответ менеджера публикуется студенту по WS.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.support_message import SENDER_MANAGER, SENDER_STUDENT, SupportMessage
from app.models.support_thread import STATUS_CLOSED, STATUS_OPEN, SupportThread
from app.services.support_events import publish_support_event


async def get_active_thread(db: AsyncSession, user_id: int) -> SupportThread | None:
    """Открытый тред студента (если есть)."""
    result = await db.execute(
        select(SupportThread)
        .where(SupportThread.user_id == user_id, SupportThread.status == STATUS_OPEN)
        .order_by(SupportThread.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_thread_with_messages(db: AsyncSession, user_id: int) -> SupportThread | None:
    """Последний тред студента (любого статуса) с подгруженными сообщениями."""
    result = await db.execute(
        select(SupportThread)
        .options(selectinload(SupportThread.messages))
        .where(SupportThread.user_id == user_id)
        .order_by(SupportThread.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def post_student_message(
    db: AsyncSession, user_id: int, body: str
) -> SupportMessage:
    """Студент пишет вопрос. Создаёт/переоткрывает тред, помечает непрочитанным
    для админа и сигналит в WS (живой бейдж у админов)."""
    now = datetime.now(timezone.utc)
    thread = await get_active_thread(db, user_id)
    if thread is None:
        thread = SupportThread(user_id=user_id, status=STATUS_OPEN, created_at=now)
        db.add(thread)
        await db.flush()

    thread.status = STATUS_OPEN
    thread.last_message_at = now
    thread.unread_for_admin = True

    message = SupportMessage(
        thread_id=thread.id,
        sender=SENDER_STUDENT,
        sender_user_id=user_id,
        body=body,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    await publish_support_event(
        {
            "type": "support_new_message",
            "scope": "admin",
            "thread_id": thread.id,
            "user_id": user_id,
        }
    )
    return message


async def post_manager_reply(
    db: AsyncSession, thread: SupportThread, manager_id: int, body: str
) -> SupportMessage:
    """Менеджер отвечает из админки. Помечает непрочитанным для студента и
    доставляет ответ по WS адресно (recipient_user_id = студент)."""
    now = datetime.now(timezone.utc)
    thread.last_message_at = now
    thread.unread_for_student = True
    thread.unread_for_admin = False

    message = SupportMessage(
        thread_id=thread.id,
        sender=SENDER_MANAGER,
        sender_user_id=manager_id,
        body=body,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    await publish_support_event(
        {
            "type": "support_reply",
            "scope": "student",
            "recipient_user_id": thread.user_id,
            "thread_id": thread.id,
            "message": {
                "id": message.id,
                "sender": message.sender,
                "body": message.body,
                "created_at": message.created_at,
            },
        }
    )
    return message


async def mark_read_for_student(db: AsyncSession, thread: SupportThread) -> None:
    if thread.unread_for_student:
        thread.unread_for_student = False
        await db.commit()


async def mark_read_for_admin(db: AsyncSession, thread: SupportThread) -> None:
    if thread.unread_for_admin:
        thread.unread_for_admin = False
        await db.commit()


async def close_thread(db: AsyncSession, thread: SupportThread) -> None:
    thread.status = STATUS_CLOSED
    thread.unread_for_admin = False
    await db.commit()


async def admin_unread_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(SupportThread)
        .where(SupportThread.unread_for_admin.is_(True))
    )
    return int(result.scalar_one())
