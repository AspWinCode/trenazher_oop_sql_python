import pytest
from httpx import AsyncClient

MC_CONFIG = {
    "mode": "multi",
    "options": [
        {"id": "a", "text": "ROI"},
        {"id": "b", "text": "CAC"},
        {"id": "c", "text": "CTR"},
    ],
    "correct_option_ids": ["a", "b"],
}

MATCHING_CONFIG = {
    "left": [{"id": "l1", "text": "Dog"}, {"id": "l2", "text": "Cat"}],
    "right": [{"id": "r1", "text": "Woof"}, {"id": "r2", "text": "Meow"}],
    "correct_pairs": [["l1", "r1"], ["l2", "r2"]],
}

ORDERING_CONFIG = {
    "items": [{"id": "i1", "text": "Mix"}, {"id": "i2", "text": "Bake"}, {"id": "i3", "text": "Serve"}],
    "correct_order": ["i1", "i2", "i3"],
}

FILL_BLANKS_CONFIG = {
    "template": "ROI = {{profit}} / {{cost}}",
    "blanks": [
        {"id": "profit", "input_mode": "text", "correct_values": ["profit", "Profit"]},
        {"id": "cost", "input_mode": "number", "correct_values": ["100"], "tolerance": 0.5},
    ],
}

INPUT_ANSWER_TEXT_CONFIG = {"answer_type": "text", "accepted_answers": ["Paris"], "case_sensitive": False}
INPUT_ANSWER_NUMBER_CONFIG = {"answer_type": "number", "numeric_value": 42.0, "tolerance": 0.5}


async def _create_interactive_task(client: AsyncClient, admin_headers, mechanic: str, config: dict, status: str = "published"):
    resp = await client.post(
        "/api/tasks",
        json={
            "title": f"Task {mechanic}",
            "task_type": "interactive",
            "runner_type": "interactive_runner",
            "status": status,
            "mechanic": mechanic,
            "interactive_config": config,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_interactive_task_each_mechanic(client: AsyncClient, admin_headers):
    for mechanic, config in [
        ("multiple_choice", MC_CONFIG),
        ("matching", MATCHING_CONFIG),
        ("ordering", ORDERING_CONFIG),
        ("fill_blanks", FILL_BLANKS_CONFIG),
        ("input_answer", INPUT_ANSWER_TEXT_CONFIG),
    ]:
        data = await _create_interactive_task(client, admin_headers, mechanic, config)
        assert data["mechanic"] == mechanic
        assert data["interactive_config"] is not None


@pytest.mark.asyncio
async def test_create_rejects_invalid_config(client: AsyncClient, admin_headers):
    resp = await client.post(
        "/api/tasks",
        json={
            "title": "Bad",
            "task_type": "interactive",
            "runner_type": "interactive_runner",
            "mechanic": "multiple_choice",
            "interactive_config": {"mode": "single", "options": [{"id": "a", "text": "x"}], "correct_option_ids": []},
        },
        headers=admin_headers,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_allows_empty_config_as_draft_shell(client: AsyncClient, admin_headers):
    resp = await client.post(
        "/api/tasks",
        json={
            "title": "Draft shell",
            "task_type": "interactive",
            "runner_type": "interactive_runner",
            "mechanic": "multiple_choice",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_student_never_sees_interactive_config(client: AsyncClient, admin_headers, student_headers, db, student_user):
    from tests.conftest import enroll
    from app.models.course import Course, CourseStatus
    from app.models.course_node import CourseNode, CourseNodeType
    from app.models.course_node_task import CourseNodeTask

    task = await _create_interactive_task(client, admin_headers, "multiple_choice", MC_CONFIG)

    course = Course(title="C1", status=CourseStatus.published)
    db.add(course)
    await db.flush()
    node = CourseNode(course_id=course.id, type=CourseNodeType.module, title="M1", sort_order=0)
    db.add(node)
    await db.flush()
    db.add(CourseNodeTask(node_id=node.id, task_id=task["id"], sort_order=0))
    await db.flush()
    await enroll(db, student_user, course.id)
    await db.commit()

    resp_admin = await client.get(f"/api/tasks/{task['id']}", headers=admin_headers)
    assert resp_admin.json()["interactive_config"] is not None

    resp_student = await client.get(f"/api/tasks/{task['id']}", headers=student_headers)
    assert resp_student.status_code == 200
    assert resp_student.json()["interactive_config"] is None

    # cached path must strip too
    resp_student_2 = await client.get(f"/api/tasks/{task['id']}", headers=student_headers)
    assert resp_student_2.json()["interactive_config"] is None


@pytest.mark.asyncio
async def test_multiple_choice_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_interactive_task(client, admin_headers, "multiple_choice", MC_CONFIG)
    resp = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_option_ids": ["a", "b"]}},
        headers=student_headers,
    )
    assert resp.status_code == 201
    sub = resp.json()
    assert sub["verdict"] == "AC"
    assert sub["score"] == 1.0


@pytest.mark.asyncio
async def test_multiple_choice_partial_credit(client: AsyncClient, admin_headers, student_headers):
    task = await _create_interactive_task(client, admin_headers, "multiple_choice", MC_CONFIG)
    resp = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"selected_option_ids": ["a"]}},
        headers=student_headers,
    )
    sub = resp.json()
    assert sub["verdict"] == "WA"
    assert 0 < sub["score"] < 1.0


@pytest.mark.asyncio
async def test_matching_grading_full_and_partial(client: AsyncClient, admin_headers, student_headers):
    task = await _create_interactive_task(client, admin_headers, "matching", MATCHING_CONFIG)

    full = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"pairs": [["l1", "r1"], ["l2", "r2"]]}},
        headers=student_headers,
    )
    assert full.json()["verdict"] == "AC"

    partial = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"pairs": [["l1", "r1"]]}},
        headers=student_headers,
    )
    assert partial.json()["verdict"] == "WA"
    assert partial.json()["score"] == 0.5


