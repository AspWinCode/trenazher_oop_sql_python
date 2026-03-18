import json
import os
import sys
import time
import uuid

import requests
from websocket import WebSocketTimeoutException, create_connection

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
ADMIN_LOGIN = os.environ.get("ADMIN_LOGIN", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")
E2E_TIMEOUT = int(os.environ.get("E2E_TIMEOUT", "120"))
E2E_HEALTH_TIMEOUT = int(os.environ.get("E2E_HEALTH_TIMEOUT", "120"))


def http_url(path: str) -> str:
    return f"{BASE_URL}{path}"


def ws_base_url() -> str:
    if BASE_URL.startswith("https://"):
        return "wss://" + BASE_URL[len("https://") :]
    if BASE_URL.startswith("http://"):
        return "ws://" + BASE_URL[len("http://") :]
    raise ValueError(f"Unsupported BASE_URL: {BASE_URL}")


def wait_for_backend_ready(timeout: int) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = requests.get(http_url("/api/health"), timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") in {"ok", "degraded"}:
                    return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError("Backend health check did not become ready in time")


def login_admin() -> str:
    resp = requests.post(
        http_url("/api/auth/login"),
        json={"login": ADMIN_LOGIN, "password": ADMIN_PASSWORD},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("token")
    if not token:
        raise RuntimeError("No access token in login response")
    return token


def create_task(token: str) -> dict:
    payload = {
        "title": f"e2e-python-io-{uuid.uuid4().hex[:8]}",
        "task_type": "python_io",
        "runner_type": "stdin_runner",
        "status": "published",
        "tests": [
            {"test_type": "public", "input_data": "1", "expected_output": "1", "order_index": 1},
            {"test_type": "hidden", "input_data": "7", "expected_output": "7", "order_index": 2},
        ],
    }
    resp = requests.post(
        http_url("/api/tasks"),
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def submit_solution(token: str, task_id: int) -> int:
    resp = requests.post(
        http_url("/api/submissions"),
        headers={"Authorization": f"Bearer {token}"},
        json={"task_id": task_id, "code": "print(input())"},
        timeout=10,
    )
    resp.raise_for_status()
    return int(resp.json()["id"])


def wait_finished_via_ws(token: str, submission_id: int, timeout: int) -> dict:
    ws_url = f"{ws_base_url()}/api/ws/submissions/{token}"
    ws = create_connection(ws_url, timeout=10)
    try:
        ws.send(json.dumps({"action": "subscribe", "submission_id": submission_id}))
        deadline = time.time() + timeout

        while time.time() < deadline:
            try:
                raw = ws.recv()
            except WebSocketTimeoutException:
                continue

            msg = json.loads(raw)
            if msg.get("type") != "submission_update":
                continue
            if int(msg.get("submission_id", -1)) != submission_id:
                continue
            if msg.get("status") == "finished":
                return msg

        raise TimeoutError("Timed out waiting for finished event over WebSocket")
    finally:
        try:
            ws.close()
        except Exception:
            pass


def assert_submission_detail(token: str, submission_id: int) -> None:
    resp = requests.get(
        http_url(f"/api/submissions/{submission_id}"),
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()

    detail = resp.json()
    if detail.get("status") != "finished":
        raise AssertionError(f"Expected finished status, got {detail.get('status')}")
    if detail.get("verdict") != "AC":
        raise AssertionError(f"Expected AC verdict, got {detail.get('verdict')}")


if __name__ == "__main__":
    try:
        wait_for_backend_ready(timeout=E2E_HEALTH_TIMEOUT)
        token = login_admin()
        task = create_task(token)
        submission_id = submit_solution(token, int(task["id"]))
        event = wait_finished_via_ws(token, submission_id, timeout=E2E_TIMEOUT)
        if event.get("verdict") != "AC":
            raise AssertionError(f"Expected AC in WS event, got {event.get('verdict')}")
        assert_submission_detail(token, submission_id)
        print(f"E2E OK: submission #{submission_id} finished with AC")
        sys.exit(0)
    except Exception as exc:
        print(f"E2E FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
