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
from app.services import amocrm_service
from app.services.auth_service import create_token_pair
from app.services.email_service import send_welcome_email
from app.services.payment_service import (
    generate_order_id,
    get_payment_state,
    init_payment,
    is_paid_status,
    verify_tbank_notification,
)

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

    buyer_email = (body.email or "").strip().lower() or None
    buyer_name = (body.name or "").strip() or None
    buyer_phone = (body.phone or "").strip() or None

    # Полная формулировка услуги — и в чек (позиция), и в поле «Курс» amoCRM.
    service_name = _receipt_name(course.title)

    try:
        tbank_resp = await init_payment(
            order_id=order_id,
            amount=amount,
            course_title=course.title,
            customer_key=customer_key,
            # Email покупателя из формы → ОФД пришлёт фискальный чек на этот адрес.
            user_email=buyer_email or current_user.email,
            receipt_name=service_name,
        )
    except Exception as exc:
        logger.exception("Ошибка инициирования платежа")
        raise HTTPException(status_code=502, detail=str(exc))

    # Событие «сделал заказ» → создаём сделку в amoCRM (best-effort, не ломает оплату).
    amocrm_lead_id: Optional[int] = None
    try:
        amocrm_lead_id = await amocrm_service.create_lead(
            name=f"Заказ {order_id} — {service_name}",
            price_rub=amount // 100,
            course_title=service_name,
            course_id=body.course_id,
            order_ref=order_id,
            buyer_name=buyer_name or "",
            email=buyer_email or "",
            phone=buyer_phone or "",
        )
    except Exception:
        logger.exception("amoCRM: не удалось создать сделку order_id=%s", order_id)

    order = Order(
        order_id=order_id,
        user_id=current_user.id,
        course_id=body.course_id,
        amount=amount,
        status=OrderStatus.pending,
        tbank_payment_id=str(tbank_resp.get("PaymentId", "")),
        buyer_email=buyer_email,
        buyer_name=buyer_name,
        buyer_phone=buyer_phone,
        amocrm_lead_id=amocrm_lead_id,
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
    was_paid = order.status == OrderStatus.paid
    order.status = OrderStatus.paid
    # Фиксируем поля заказа в локальных — дальше идут запросы, которые могут «протухлить» объект.
    course_id = order.course_id
    buyer_email = (order.buyer_email or "").strip()
    buyer_name = (order.buyer_name or "").strip()
    order_ref = order.order_id
    existing_user_id = order.user_id
    amocrm_lead_id = order.amocrm_lead_id

    # Событие «оплатил» → переводим сделку в «Успешно реализовано» (один раз, best-effort).
    if not was_paid and amocrm_lead_id:
        await amocrm_service.mark_lead_won(amocrm_lead_id)

    if not course_id:
        return

    target_user_id: Optional[int] = None

    # 1) Есть email из формы оплаты → создаём/находим реальный аккаунт.
    if buyer_email:
        target_user, is_new, plain_password = await _get_or_create_user(
            db, buyer_email, buyer_name, "", ""
        )
        target_user_id = target_user.id
        target_login = target_user.login
        # Перепривязываем заказ с гостя на реальный аккаунт.
        order.user_id = target_user_id
        if is_new and plain_password:
            try:
                send_welcome_email(buyer_email, target_login, plain_password)
            except Exception:
                logger.exception("Не удалось отправить письмо о доступе order_id=%s", order_ref)
    else:
        # 2) Email нет — работаем с текущим пользователем заказа, если он не гость.
        if existing_user_id:
            res = await db.execute(select(User).where(User.id == existing_user_id))
            u = res.scalar_one_or_none()
            if u and not u.is_guest:
                target_user_id = u.id

    if target_user_id is not None:
        await _enroll(db, target_user_id, course_id)


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

    # Если вебхук ещё не пометил оплату — спрашиваем статус напрямую у Т-Банка.
    if order.status != OrderStatus.paid:
        paid = False
        if order.tbank_payment_id:
            try:
                state = await get_payment_state(order.tbank_payment_id)
                paid = is_paid_status(state.get("Status", ""))
            except Exception:
                logger.exception("GetState не удался order_id=%s", order_id)
        if not paid:
            raise HTTPException(status_code=409, detail="Оплата ещё обрабатывается")

    course_id_out = order.course_id

    # Заказ оплачен — гарантируем аккаунт+доступ (идемпотентно).
    await _fulfill_order(db, order)

    target_user_id = order.user_id
    if not target_user_id:
        raise HTTPException(status_code=422, detail="Не удалось определить аккаунт по заказу")

    res = await db.execute(select(User).where(User.id == target_user_id))
    user = res.scalar_one_or_none()
    if user is None or user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail="Аккаунт недоступен")

    access, refresh = create_token_pair(user.id, user.role.value)
    return PaymentCompleteResponse(
        token=access,
        refresh_token=refresh,
        user=UserOut.model_validate(user),
        course_id=course_id_out,
    )
