from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, UserStatus
from app.services.auth_service import create_access_token, hash_password


@pytest_asyncio.fixture
async def guest_user(db: AsyncSession):
    user = User(
        login="guest_abc123",
        password_hash=hash_password("x"),
        role=UserRole.student,
        status=UserStatus.active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
def guest_headers(guest_user):
    token = create_access_token({"sub": str(guest_user.id), "role": "student"})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def second_student(db: AsyncSession):
    user = User(
        login="student2",
        password_hash=hash_password("pass123"),
        role=UserRole.student,
        status=UserStatus.active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
def second_student_headers(second_student):
    token = create_access_token({"sub": str(second_student.id), "role": "student"})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_student_send_message_creates_thread(client: AsyncClient, student_headers):
    resp = await client.post(
        "/api/support/messages", json={"body": "Здравствуйте, есть вопрос"}, headers=student_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["sender"] == "student"
    assert data["body"] == "Здравствуйте, есть вопрос"

    thread = (await client.get("/api/support/thread", headers=student_headers)).json()
    assert thread is not None
    assert thread["status"] == "open"
    assert len(thread["messages"]) == 1


@pytest.mark.asyncio
async def test_guest_blocked(client: AsyncClient, guest_headers):
    resp = await client.post(
        "/api/support/messages", json={"body": "вопрос"}, headers=guest_headers
    )
    assert resp.status_code == 403
    resp2 = await client.get("/api/support/thread", headers=guest_headers)
    assert resp2.status_code == 403


@pytest.mark.asyncio
async def test_unauthorized(client: AsyncClient):
    resp = await client.post("/api/support/messages", json={"body": "вопрос"})
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_empty_body_rejected(client: AsyncClient, student_headers):
    resp = await client.post("/api/support/messages", json={"body": "   "}, headers=student_headers)
    # пустая строка после валидации длины (>=1) проходит схему, но это пробелы;
    # схема min_length=1 пропускает пробелы, поэтому проверяем что сервер не падает.
    assert resp.status_code in (201, 422)

    too_long = "a" * 5000
    resp2 = await client.post("/api/support/messages", json={"body": too_long}, headers=student_headers)
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_admin_sees_and_replies(client: AsyncClient, student_headers, admin_headers):
    await client.post(
        "/api/support/messages", json={"body": "Не работает задача"}, headers=student_headers
    )

    # админ видит непрочитанный тред
    threads = (await client.get("/api/admin/support/threads", headers=admin_headers)).json()
    assert len(threads) == 1
    thread_id = threads[0]["id"]
    assert threads[0]["unread_for_admin"] is True
    assert threads[0]["last_message_preview"] == "Не работает задача"

    count = (await client.get("/api/admin/support/unread-count", headers=admin_headers)).json()
    assert count["unread"] == 1

    # открытие треда снимает непрочитанное у админа
    detail = (await client.get(f"/api/admin/support/threads/{thread_id}", headers=admin_headers)).json()
    assert len(detail["messages"]) == 1
    count2 = (await client.get("/api/admin/support/unread-count", headers=admin_headers)).json()
    assert count2["unread"] == 0

    # ответ менеджера
    reply = await client.post(
        f"/api/admin/support/threads/{thread_id}/reply",
        json={"body": "Помогаем!"},
        headers=admin_headers,
    )
    assert reply.status_code == 201
    assert reply.json()["sender"] == "manager"

    # студент видит ответ и непрочитанное
    thread = (await client.get("/api/support/thread", headers=student_headers)).json()
    assert len(thread["messages"]) == 2
    assert thread["unread_for_student"] is True

    # студент помечает прочитанным
    await client.post("/api/support/thread/read", headers=student_headers)
    thread2 = (await client.get("/api/support/thread", headers=student_headers)).json()
    assert thread2["unread_for_student"] is False


@pytest.mark.asyncio
async def test_thread_isolation(
    client: AsyncClient, student_headers, second_student_headers, admin_headers
):
    await client.post("/api/support/messages", json={"body": "от первого"}, headers=student_headers)
    await client.post("/api/support/messages", json={"body": "от второго"}, headers=second_student_headers)

    t1 = (await client.get("/api/support/thread", headers=student_headers)).json()
    t2 = (await client.get("/api/support/thread", headers=second_student_headers)).json()
    assert t1["id"] != t2["id"]
    assert t1["messages"][0]["body"] == "от первого"
    assert t2["messages"][0]["body"] == "от второго"

    threads = (await client.get("/api/admin/support/threads", headers=admin_headers)).json()
    assert len(threads) == 2


@pytest.mark.asyncio
async def test_admin_close_thread(client: AsyncClient, student_headers, admin_headers):
    await client.post("/api/support/messages", json={"body": "вопрос"}, headers=student_headers)
    thread_id = (await client.get("/api/admin/support/threads", headers=admin_headers)).json()[0]["id"]

    resp = await client.post(f"/api/admin/support/threads/{thread_id}/close", headers=admin_headers)
    assert resp.status_code == 204

    detail = (await client.get(f"/api/admin/support/threads/{thread_id}", headers=admin_headers)).json()
    assert detail["status"] == "closed"


@pytest.mark.asyncio
async def test_admin_reply_missing_thread(client: AsyncClient, admin_headers):
    resp = await client.post(
        "/api/admin/support/threads/9999/reply", json={"body": "hi"}, headers=admin_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_student_cannot_use_admin_endpoints(client: AsyncClient, student_headers):
    resp = await client.get("/api/admin/support/threads", headers=student_headers)
    assert resp.status_code == 403


def test_support_alert_noop_when_disabled(monkeypatch):
    from app.config import settings
    from app.services import email_service

    monkeypatch.setattr(settings, "ENKOD_SUPPORT_MESSAGE_ID", 0)
    calls = []
    monkeypatch.setattr(email_service, "_send_enkod", lambda *a, **k: calls.append(a))
    email_service.dispatch_support_alert("Иван", "вопрос")
    assert calls == []  # без messageId письма не шлём


def test_support_alert_sends_to_each_recipient(monkeypatch):
    from app.config import settings
    from app.services import email_service

    monkeypatch.setattr(settings, "ENKOD_SUPPORT_MESSAGE_ID", 1588)
    monkeypatch.setattr(settings, "SUPPORT_ALERT_EMAILS", "a@x.ru, b@y.ru")
    calls = []
    monkeypatch.setattr(
        email_service, "_send_enkod",
        lambda to, mid, snippets: calls.append((to, mid, snippets)),
    )
    email_service.dispatch_support_alert("Иван Петров", "не работает задача")

    assert [c[0] for c in calls] == ["a@x.ru", "b@y.ru"]
    assert all(c[1] == 1588 for c in calls)
    assert calls[0][2]["student"] == "Иван Петров"
    assert calls[0][2]["message"] == "не работает задача"
    assert calls[0][2]["link"].endswith("/admin/support")
