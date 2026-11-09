import pytest
from httpx import AsyncClient

CATEGORIZATION_CONFIG = {
    "categories": [{"id": "cat_income", "label": "Доход"}, {"id": "cat_expense", "label": "Расход"}],
    "items": [
        {"id": "i1", "text": "Зарплата"},
        {"id": "i2", "text": "Аренда офиса"},
        {"id": "i3", "text": "Премия"},
    ],
    "correct_assignments": {
        "i1": ["cat_income"],
        "i2": ["cat_expense"],
        "i3": ["cat_income"],
    },
}

ODD_ONE_OUT_CONFIG = {
    "items": [
        {"id": "i1", "text": "ROI"},
        {"id": "i2", "text": "CAC"},
        {"id": "i3", "text": "Пицца"},
    ],
    "correct_odd_ids": ["i3"],
}

MULTI_SELECT_CONFIG = {
    "items": [
        {"id": "i1", "text": "ROI"},
        {"id": "i2", "text": "Рентабельность"},
        {"id": "i3", "text": "CTR"},
    ],
    "correct_ids": ["i1", "i2"],
}

PATTERN_CONFIG = {
    "sequence_shown": ["2", "4", "6", "8"],
    "next_values": ["10", "12"],
    "input_mode": "number",
    "tolerance": 0,
}

TABLE_FILL_CONFIG = {
    "columns": [{"id": "revenue", "label": "Выручка"}, {"id": "profit", "label": "Прибыль"}],
    "rows": [{"id": "q1", "label": "Q1"}, {"id": "q2", "label": "Q2"}],
    "correct_cells": {
        "q1:profit": {"type": "number", "values": ["100"], "tolerance": 0.5},
        "q2:profit": {"type": "number", "values": ["200"], "tolerance": 0.5},
    },
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
async def test_create_phase2_tasks_each_mechanic(client: AsyncClient, admin_headers):
    for mechanic, config in [
        ("categorization", CATEGORIZATION_CONFIG),
        ("odd_one_out", ODD_ONE_OUT_CONFIG),
        ("multi_select_elements", MULTI_SELECT_CONFIG),
        ("pattern_completion", PATTERN_CONFIG),
        ("table_fill", TABLE_FILL_CONFIG),
    ]:
        data = await _create_task(client, admin_headers, mechanic, config)
        assert data["mechanic"] == mechanic


@pytest.mark.asyncio
async def test_categorization_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "categorization", CATEGORIZATION_CONFIG)

    full = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"assignments": {"i1": "cat_income", "i2": "cat_expense", "i3": "cat_income"}}},
        headers=student_headers,
    )
    assert full.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"assignments": {"i1": "cat_income", "i2": "cat_income", "i3": "cat_income"}}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(2 / 3)


@pytest.mark.asyncio
async def test_odd_one_out_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "odd_one_out", ODD_ONE_OUT_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["i3"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["i1"]}},
        headers=student_headers,
    )
    assert wrong.json()["verdict"] == "WA"
    assert wrong.json()["score"] == 0.0


@pytest.mark.asyncio
async def test_multi_select_elements_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "multi_select_elements", MULTI_SELECT_CONFIG)

    full = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["i1", "i2"]}},
        headers=student_headers,
    )
    assert full.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["i1"]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)

    all_wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["i3"]}},
        headers=student_headers,
    )
    assert all_wrong.json()["verdict"] == "WA"
    assert all_wrong.json()["score"] == 0.0


@pytest.mark.asyncio
async def test_pattern_completion_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "pattern_completion", PATTERN_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"values": ["10", "12"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"values": ["10", "99"]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_table_fill_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "table_fill", TABLE_FILL_CONFIG)

    full = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"cells": {"q1:profit": "100", "q2:profit": "200"}}},
        headers=student_headers,
    )
    assert full.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"cells": {"q1:profit": "100", "q2:profit": "999"}}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_student_never_sees_phase2_config(client: AsyncClient, admin_headers, student_headers, db, student_user):
    from tests.conftest import enroll
    from app.models.course import Course, CourseStatus
    from app.models.course_node import CourseNode, CourseNodeType
    from app.models.course_node_task import CourseNodeTask

    task = await _create_task(client, admin_headers, "categorization", CATEGORIZATION_CONFIG)

    course = Course(title="C2", status=CourseStatus.published)
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
