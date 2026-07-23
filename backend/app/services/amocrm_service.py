"""
Интеграция с amoCRM (по долгосрочному токену).

Два события:
  1. Создание заказа (клик «Оплатить») → создаём сделку на этапе «Новый лид».
  2. Подтверждение оплаты → переводим сделку на этап «Успешно реализовано».

Все вызовы best-effort: любая ошибка логируется и НЕ ломает оплату.
Дедупликация контакта: ищем по email, затем по телефону; если контакт найден —
вешаем сделку на него, иначе создаём новый контакт вместе со сделкой.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0


def is_enabled() -> bool:
    return bool(settings.AMOCRM_SUBDOMAIN and settings.AMOCRM_ACCESS_TOKEN)


def _base() -> str:
    return f"https://{settings.AMOCRM_SUBDOMAIN}/api/v4"


def _headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {settings.AMOCRM_ACCESS_TOKEN}"}


async def _find_contact_id(client: httpx.AsyncClient, query: str) -> Optional[int]:
    query = (query or "").strip()
    if not query:
        return None
    try:
        r = await client.get(
            f"{_base()}/contacts",
            params={"query": query, "limit": 1},
            headers=_headers(),
        )
        if r.status_code == 204:
            return None
        r.raise_for_status()
        contacts = r.json().get("_embedded", {}).get("contacts", [])
        if contacts:
            return contacts[0].get("id")
    except Exception:
        logger.exception("amoCRM: поиск контакта не удался (query=%s)", query)
    return None


def _lead_custom_fields(course_title: str, course_id: Optional[int], order_ref: str) -> List[dict]:
    fields: List[dict] = []
    if settings.AMOCRM_FIELD_COURSE and course_title:
        fields.append({"field_id": settings.AMOCRM_FIELD_COURSE, "values": [{"value": course_title}]})
    if settings.AMOCRM_FIELD_PROJECT and settings.AMOCRM_PROJECT_NAME:
        fields.append({"field_id": settings.AMOCRM_FIELD_PROJECT, "values": [{"value": settings.AMOCRM_PROJECT_NAME}]})
    if settings.AMOCRM_FIELD_PRODUCT_ID and course_id:
        fields.append({"field_id": settings.AMOCRM_FIELD_PRODUCT_ID, "values": [{"value": str(course_id)}]})
    if settings.AMOCRM_FIELD_ORDER_ID and order_ref:
        fields.append({"field_id": settings.AMOCRM_FIELD_ORDER_ID, "values": [{"value": order_ref}]})
    return fields


async def create_lead(
    *,
    name: str,
    price_rub: int,
    course_title: str,
    course_id: Optional[int],
    order_ref: str,
    buyer_name: str = "",
    email: str = "",
    phone: str = "",
) -> Optional[int]:
    """Создаёт сделку на этапе «Новый лид». Возвращает id сделки или None."""
    if not is_enabled():
        return None

    cf = _lead_custom_fields(course_title, course_id, order_ref)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            contact_id = await _find_contact_id(client, email)
            if contact_id is None:
                contact_id = await _find_contact_id(client, phone)

            if contact_id is not None:
                # Существующий контакт — вешаем новую сделку на него.
                payload = [{
                    "name": name,
                    "price": price_rub,
                    "pipeline_id": settings.AMOCRM_PIPELINE_ID,
                    "status_id": settings.AMOCRM_STATUS_NEW,
                    "custom_fields_values": cf,
                    "_embedded": {"contacts": [{"id": contact_id}]},
                }]
                r = await client.post(f"{_base()}/leads", json=payload, headers=_headers())
                r.raise_for_status()
                leads = r.json().get("_embedded", {}).get("leads", [])
                return leads[0].get("id") if leads else None

            # Контакта нет — создаём сделку вместе с новым контактом (complex).
            contact_cf: List[dict] = []
            if phone:
                contact_cf.append({"field_code": "PHONE", "values": [{"value": phone, "enum_code": "WORK"}]})
            if email:
                contact_cf.append({"field_code": "EMAIL", "values": [{"value": email, "enum_code": "WORK"}]})

            complex_payload = [{
                "name": name,
                "price": price_rub,
                "pipeline_id": settings.AMOCRM_PIPELINE_ID,
                "status_id": settings.AMOCRM_STATUS_NEW,
                "custom_fields_values": cf,
                "_embedded": {"contacts": [{
                    "name": buyer_name or email or phone or "Клиент",
                    "custom_fields_values": contact_cf,
                }]},
            }]
            r = await client.post(f"{_base()}/leads/complex", json=complex_payload, headers=_headers())
            r.raise_for_status()
            data: Any = r.json()
            if isinstance(data, list) and data:
                return data[0].get("id")
    except Exception:
        logger.exception("amoCRM: создание сделки не удалось (order=%s)", order_ref)
    return None


async def mark_lead_won(lead_id: int) -> None:
    """Переводит сделку на этап «Успешно реализовано». Best-effort."""
    if not is_enabled() or not lead_id:
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            payload = {
                "status_id": settings.AMOCRM_STATUS_WON,
                "pipeline_id": settings.AMOCRM_PIPELINE_ID,
            }
            r = await client.patch(f"{_base()}/leads/{lead_id}", json=payload, headers=_headers())
            r.raise_for_status()
            logger.info("amoCRM: сделка %s переведена в 'Успешно реализовано'", lead_id)
    except Exception:
        logger.exception("amoCRM: перевод сделки %s в 'успешно' не удался", lead_id)
