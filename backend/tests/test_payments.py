"""Тесты платёжной интеграции (Т-Банк)."""
from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

ADMIN_COURSES = "/api/admin/courses"


async def _create_priced_course(client: AsyncClient, admin_headers, price: int) -> int:
    course = await client.post(
        ADMIN_COURSES,
        json={"title": "Полный курс SQL", "status": "published"},
        headers=admin_headers,
    )
    cid = course.json()["id"]
    await client.patch(
        f"{ADMIN_COURSES}/{cid}",
        json={"price": price},
        headers=admin_headers,
    )
    return cid


def _make_token(params: dict, password: str) -> str:
    work = {k: v for k, v in params.items() if k != "Token"}
    work["Password"] = password
    concatenated = "".join(str(v) for _, v in sorted(work.items()))
    return hashlib.sha256(concatenated.encode()).hexdigest()


# ── Конфиг ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_payment_config_disabled_when_no_keys(client: AsyncClient):
    """Если ключи не настроены — возвращает enabled=false."""
    with patch("app.api.payments.settings") as mock_settings:
        mock_settings.TBANK_TERMINAL_KEY = ""
        mock_settings.TBANK_PASSWORD = ""
        resp = await client.get("/api/payments/config")
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


@pytest.mark.asyncio
async def test_payment_config_enabled_when_keys_set(client: AsyncClient):
    """Если ключи настроены — возвращает enabled=true."""
    with patch("app.api.payments.settings") as mock_settings:
        mock_settings.TBANK_TERMINAL_KEY = "terminal123"
        mock_settings.TBANK_PASSWORD = "secret"
        resp = await client.get("/api/payments/config")
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True


# ── Инициирование платежа ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_payment_init_requires_auth(client: AsyncClient):
    resp = await client.post("/api/payments/init", json={"course_id": 1})
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_payment_init_course_not_found(client: AsyncClient, student_headers):
    with patch("app.api.payments.settings") as mock_settings:
        mock_settings.TBANK_TERMINAL_KEY = "terminal123"
        mock_settings.TBANK_PASSWORD = "secret"
        resp = await client.post(
            "/api/payments/init", json={"course_id": 99999}, headers=student_headers
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_payment_init_course_no_price_uses_default(
    client: AsyncClient, admin_headers, student_headers
):
    """Если у курса нет цены, используется глобальный COURSE_PRICE из настроек."""
    course = await client.post(
        ADMIN_COURSES,
        json={"title": "Без цены", "status": "published"},
        headers=admin_headers,
    )
    cid = course.json()["id"]

    mock_tbank_response = {
        "Success": True,
        "PaymentURL": "https://securepay.tinkoff.ru/pay/default_price",
        "PaymentId": "99999",
        "OrderId": f"order_{cid}_1_1000",
        "Amount": 299000,
        "Status": "NEW",
    }

    with patch("app.api.payments.settings") as mock_settings, \
         patch("app.services.payment_service.settings") as mock_svc_settings, \
         patch("app.services.payment_service.httpx.AsyncClient") as mock_client_cls:

        mock_settings.TBANK_TERMINAL_KEY = "terminal123"
        mock_settings.TBANK_PASSWORD = "secret"
        mock_settings.COURSE_PRICE = 299000
        mock_svc_settings.TBANK_TERMINAL_KEY = "terminal123"
        mock_svc_settings.TBANK_PASSWORD = "secret"
        mock_svc_settings.FRONTEND_URL = "https://example.com"
        mock_svc_settings.TBANK_NOTIFICATION_BASE_URL = "https://example.com"

        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tbank_response
        mock_resp.raise_for_status = MagicMock()
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_http

        resp = await client.post(
            "/api/payments/init", json={"course_id": cid}, headers=student_headers
        )

    assert resp.status_code == 200, resp.text
    assert resp.json()["amount"] == 299000


@pytest.mark.asyncio
async def test_payment_init_success(client: AsyncClient, admin_headers, student_headers):
    cid = await _create_priced_course(client, admin_headers, price=299000)

    mock_tbank_response = {
        "Success": True,
        "PaymentURL": "https://securepay.tinkoff.ru/pay/abc123",
        "PaymentId": "13660001",
        "OrderId": "order_1_1_1000",
        "Amount": 299000,
        "Status": "NEW",
    }

    with patch("app.api.payments.settings") as mock_settings, \
         patch("app.services.payment_service.settings") as mock_svc_settings, \
         patch("app.services.payment_service.httpx.AsyncClient") as mock_client_cls:

        mock_settings.TBANK_TERMINAL_KEY = "terminal123"
        mock_settings.TBANK_PASSWORD = "secret"
        mock_svc_settings.TBANK_TERMINAL_KEY = "terminal123"
        mock_svc_settings.TBANK_PASSWORD = "secret"
        mock_svc_settings.FRONTEND_URL = "https://example.com"
        mock_svc_settings.TBANK_NOTIFICATION_BASE_URL = "https://example.com"

        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_tbank_response
        mock_resp.raise_for_status = MagicMock()
        mock_http = AsyncMock()
        mock_http.__aenter__ = AsyncMock(return_value=mock_http)
        mock_http.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_http

        resp = await client.post(
            "/api/payments/init", json={"course_id": cid}, headers=student_headers
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["payment_url"] == "https://securepay.tinkoff.ru/pay/abc123"
    assert data["amount"] == 299000
    assert "order_" in data["order_id"]


# ── Webhook ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_invalid_token_rejected(client: AsyncClient):
    payload = {
        "TerminalKey": "terminal123",
        "OrderId": "order_1_1_1000",
        "PaymentId": "999",
        "Status": "CONFIRMED",
        "Token": "wrongtoken",
    }
    with patch("app.api.payments.settings") as mock_settings, \
         patch("app.services.payment_service.settings") as mock_svc:
        mock_settings.TBANK_PASSWORD = "secret"
        mock_svc.TBANK_PASSWORD = "secret"
        resp = await client.post("/api/payments/notify", json=payload)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_webhook_confirmed_unknown_order(client: AsyncClient):
    """Если заказ не найден — возвращаем OK (не ломаем Tbank retry)."""
    password = "secret"
    payload = {
        "TerminalKey": "terminal123",
        "OrderId": "order_nonexistent",
        "PaymentId": "999",
        "Status": "CONFIRMED",
    }
    payload["Token"] = _make_token(payload, password)

    with patch("app.api.payments.verify_tbank_notification", return_value=True):
        resp = await client.post("/api/payments/notify", json=payload)
    assert resp.status_code == 200


# ── Токен-подпись ─────────────────────────────────────────────────────────────

def test_token_generation():
    """Проверяет алгоритм формирования токена."""
    from app.services.payment_service import _make_token
    with patch("app.services.payment_service.settings") as mock_settings:
        mock_settings.TBANK_PASSWORD = "mypassword"
        params = {"TerminalKey": "term1", "Amount": 100, "OrderId": "order1"}
        token = _make_token(params)
    # Воспроизводим вручную
    work = {**params, "Password": "mypassword"}
    expected = hashlib.sha256(
        "".join(str(v) for _, v in sorted(work.items())).encode()
    ).hexdigest()
    assert token == expected
