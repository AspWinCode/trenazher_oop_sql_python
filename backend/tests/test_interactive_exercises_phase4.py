import pytest
from httpx import AsyncClient

FORMULA_CONFIG = {
    "slots": [{"id": "s1"}, {"id": "s2"}, {"id": "s3"}],
    "blocks": [
        {"id": "profit", "text": "Прибыль"},
        {"id": "plus", "text": "+"},
        {"id": "minus", "text": "-"},
        {"id": "revenue", "text": "Выручка"},
        {"id": "cost", "text": "Себестоимость"},
    ],
    "correct_sequences": [["revenue", "minus", "cost"]],
}

OBJECT_ASSEMBLY_CONFIG = {
    "zones": [{"id": "z1", "label": "Голова"}, {"id": "z2", "label": "Тело"}],
    "parts": [
        {"id": "p1", "text": "Голова робота"},
        {"id": "p2", "text": "Корпус робота"},
        {"id": "p3", "text": "Лишняя деталь"},
    ],
    "correct_placements": {"z1": "p1", "z2": "p2"},
}

PARAMETER_CONFIG = {
    "parameters": [
        {"id": "price", "label": "Цена", "min": 0, "max": 1000, "step": 10, "default": 500},
        {"id": "qty", "label": "Количество", "min": 0, "max": 100, "step": 1, "default": 10},
    ],
    "formula": "price * qty",
    "target_min": 4000,
    "target_max": 6000,
}

HOTSPOT_CONFIG = {
    "regions": [
        {"id": "r1", "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2},
        {"id": "r2", "x": 0.5, "y": 0.5, "width": 0.2, "height": 0.2},
        {"id": "r3", "x": 0.8, "y": 0.1, "width": 0.1, "height": 0.1},
    ],
    "correct_region_ids": ["r1", "r2"],
}

POINT_SELECTION_CONFIG = {
    "target_points": [
        {"id": "t1", "x": 0.2, "y": 0.3, "radius": 0.05},
        {"id": "t2", "x": 0.7, "y": 0.8, "radius": 0.05},
    ],
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
async def test_create_phase4_tasks_each_mechanic(client: AsyncClient, admin_headers):
    for mechanic, config in [
        ("formula_builder", FORMULA_CONFIG),
        ("object_assembly", OBJECT_ASSEMBLY_CONFIG),
        ("parameter_adjustment", PARAMETER_CONFIG),
        ("hotspot", HOTSPOT_CONFIG),
        ("point_selection", POINT_SELECTION_CONFIG),
    ]:
        data = await _create_task(client, admin_headers, mechanic, config)
        assert data["mechanic"] == mechanic


@pytest.mark.asyncio
async def test_create_rejects_unsafe_formula(client: AsyncClient, admin_headers):
    bad_config = {**PARAMETER_CONFIG, "formula": "__import__('os').system('echo hi')"}
    resp = await client.post(
        "/api/tasks",
        json={
            "title": "Bad formula",
            "task_type": "interactive",
            "runner_type": "interactive_runner",
            "mechanic": "parameter_adjustment",
            "interactive_config": bad_config,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_formula_builder_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "formula_builder", FORMULA_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"sequence": ["revenue", "minus", "cost"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"sequence": ["revenue", "plus", "cost"]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(2 / 3)


@pytest.mark.asyncio
async def test_object_assembly_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "object_assembly", OBJECT_ASSEMBLY_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"placements": {"z1": "p1", "z2": "p2"}}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"placements": {"z1": "p1", "z2": "p3"}}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_parameter_adjustment_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "parameter_adjustment", PARAMETER_CONFIG)

    in_range = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"values": {"price": 500, "qty": 10}}},
        headers=student_headers,
    )
    assert in_range.json()["verdict"] == "AC"

    out_of_range = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"values": {"price": 10, "qty": 1}}},
        headers=student_headers,
    )
    assert out_of_range.json()["verdict"] == "WA"


@pytest.mark.asyncio
async def test_hotspot_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "hotspot", HOTSPOT_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_region_ids": ["r1", "r2"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_region_ids": ["r1"]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_point_selection_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "point_selection", POINT_SELECTION_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"points": [{"x": 0.21, "y": 0.31}, {"x": 0.69, "y": 0.79}]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"points": [{"x": 0.21, "y": 0.31}, {"x": 0.0, "y": 0.0}]}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_student_never_sees_phase4_config(client: AsyncClient, admin_headers, student_headers, db, student_user):
    from tests.conftest import enroll
    from app.models.course import Course, CourseStatus
    from app.models.course_node import CourseNode, CourseNodeType
    from app.models.course_node_task import CourseNodeTask

    task = await _create_task(client, admin_headers, "hotspot", HOTSPOT_CONFIG)

    course = Course(title="C4", status=CourseStatus.published)
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
