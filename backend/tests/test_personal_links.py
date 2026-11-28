import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_personal_link(client: AsyncClient, admin_headers, admin_user):
    task = await client.post("/api/tasks", json={
        "title": "Link Task", "task_type": "python_io", "runner_type": "stdin_runner",
    }, headers=admin_headers)
    tid = task.json()["id"]

    resp = await client.post("/api/personal-links", json={
        "task_id": tid, "user_id": admin_user.id, "usage_limit": 5,
    }, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["task_id"] == tid
    assert data["usage_limit"] == 5
    assert data["usage_count"] == 0
    assert data["url"].startswith("/shared/")


@pytest.mark.asyncio
async def test_list_personal_links(client: AsyncClient, admin_headers, admin_user):
    task = await client.post("/api/tasks", json={
        "title": "LL", "task_type": "python_io", "runner_type": "stdin_runner",
    }, headers=admin_headers)
    tid = task.json()["id"]

    await client.post("/api/personal-links", json={"task_id": tid, "user_id": admin_user.id}, headers=admin_headers)

    resp = await client.get("/api/personal-links", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_resolve_personal_link(client: AsyncClient, admin_headers, admin_user):
    task = await client.post("/api/tasks", json={
        "title": "Resolve", "task_type": "python_io", "runner_type": "stdin_runner",
    }, headers=admin_headers)
    tid = task.json()["id"]

    link = await client.post("/api/personal-links", json={"task_id": tid, "user_id": admin_user.id}, headers=admin_headers)
    token = link.json()["token"]

    resp = await client.get(f"/api/personal-links/resolve/{token}")
    assert resp.status_code == 200
    assert resp.json()["id"] == tid


@pytest.mark.asyncio
async def test_resolve_personal_link_hides_interactive_answer(client: AsyncClient, admin_headers, admin_user):
    """Shared links are unauthenticated — anyone with the token must not be
    able to read the correct answer out of interactive_config."""
    task = await client.post("/api/tasks", json={
        "title": "Shared MC", "task_type": "interactive", "runner_type": "interactive_runner",
        "mechanic": "multiple_choice",
        "interactive_config": {
            "mode": "single",
            "options": [{"id": "a", "text": "A"}, {"id": "b", "text": "B"}],
            "correct_option_ids": ["a"],
        },
    }, headers=admin_headers)
    tid = task.json()["id"]

    link = await client.post("/api/personal-links", json={"task_id": tid, "user_id": admin_user.id}, headers=admin_headers)
    token = link.json()["token"]

    resp = await client.get(f"/api/personal-links/resolve/{token}")
    assert resp.status_code == 200
    config = resp.json()["interactive_config"]
    assert config["options"] == [{"id": "a", "text": "A"}, {"id": "b", "text": "B"}]
    assert "correct_option_ids" not in config


@pytest.mark.asyncio
async def test_resolve_invalid_token(client: AsyncClient):
    resp = await client.get("/api/personal-links/resolve/nonexistent-token")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_student_cannot_create_link(client: AsyncClient, student_headers, student_user):
    resp = await client.post("/api/personal-links", json={"task_id": 1, "user_id": student_user.id}, headers=student_headers)
    assert resp.status_code == 403
