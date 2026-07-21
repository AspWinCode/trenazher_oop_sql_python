"""Платёжные роуты: инициирование платежа и webhook от Т-Банка."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.getcourse import _enroll, _get_or_create_user
from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.course import Course
from app.models.order import Order, OrderStatus
from app.models.user import User, UserStatus
from app.models.user_course_enrollment import UserCourseEnrollment
from app.schemas.user import UserOut
from app.services.auth_service import create_token_pair
from app.services.email_service import send_welcome_email
from app.services.payment_service import generate_order_id, init_payment, verify_tbank_notification

logger = logging.getLogger(__name__)
router = APIRouter()

_SF_PREFIX = 'Предоставление доступа к Платформе SF Education v.1.1. и интерактивному тренажеру'

def _receipt_name(course_title: str) -> str:
    t = course_title.lower()
    if 'python' in t and 'sql' in t:
        return f'{_SF_PREFIX} "Python + SQL"'
    if 'python' in t:
        return f'{_SF_PREFIX} "Python"'
    if 'sql' in t:
        return f'{_SF_PREFIX} "SQL"'
    return course_title


# ── Схемы ─────────────────────────────────────────────────────────────────────

class PaymentInitRequest(BaseModel):
    course_id: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PaymentInitResponse(BaseModel):
    payment_url: str
    order_id: str
    amount: int  # копейки


class PaymentCompleteResponse(BaseModel):
    token: str
    refresh_token: str
    user: UserOut
    course_id: Optional[int] = None


# ── Эндпоинты ─────────────────────────────────────────────────────────────────

@router.get("/payments/config")
async def payment_config():
    """Публичный: включены ли платежи (ключи настроены)."""
    return {"enabled": bool(settings.TBANK_TERMINAL_KEY and settings.TBANK_PASSWORD)}


@router.post("/payments/init", response_model=PaymentInitResponse)
async def payment_init(
    body: PaymentInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Инициирует платёж в Т-Банке и возвращает ссылку на форму оплаты."""
    if not settings.TBANK_TERMINAL_KEY or not settings.TBANK_PASSWORD:
        raise HTTPException(status_code=503, detail="Платёжная система не настроена")

    # Проверяем курс
    result = await db.execute(select(Course).where(Course.id == body.course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")

    amount = course.price if (course.price and course.price > 0) else settings.COURSE_PRICE

    order_id = generate_order_id(current_user.id, body.course_id)
    customer_key = str(current_user.id) if not current_user.is_guest else None

    try:
        tbank_resp = await init_payment(
            order_id=order_id,
            amount=amount,
            course_title=course.title,
            customer_key=customer_key,
            user_email=current_user.email,
            receipt_name=_receipt_name(course.title),
        )
    except Exception as exc:
        logger.exception("Ошибка инициирования платежа")
        raise HTTPException(status_code=502, detail=str(exc))

    order = Order(
        order_id=order_id,
        user_id=current_user.id,
        course_id=body.course_id,
        amount=amount,
        status=OrderStatus.pending,
        tbank_payment_id=str(tbank_resp.get("PaymentId", "")),
        buyer_email=(body.email or "").strip().lower() or None,
        buyer_name=(body.name or "").strip() or None,
        buyer_phone=(body.phone or "").strip() or None,
    )
    db.add(order)
    # commit через get_db

    return PaymentInitResponse(
        payment_url=tbank_resp["PaymentURL"],
        order_id=order_id,
        amount=amount,
    )


@router.post("/payments/notify")
async def payment_notify(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Webhook от Т-Банка. Должен вернуть строку 'OK'."""
    if not verify_tbank_notification(payload):
        logger.warning("Tbank webhook: неверная подпись, payload=%s", payload)
        raise HTTPException(status_code=400, detail="Invalid token")

    status = payload.get("Status", "")
    tbank_payment_id = str(payload.get("PaymentId", ""))
    order_id = str(payload.get("OrderId", ""))

    result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        logger.warning("Tbank webhook: заказ не найден order_id=%s", order_id)
        return "OK"

    if status == "CONFIRMED":
        order.tbank_payment_id = tbank_payment_id
        await _fulfill_order(db, order)
        logger.info("Tbank webhook: оплата подтверждена order_id=%s", order_id)

    elif status in ("REJECTED", "CANCELLED", "DEADLINE_EXPIRED"):
        order.status = OrderStatus.failed
        logger.info("Tbank webhook: платёж отклонён order_id=%s status=%s", order_id, status)

    return "OK"


async def _fulfill_order(db: AsyncSession, order: Order) -> None:
    """Проводит оплаченный заказ: помечает paid, создаёт/находит реального
    пользователя (по email из формы), зачисляет на курс, шлёт письмо с доступом.
    Идемпотентна — безопасно вызывать повторно (вебхук + страница успеха).
    """
    order.status = OrderStatus.paid
    if not order.course_id:
        return

    target_user: Optional[User] = None

    # 1) Есть email из формы оплаты → создаём/находим реальный аккаунт.
    if order.buyer_email:
        first_name = (order.buyer_name or "").strip()
        target_user, is_new, plain_password = await _get_or_create_user(
            db, order.buyer_email, first_name, "", ""
        )
        # Перепривязываем заказ с гостя на реальный аккаунт.
        order.user_id = target_user.id
        if is_new and plain_password:
            try:
                send_welcome_email(order.buyer_email, target_user.login, plain_password)
            except Exception:
                logger.exception("Не удалось отправить письмо о доступе order_id=%s", order.order_id)
    else:
        # 2) Email нет — работаем с текущим пользователем заказа, если он не гость.
        if order.user_id:
            res = await db.execute(select(User).where(User.id == order.user_id))
            u = res.scalar_one_or_none()
            if u and not u.is_guest:
                target_user = u

    if target_user is not None:
        await _enroll(db, target_user.id, order.course_id)


@router.get("/payments/complete", response_model=PaymentCompleteResponse)
async def payment_complete(
    order_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Вызывается страницей /payment/success после возврата с Т-Банка.
    Если заказ оплачен — гарантирует аккаунт+доступ и выдаёт токены (автовход).
    Пока заказ не подтверждён (вебхук ещё не пришёл) — 409, фронт повторит запрос.
    """
    result = await db.execute(select(Order).where(Order.order_id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    if order.status != OrderStatus.paid:
        raise HTTPException(status_code=409, detail="Оплата ещё обрабатывается")

    # Идемпотентно убеждаемся, что аккаунт и доступ созданы (если вебхук опоздал).
    await _fulfill_order(db, order)

    if not order.user_id:
        raise HTTPException(status_code=422, detail="Не удалось определить аккаунт по заказу")

    res = await db.execute(select(User).where(User.id == order.user_id))
    user = res.scalar_one_or_none()
    if user is None or user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Аккаунт недоступен")

    access, refresh = create_token_pair(user.id, user.role.value)
    return PaymentCompleteResponse(
        token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
        course_id=order.course_id,
    )
