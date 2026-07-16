"""Сервис оплаты через Т-Банк (эквайринг v2)."""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TBANK_INIT_URL = "https://securepay.tinkoff.ru/v2/Init"


def _make_token(params: Dict[str, Any]) -> str:
    """SHA-256 от конкатенации значений всех полей, отсортированных по ключу.
    Password подмешивается сюда, Token — исключается."""
    work = {k: v for k, v in params.items() if k != "Token"}
    work["Password"] = settings.TBANK_PASSWORD
    concatenated = "".join(str(v) for _, v in sorted(work.items()))
    return hashlib.sha256(concatenated.encode()).hexdigest()


def verify_tbank_notification(data: Dict[str, Any]) -> bool:
    """Проверяет подпись входящего уведомления от Т-Банка."""
    if not settings.TBANK_PASSWORD:
        return False
    received_token = data.get("Token", "")
    expected = _make_token(data)
    return received_token == expected


def generate_order_id(user_id: Optional[int], course_id: int) -> str:
    ts = int(time.time() * 1000)
    uid = user_id or 0
    return f"order_{course_id}_{uid}_{ts}"


async def init_payment(
    order_id: str,
    amount: int,
    course_title: str,
    customer_key: Optional[str] = None,
    user_email: Optional[str] = None,
) -> Dict[str, Any]:
    """Вызывает /v2/Init и возвращает ответ Т-Банка.
    amount — в копейках."""
    if not settings.TBANK_TERMINAL_KEY or not settings.TBANK_PASSWORD:
        raise RuntimeError("Платёжные ключи не настроены (TBANK_TERMINAL_KEY / TBANK_PASSWORD)")

    params: Dict[str, Any] = {
        "TerminalKey": settings.TBANK_TERMINAL_KEY,
        "Amount": amount,
        "OrderId": order_id,
        "Description": f"Покупка курса «{course_title}»"[:140],
        "SuccessURL": f"{settings.FRONTEND_URL}/payment/success",
        "FailURL": f"{settings.FRONTEND_URL}/payment/fail",
        "NotificationURL": f"{settings.TBANK_NOTIFICATION_BASE_URL}/api/payments/notify",
    }
    if customer_key:
        params["CustomerKey"] = customer_key

    if user_email:
        params["Email"] = user_email

    params["Receipt"] = {
        "Email": user_email or "support@itpractikum.ru",
        "Phone": "+79991234567",
        "Items": [
            {
                "Name": course_title[:255],
                "Price": amount,
                "Quantity": 1,
                "Amount": amount,
                "Tax": "no_tax",
            }
        ],
    }

    params["Token"] = _make_token(params)

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(TBANK_INIT_URL, json=params)
        resp.raise_for_status()
        data = resp.json()

    if not data.get("Success"):
        logger.error("Tbank Init failed: %s", data)
        raise RuntimeError(f"Ошибка Т-Банка: {data.get('Message', 'unknown')}")

    return data
