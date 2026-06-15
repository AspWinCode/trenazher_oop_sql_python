"""Тесты гостевого (демо) режима."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

ADMIN_COURSES = "/api/admin/courses"


async def _create_published_course_with_tasks(
    client: AsyncClient, admin_headers, n_tasks: int, title: str = "Demo Course"
):
    """Создаёт опубликованный курс с одним опубликованным узлом и n задачами.
    Возвращает (course_id, [task_id, ...]) в порядке прикрепления."""
    course = await client.post(
        ADMIN_COURSES, json={"title": title, "status": "published"}, headers=admin_headers
    )
    cid = course.json()["id"]
    node = await client.post(
        f"{ADMIN_COURSES}/{cid}/nodes",
        json={"type": "module", "title": "Module", "status": "published"},
        headers=admin_headers,
    )
    nid = node.json()["id"]
    task_ids = []
    for i in range(n_tasks):
        r = await client.post(
            f"{ADMIN_COURSES}/nodes/{nid}/tasks",
            json={"create_new_task": True, "task_title": f"Task {i + 1}"},
            headers=admin_headers,
        )
        assert r.status_code == 201, r.text
        task_ids.append(r.json()["task_id"])
    return cid, task_ids


async def _set_guest_config(client, admin_headers, *, enabled, task_limit, course_ids):
    resp = await client.put(
        "/api/settings/guest",
        json={"enabled": enabled, "task_limit": task_limit, "course_ids": course_ids},
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _guest_headers(client: AsyncClient):
    resp = await client.post("/api/auth/guest")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["user"]


# --- Конфиг и доступ к настройкам ---

@pytest.mark.asyncio
async def test_guest_config_default_disabled(client: AsyncClient):
    resp = await client.get("/api/settings/guest")
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


@pytest.mark.asyncio
async def test_admin_can_update_guest_config(client: AsyncClient, admin_headers):
    cfg = await _set_guest_config(
        client, admin_headers, enabled=True, task_limit=5, course_ids=[1, 2]
    )
    assert cfg == {"enabled": True, "task_limit": 5, "course_ids": [1, 2]}
    # и читается обратно
    resp = await client.get("/api/settings/guest")
    assert resp.json()["task_limit"] == 5


@pytest.mark.asyncio
async def test_guest_config_update_requires_admin(client: AsyncClient, student_headers):
    resp = await client.put(
        "/api/settings/guest",
        json={"enabled": True, "task_limit": 1, "course_ids": []},
        headers=student_headers,
    )
    assert resp.status_code == 403


# --- Вход гостя ---

@pytest.mark.asyncio
async def test_guest_login_disabled_returns_403(client: AsyncClient):
    resp = await client.post("/api/auth/guest")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_guest_login_creates_isolated_guests(client: AsyncClient, admin_headers):
    await _set_guest_config(client, admin_headers, enabled=True, task_limit=3, course_ids=[])

    headers1, user1 = await _guest_headers(client)
    headers2, user2 = await _guest_headers(client)

    assert user1["is_guest"] is True
    assert user2["is_guest"] is True
    assert user1["login"].startswith("guest_")
    assert user1["id"] != user2["id"]  # изоляция


# --- Доступ к курсам ---

@pytest.mark.asyncio
async def test_guest_sees_only_allowed_courses(client: AsyncClient, admin_headers):
    cid_allowed, _ = await _create_published_course_with_tasks(
        client, admin_headers, 1, title="Allowed"
    )
    await _create_published_course_with_tasks(client, admin_headers, 1, title="Hidden")

    await _set_guest_config(
        client, admin_headers, enabled=True, task_limit=3, course_ids=[cid_allowed]
    )
    headers, _ = await _guest_headers(client)

    resp = await client.get("/api/courses", headers=headers)
    assert resp.status_code == 200
    titles = [c["title"] for c in resp.json()]
    assert titles == ["Allowed"]


# --- Лимит задач при отправке ---

@pytest.mark.asyncio
async def test_guest_submit_within_and_beyond_limit(client: AsyncClient, admin_headers):
    cid, task_ids = await _create_published_course_with_tasks(client, admin_headers, 3)
    await _set_guest_config(
        client, admin_headers, enabled=True, task_limit=2, course_ids=[cid]
    )
    headers, _ = await _guest_headers(client)

    with patch("app.services.submission_service.celery"):
        # первая задача — в пределах лимита
        ok = await client.post(
            "/api/submissions",
            json={"task_id": task_ids[0], "code": "print(1)"},
            headers=headers,
        )
        assert ok.status_code == 201, ok.text

        # третья задача — за пределами лимита (limit=2)
        blocked = await client.post(
            "/api/submissions",
            json={"task_id": task_ids[2], "code": "print(1)"},
            headers=headers,
        )
        assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_guest_submit_to_disallowed_course_forbidden(client: AsyncClient, admin_headers):
    cid_allowed, _ = await _create_published_course_with_tasks(
        client, admin_headers, 1, title="Allowed"
    )
    _, hidden_tasks = await _create_published_course_with_tasks(
        client, admin_headers, 1, title="Hidden"
    )
    await _set_guest_config(
        client, admin_headers, enabled=True, task_limit=5, course_ids=[cid_allowed]
    )
    headers, _ = await _guest_headers(client)

    with patch("app.services.submission_service.celery"):
        resp = await client.post(
            "/api/submissions",
            json={"task_id": hidden_tasks[0], "code": "print(1)"},
            headers=headers,
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_regular_student_unaffected_by_guest_gating(
    client: AsyncClient, admin_headers, student_headers
):
    """Обычный студент по-прежнему может отправлять решение независимо от гостевого лимита."""
    cid, task_ids = await _create_published_course_with_tasks(client, admin_headers, 3)
    await _set_guest_config(
        client, admin_headers, enabled=True, task_limit=1, course_ids=[cid]
    )
    with patch("app.services.submission_service.celery"):
        resp = await client.post(
            "/api/submissions",
            json={"task_id": task_ids[2], "code": "print(1)"},
            headers=student_headers,
        )
    assert resp.status_code == 201, resp.text


# --- Просмотр задачи гостем ---

@pytest.mark.asyncio
async def test_guest_can_get_allowed_task_but_not_locked(client: AsyncClient, admin_headers):
    cid, task_ids = await _create_published_course_with_tasks(client, admin_headers, 3)
    await _set_guest_config(
        client, admin_headers, enabled=True, task_limit=2, course_ids=[cid]
    )
    headers, _ = await _guest_headers(client)

    # задача в пределах лимита — доступна
    ok = await client.get(f"/api/tasks/{task_ids[0]}", headers=headers)
    assert ok.status_code == 200, ok.text

    # задача за пределами лимита — 404 (как заблокированная)
    locked = await client.get(f"/api/tasks/{task_ids[2]}", headers=headers)
    assert locked.status_code == 404


# --- Резерв префикса ---

@pytest.mark.asyncio
async def test_reserved_guest_prefix_rejected(client: AsyncClient, admin_headers):
    resp = await client.post(
        "/api/users",
        json={"login": "guest_hacker", "password": "secret123"},
        headers=admin_headers,
    )
    assert resp.status_code == 400
