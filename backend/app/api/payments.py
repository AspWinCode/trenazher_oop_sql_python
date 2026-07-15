"""Платёжные роуты: инициирование платежа и webhook от Т-Банка."""
from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.course import Course
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.user_course_enrollment import UserCourseEnrollment
from app.services.payment_service import generate_order_id, init_payment, verify_tbank_notification

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Схемы ─────────────────────────────────────────────────────────────────────

class PaymentInitRequest(BaseModel):
    course_id: int


class PaymentInitResponse(BaseModel):
    payment_url: str
    order_id: str
    amount: int  # копейки


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
        order.status = OrderStatus.paid
        order.tbank_payment_id = tbank_payment_id
        logger.info("Tbank webhook: оплата подтверждена order_id=%s", order_id)

        # Зачисляем на курс (только реальный пользователь, не гость)
        if order.user_id and order.course_id:
            user_result = await db.execute(select(User).where(User.id == order.user_id))
            user = user_result.scalar_one_or_none()
            if user and not user.is_guest:
                existing = await db.execute(
                    select(UserCourseEnrollment).where(
                        UserCourseEnrollment.user_id == order.user_id,
                        UserCourseEnrollment.course_id == order.course_id,
                    )
                )
                if not existing.scalar_one_or_none():
                    db.add(UserCourseEnrollment(
                        user_id=order.user_id,
                        course_id=order.course_id,
                    ))

    elif status in ("REJECTED", "CANCELLED", "DEADLINE_EXPIRED"):
        order.status = OrderStatus.failed
        logger.info("Tbank webhook: платёж отклонён order_id=%s status=%s", order_id, status)

    return "OK"