@pytest.mark.asyncio
async def test_ordering_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_interactive_task(client, admin_headers, "ordering", ORDERING_CONFIG)

    correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"order": ["i1", "i2", "i3"]}},
        headers=student_headers,
    )
    assert correct.json()["verdict"] == "AC"

    scrambled = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"order": ["i2", "i1", "i3"]}},
        headers=student_headers,
    )
    body = scrambled.json()
    assert body["verdict"] == "WA"
    assert body["score"] == pytest.approx(1 / 3)


@pytest.mark.asyncio
async def test_fill_blanks_grading(client: AsyncClient, admin_headers, student_headers):
    task = await _create_interactive_task(client, admin_headers, "fill_blanks", FILL_BLANKS_CONFIG)

    all_correct = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"blanks": {"profit": "profit", "cost": "100"}}},
        headers=student_headers,
    )
    assert all_correct.json()["verdict"] == "AC"

    one_wrong = await client.post(
        "/api/submissions",
        json={"task_id": task["id"], "answer_data": {"blanks": {"profit": "nope", "cost": "100"}}},
        headers=student_headers,
    )
    body = one_wrong.json()
    assert body["verdict"] == "WA"
    assert body["score"] == 0.5


@pytest.mark.asyncio
async def test_input_answer_text_and_number(client: AsyncClient, admin_headers, student_headers):
    text_task = await _create_interactive_task(client, admin_headers, "input_answer", INPUT_ANSWER_TEXT_CONFIG)
    ok = await client.post(
        "/api/submissions",
        json={"task_id": text_task["id"], "answer_data": {"answer": "paris"}},
        headers=student_headers,
    )
    assert ok.json()["verdict"] == "AC"  # case-insensitive by config

    bad = await client.post(
        "/api/submissions",
        json={"task_id": text_task["id"], "answer_data": {"answer": "London"}},
        headers=student_headers,
    )
    assert bad.json()["verdict"] == "WA"

    num_task = await _create_interactive_task(client, admin_headers, "input_answer", INPUT_ANSWER_NUMBER_CONFIG)
    within = await client.post(
        "/api/submissions",
        json={"task_id": num_task["id"], "answer_data": {"answer": "42.3"}},
        headers=student_headers,
    )
    assert within.json()["verdict"] == "AC"

    outside = await client.post(
        "/api/submissions",
        json={"task_id": num_task["id"], "answer_data": {"answer": "50"}},
        headers=student_headers,
    )
    assert outside.json()["verdict"] == "WA"


@pytest.mark.asyncio
async def test_submit_rejects_mismatched_payload(client: AsyncClient, admin_headers, student_headers):
    interactive_task = await _create_interactive_task(client, admin_headers, "input_answer", INPUT_ANSWER_TEXT_CONFIG)
    resp = await client.post(
        "/api/submissions",
        json={"task_id": interactive_task["id"], "code": "print(1)"},
        headers=student_headers,
    )
    assert resp.status_code == 422

    code_task = await client.post(
        "/api/tasks",
        json={"title": "Code task", "task_type": "python_io", "runner_type": "stdin_runner"},
        headers=admin_headers,
    )
    resp2 = await client.post(
        "/api/submissions",
        json={"task_id": code_task.json()["id"], "answer_data": {"answer": "x"}},
        headers=student_headers,
    )
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_existing_task_types_still_enqueue_celery(client: AsyncClient, admin_headers, student_headers, monkeypatch):
    calls = []
    import app.services.submission_lifecycle_service as lifecycle_mod

    def fake_enqueue(payload):
        calls.append(payload)

    monkeypatch.setattr(lifecycle_mod, "enqueue_submission", fake_enqueue)

    code_task = await client.post(
        "/api/tasks",
        json={"title": "Sum", "task_type": "python_io", "runner_type": "stdin_runner"},
        headers=admin_headers,
    )
    task_id = code_task.json()["id"]

    resp = await client.post(
        "/api/submissions",
        json={"task_id": task_id, "code": "print(1)"},
        headers=student_headers,
    )
    assert resp.status_code == 201
    assert len(calls) == 1
    assert calls[0]["task_type"] == "python_io"

    interactive_task = await _create_interactive_task(client, admin_headers, "input_answer", INPUT_ANSWER_TEXT_CONFIG)
    await client.post(
        "/api/submissions",
        json={"task_id": interactive_task["id"], "answer_data": {"answer": "Paris"}},
        headers=student_headers,
    )
    # interactive submissions must never go through enqueue_submission/Celery
    assert len(calls) == 1
