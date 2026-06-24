"""Поддержка (Вариант A — админ-инбокс).

Студент пишет из виджета; менеджер отвечает в админке; ответ доставляется
студенту по WebSocket. Внешних каналов (email/Telegram) нет.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth_middleware import get_current_user, require_admin
from app.middleware.rate_limiter import support_limiter
from app.models.support_message import SENDER_STUDENT, SupportMessage
from app.models.support_thread import STATUS_OPEN, SupportThread
from app.models.user import User
from app.schemas.support import (
    AdminSupportThreadDetailOut,
    AdminSupportThreadOut,
    SupportMessageCreate,
    SupportMessageOut,
    SupportThreadOut,
    UnreadCountOut,
)
from app.services import support_service

router = APIRouter()

_PREVIEW_LEN = 120


def _guard_not_guest(user: User) -> None:
    if user.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Чат поддержки доступен только зарегистрированным пользователям.",
        )


# ---------------------------------------------------------------- студент

@router.post("/support/messages", response_model=SupportMessageOut, status_code=201)
async def send_message(
    body: SupportMessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _guard_not_guest(user)
    allowed, _ = support_limiter.check("ratelimit:support:{}".format(user.id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много сообщений. Подождите немного.",
        )
    message = await support_service.post_student_message(db, user.id, body.body.strip())
    return message


@router.get("/support/thread", response_model=Optional[SupportThreadOut])
async def my_thread(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _guard_not_guest(user)
    thread = await support_service.get_thread_with_messages(db, user.id)
    return thread


@router.post("/support/thread/read", status_code=204)
async def mark_my_thread_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _guard_not_guest(user)
    thread = await support_service.get_thread_with_messages(db, user.id)
    if thread is not None:
        await support_service.mark_read_for_student(db, thread)


# ---------------------------------------------------------------- админ

@router.get("/admin/support/unread-count", response_model=UnreadCountOut)
async def admin_unread_count(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    return UnreadCountOut(unread=await support_service.admin_unread_count(db))


@router.get("/admin/support/threads", response_model=List[AdminSupportThreadOut])
async def admin_list_threads(
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = (
        select(SupportThread)
        .options(selectinload(SupportThread.user))
        .order_by(
            SupportThread.unread_for_admin.desc(),
            SupportThread.last_message_at.desc().nullslast(),
        )
    )
    if unread_only:
        stmt = stmt.where(SupportThread.unread_for_admin.is_(True))
    threads = (await db.execute(stmt)).scalars().all()

    if not threads:
        return []

    # Превью последнего сообщения по каждому треду — одним запросом.
    thread_ids = [t.id for t in threads]
    msgs = (
        await db.execute(
            select(SupportMessage)
            .where(SupportMessage.thread_id.in_(thread_ids))
            .order_by(SupportMessage.thread_id, SupportMessage.created_at.desc())
        )
    ).scalars().all()
    last_by_thread: dict[int, SupportMessage] = {}
    for m in msgs:
        last_by_thread.setdefault(m.thread_id, m)  # первый = самый свежий

    out: List[AdminSupportThreadOut] = []
    for t in threads:
        last = last_by_thread.get(t.id)
        preview = None
        if last is not None:
            preview = last.body[:_PREVIEW_LEN]
        out.append(
            AdminSupportThreadOut(
                id=t.id,
                user_id=t.user_id,
                user_login=t.user.login if t.user else "",
                user_full_name=t.user.full_name if t.user else None,
                status=t.status,
                unread_for_admin=t.unread_for_admin,
                last_message_at=t.last_message_at,
                last_message_preview=preview,
            )
        )
    return out


async def _get_thread_or_404(db: AsyncSession, thread_id: int) -> SupportThread:
    result = await db.execute(
        select(SupportThread)
        .options(selectinload(SupportThread.user), selectinload(SupportThread.messages))
        .where(SupportThread.id == thread_id)
    )
    thread = result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тред не найден")
    return thread


@router.get(
    "/admin/support/threads/{thread_id}", response_model=AdminSupportThreadDetailOut
)
async def admin_get_thread(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    thread = await _get_thread_or_404(db, thread_id)
    await support_service.mark_read_for_admin(db, thread)
    return AdminSupportThreadDetailOut(
        id=thread.id,
        user_id=thread.user_id,
        user_login=thread.user.login if thread.user else "",
        user_full_name=thread.user.full_name if thread.user else None,
        status=thread.status,
        messages=[SupportMessageOut.model_validate(m) for m in thread.messages],
    )


@router.post(
    "/admin/support/threads/{thread_id}/reply",
    response_model=SupportMessageOut,
    status_code=201,
)
async def admin_reply(
    thread_id: int,
    body: SupportMessageCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    thread = await _get_thread_or_404(db, thread_id)
    message = await support_service.post_manager_reply(
        db, thread, admin.id, body.body.strip()
    )
    return message


@router.post("/admin/support/threads/{thread_id}/close", status_code=204)
async def admin_close(
    thread_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    thread = await _get_thread_or_404(db, thread_id)
    await support_service.close_thread(db, thread)
