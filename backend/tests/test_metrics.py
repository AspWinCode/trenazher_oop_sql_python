"""Тесты админ-дашборда метрик (Фаза 1)."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import AsyncClient

ADMIN_COURSES = "/api/admin/courses"
METRICS = "/api/admin/metrics"


async def _published_course_with_task(client, admin_headers, title="Metrics Course"):
    course = await client.post(
        ADMIN_COURSES, json={"title": title, "status": "published"}, headers=admin_headers
    )
    cid = course.json()["id"]
    node = await client.post(
        f"{ADMIN_COURSES}/{cid}/nodes",
        json={"type": "module", "title": "M", "status": "published"},
        headers=admin_headers,
    )
    nid = node.json()["id"]
    t = await client.post(
        f"{ADMIN_COURSES}/nodes/{nid}/tasks",
        json={"create_new_task": True, "task_title": "Metric Task"},
        headers=admin_headers,
    )
    return cid, t.json()["task_id"]


@pytest.mark.asyncio
async def test_metrics_requires_admin(client: AsyncClient, student_headers):
    resp = await client.get(METRICS, headers=student_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_metrics_unauthenticated_rejected(client: AsyncClient):
    resp = await client.get(METRICS)
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_metrics_structure(client: AsyncClient, admin_headers):
    resp = await client.get(METRICS, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) >= {"total_users", "registrations", "tasks", "sections"}
    assert isinstance(data["total_users"], int) and data["total_users"] >= 1
    assert isinstance(data["registrations"], list)
    assert {"most_attempted", "most_failed"} <= set(data["tasks"].keys())


@pytest.mark.asyncio
async def test_metrics_counts_tasks_and_sections(client: AsyncClient, admin_headers):
    _, task_id = await _published_course_with_task(client, admin_headers)

    with patch("app.services.submission_service.celery"):
        await client.post(
            "/api/submissions",
            json={"task_id": task_id, "code": "print(1)"},
            headers=admin_headers,
        )

    resp = await client.get(METRICS, headers=admin_headers)
    data = resp.json()

    task_ids = [t["task_id"] for t in data["tasks"]["most_attempted"]]
    assert task_id in task_ids

    section_types = [s["task_type"] for s in data["sections"]]
    assert "python_io" in section_types


@pytest.mark.asyncio
async def test_metrics_excludes_guests(client: AsyncClient, admin_headers):
    # включаем гостевой режим и создаём гостя
    cid, task_id = await _published_course_with_task(client, admin_headers)
    await client.put(
        "/api/settings/guest",
        json={"enabled": True, "task_limit": 5, "course_ids": [cid]},
        headers=admin_headers,
    )

    before = (await client.get(METRICS, headers=admin_headers)).json()["total_users"]

    guest = await client.post("/api/auth/guest")
    assert guest.status_code == 200
    guest_headers = {"Authorization": f"Bearer {guest.json()['token']}"}

    # гость отправляет решение
    with patch("app.services.submission_service.celery"):
        await client.post(
            "/api/submissions",
            json={"task_id": task_id, "code": "print(1)"},
            headers=guest_headers,
        )

    after = (await client.get(METRICS, headers=admin_headers)).json()
    # гость не увеличил число пользователей
    assert after["total_users"] == before
    # отправка гостя не попала в активность по задачам (most_attempted пуст — только гость отправлял)
    attempted = {t["task_id"]: t["submissions"] for t in after["tasks"]["most_attempted"]}
    assert task_id not in attempted
