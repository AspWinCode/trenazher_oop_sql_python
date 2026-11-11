import pytest
from httpx import AsyncClient

DIAGRAM_CONFIG = {
    "directed": True,
    "nodes": [
        {"id": "n1", "label": "Клиент"},
        {"id": "n2", "label": "Backend"},
        {"id": "n3", "label": "БД"},
    ],
    "correct_edges": [["n1", "n2"], ["n2", "n3"]],
}

HIERARCHY_CONFIG = {
    "nodes": [
        {"id": "ceo", "label": "CEO"},
        {"id": "cto", "label": "CTO"},
        {"id": "dev", "label": "Developer"},
    ],
    "correct_parents": {"ceo": None, "cto": "ceo", "dev": "cto"},
}

DECISION_PATH_CONFIG = {
    "start_step_id": "s1",
    "steps": [
        {
            "id": "s1",
            "prompt": "Клиент жалуется, сайт не грузится",
            "options": [
                {"id": "o1", "text": "Проверить статус сервера", "next_step_id": "s2"},
                {"id": "o2", "text": "Сразу перезагрузить БД", "next_step_id": None},
            ],
        },
        {
            "id": "s2",
            "prompt": "Сервер работает. Что дальше?",
            "options": [
                {"id": "o3", "text": "Проверить логи приложения", "next_step_id": None},
                {"id": "o4", "text": "Ничего не делать", "next_step_id": None},
            ],
        },
    ],
    "correct_paths": [["o1", "o3"]],
}

SIMULATION_CONFIG = {
    "parameters": [
        {"id": "speed", "label": "Скорость", "min": 0, "max": 100, "step": 1, "default": 50},
        {"id": "load", "label": "Нагрузка", "min": 0, "max": 10, "step": 1, "default": 5},
    ],
    "formula": "speed / load",
    "target_min": 15,
    "target_max": 25,
}

COMPARISON_CONFIG = {
    "regions": [
        {"id": "d1", "side": "left", "x": 0.1, "y": 0.1, "width": 0.1, "height": 0.1},
        {"id": "d2", "side": "right", "x": 0.6, "y": 0.6, "width": 0.1, "height": 0.1},
        {"id": "d3", "side": "left", "x": 0.8, "y": 0.2, "width": 0.1, "height": 0.1},
    ],
    "correct_region_ids": ["d1", "d2"],
}


async def _create_task(client: AsyncClient, admin_headers, mechanic: str, config: dict):
    resp = await client.post(
        "/api/tasks",
        json={
            "title": f"Task {mechanic}",
            "task_type": "interactive",
            "runner_type": "interactive_runner",
            "status": "published",
            "mechanic": mechanic,
            "interactive_config": config,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_phase5_tasks_each_mechanic(client: AsyncClient, admin_headers):
    for mechanic, config in [
        ("diagram_builder", DIAGRAM_CONFIG),
        ("hierarchy_builder", HIERARCHY_CONFIG),
        ("decision_path", DECISION_PATH_CONFIG),
        ("simulation", SIMULATION_CONFIG),
        ("comparison", COMPARISON_CONFIG),
    ]:
        data = await _create_task(client, admin_headers, mechanic, config)
        assert data["mechanic"] == mechanic


@pytest.mark.asyncio
async def test_diagram_builder_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "diagram_builder", DIAGRAM_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"edges": [["n1", "n2"], ["n2", "n3"]]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"edges": [["n1", "n2"]]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_hierarchy_builder_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "hierarchy_builder", HIERARCHY_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"parents": {"ceo": None, "cto": "ceo", "dev": "cto"}}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"parents": {"ceo": None, "cto": "ceo", "dev": "ceo"}}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(2 / 3)


@pytest.mark.asyncio
async def test_decision_path_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "decision_path", DECISION_PATH_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"path": ["o1", "o3"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"path": ["o2"]}},
        headers=student_headers,
    )
    assert wrong.json()["verdict"] == "WA"
    assert wrong.json()["score"] == 0.0


@pytest.mark.asyncio
async def test_simulation_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "simulation", SIMULATION_CONFIG)

    in_range = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"values": {"speed": 40, "load": 2}}},
        headers=student_headers,
    )
    assert in_range.json()["verdict"] == "AC"

    out_of_range = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"values": {"speed": 1, "load": 10}}},
        headers=student_headers,
    )
    assert out_of_range.json()["verdict"] == "WA"


@pytest.mark.asyncio
async def test_comparison_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "comparison", COMPARISON_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_region_ids": ["d1", "d2"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_region_ids": ["d1"]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_student_never_sees_phase5_config(client: AsyncClient, admin_headers, student_headers, db, student_user):
    from tests.conftest import enroll
    from app.models.course import Course, CourseStatus
    from app.models.course_node import CourseNode, CourseNodeType
    from app.models.course_node_task import CourseNodeTask

    task = await _create_task(client, admin_headers, "diagram_builder", DIAGRAM_CONFIG)

    course = Course(title="C5", status=CourseStatus.published)
    db.add(course)
    await db.flush()
    node = CourseNode(course_id=course.id, type=CourseNodeType.module, title="M1", sort_order=0)
    db.add(node)
    await db.flush()
    db.add(CourseNodeTask(node_id=node.id, task_id=task["id"], sort_order=0))
    await db.flush()
    await enroll(db, student_user, course.id)
    await db.commit()

    resp_student = await client.get(f"/api/tasks/{task['id']}", headers=student_headers)
    assert resp_student.json()["interactive_config"] is None
