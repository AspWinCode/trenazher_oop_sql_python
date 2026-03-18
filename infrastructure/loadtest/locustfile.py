"""
Load test for Task Checker Platform.
Target: 300 concurrent users.

Run:
    pip install locust
    locust -f locustfile.py --host=http://localhost:8000

Then open http://localhost:8089 and configure:
    Users: 300
    Spawn rate: 10
    Host: http://localhost:8000
"""

import random

from locust import HttpUser, between, task


class StudentUser(HttpUser):
    wait_time = between(2, 8)
    token = None
    user_login = None

    def on_start(self):
        n = random.randint(1, 100000)
        self.user_login = "loadtest_{}".format(n)
        try:
            resp = self.client.post("/api/auth/login", json={
                "login": "admin", "password": "admin",
            })
            admin_token = resp.json()["token"]
            self.client.post(
                "/api/users",
                json={"login": self.user_login, "password": "test123", "role": "student"},
                headers={"Authorization": "Bearer {}".format(admin_token)},
            )
        except Exception:
            pass

        resp = self.client.post("/api/auth/login", json={
            "login": self.user_login, "password": "test123",
        })
        if resp.status_code == 200:
            self.token = resp.json()["token"]
        else:
            resp = self.client.post("/api/auth/login", json={
                "login": "admin", "password": "admin",
            })
            self.token = resp.json()["token"]

    def _headers(self):
        return {"Authorization": "Bearer {}".format(self.token)}

    @task(3)
    def list_courses(self):
        self.client.get("/api/courses", headers=self._headers())

    @task(5)
    def list_tasks(self):
        self.client.get("/api/tasks", headers=self._headers())

    @task(5)
    def get_task(self):
        resp = self.client.get("/api/tasks?limit=5", headers=self._headers())
        tasks = resp.json()
        if tasks:
            tid = random.choice(tasks)["id"]
            self.client.get("/api/tasks/{}".format(tid), headers=self._headers(), name="/api/tasks/[id]")

    @task(2)
    def submit_solution(self):
        resp = self.client.get("/api/tasks?limit=5", headers=self._headers())
        tasks = resp.json()
        if tasks:
            tid = random.choice(tasks)["id"]
            self.client.post("/api/submissions", json={
                "task_id": tid,
                "code": "print('hello')",
            }, headers=self._headers())

    @task(3)
    def list_submissions(self):
        self.client.get("/api/submissions?limit=10", headers=self._headers())

    @task(2)
    def get_progress(self):
        self.client.get("/api/progress", headers=self._headers())

    @task(1)
    def health_check(self):
        self.client.get("/api/health")
