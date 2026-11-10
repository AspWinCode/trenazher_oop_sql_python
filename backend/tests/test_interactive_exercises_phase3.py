import pytest
from httpx import AsyncClient

SOLUTION_CORRECTION_CONFIG = {
    "initial_content": "profit = revenue + cost",
    "correct_values": ["profit = revenue - cost"],
}

SITUATION_CHOICE_CONFIG = {
    "description": "Конверсия сайта упала с 5% до 2% за месяц, трафик не изменился.",
    "question": "Какая наиболее вероятная причина?",
    "mode": "choice",
    "options": [
        {"id": "a", "text": "Сломалась форма оплаты"},
        {"id": "b", "text": "Вырос трафик из соцсетей"},
        {"id": "c", "text": "Сменился логотип"},
    ],
    "correct_option_ids": ["a"],
}

SITUATION_TEXT_CONFIG = {
    "description": "CAC вырос в 2 раза за квартал.",
    "question": "Что надо сделать в первую очередь?",
    "mode": "text",
    "accepted_answers": ["проверить каналы привлечения"],
    "case_sensitive": False,
}

FIND_ERROR_CONFIG = {
    "items": [
        {"id": "l1", "text": "SELECT * FROM users"},
        {"id": "l2", "text": "WHERE active = tru"},
        {"id": "l3", "text": "ORDER BY id"},
    ],
    "correct_error_ids": ["l2"],
}

GROUPING_CONFIG = {
    "items": [
        {"id": "i1", "text": "ROI"},
        {"id": "i2", "text": "Рентабельность"},
        {"id": "i3", "text": "CTR"},
        {"id": "i4", "text": "CPC"},
    ],
    "correct_groups": [["i1", "i2"], ["i3", "i4"]],
}

RESTORE_STRUCTURE_CONFIG = {
    "slots": [{"id": "s1", "label": "Шаг 1"}, {"id": "s2", "label": "Шаг 2"}],
    "pool": [
        {"id": "p1", "text": "Сбор требований"},
        {"id": "p2", "text": "Деплой"},
        {"id": "p3", "text": "Код-ревью"},
    ],
    "correct_placements": {"s1": "p1", "s2": "p3"},
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
async def test_create_phase3_tasks_each_mechanic(client: AsyncClient, admin_headers):
    for mechanic, config in [
        ("solution_correction", SOLUTION_CORRECTION_CONFIG),
        ("situation_analysis", SITUATION_CHOICE_CONFIG),
        ("find_error", FIND_ERROR_CONFIG),
        ("grouping", GROUPING_CONFIG),
        ("restore_structure", RESTORE_STRUCTURE_CONFIG),
    ]:
        data = await _create_task(client, admin_headers, mechanic, config)
        assert data["mechanic"] == mechanic


@pytest.mark.asyncio
async def test_solution_correction_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "solution_correction", SOLUTION_CORRECTION_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"corrected_content": "profit = revenue - cost"}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"corrected_content": "profit = revenue + cost"}},
        headers=student_headers,
    )
    assert wrong.json()["verdict"] == "WA"


@pytest.mark.asyncio
async def test_situation_analysis_choice_and_text(client: AsyncClient, admin_headers, student_headers):
    choice_task = await _create_task(client, admin_headers, "situation_analysis", SITUATION_CHOICE_CONFIG)
    correct = await client.post(
        "/api/submissions",
        json={"task_id": choice_task["id"], "answer_data": {"selected_option_ids": ["a"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    text_task = await _create_task(client, admin_headers, "situation_analysis", SITUATION_TEXT_CONFIG)
    correct_text = await client.post(
        "/api/submissions",
        json={"task_id": text_task["id"], "answer_data": {"answer": "Проверить каналы привлечения"}},
        headers=student_headers,
    )
    assert correct_text.json()["verdict"] == "AC"


@pytest.mark.asyncio
async def test_find_error_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "find_error", FIND_ERROR_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["l2"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_ids": ["l1"]}},
        headers=student_headers,
    )
    assert wrong.json()["verdict"] == "WA"
    assert wrong.json()["score"] == 0.0


@pytest.mark.asyncio
async def test_grouping_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "grouping", GROUPING_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"groups": [["i2", "i1"], ["i4", "i3"]]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"groups": [["i1", "i2", "i3"], ["i4"]]}},
        headers=student_headers,
    )
    body = wrong.json()
    assert body["verdict"] == "WA"
    assert 0 < body["score"] < 1.0


@pytest.mark.asyncio
async def test_restore_structure_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_task(client, admin_headers, "restore_structure", RESTORE_STRUCTURE_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"placements": {"s1": "p1", "s2": "p3"}}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"placements": {"s1": "p1", "s2": "p2"}}},
        headers=student_headers,
    )
    body = partial.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(0.5)


@pytest.mark.asyncio
async def test_student_never_sees_phase3_config(client: AsyncClient, admin_headers, student_headers, db, student_user):
    from tests.conftest import enroll
    from app.models.course import Course, CourseStatus
    from app.models.course_node import CourseNode, CourseNodeType
    from app.models.course_node_task import CourseNodeTask

    task = await _create_task(client, admin_headers, "grouping", GROUPING_CONFIG)

    course = Course(title="C3", status=CourseStatus.published)
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
