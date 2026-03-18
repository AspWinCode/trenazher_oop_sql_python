import logging
import os
import shutil
import tempfile
import threading
from typing import Optional

import docker

from judger.config import (
    SANDBOX_CPU_PERIOD,
    SANDBOX_CPU_QUOTA,
    SANDBOX_IMAGE_CPP,
    SANDBOX_IMAGE_JS,
    SANDBOX_IMAGE_PYTHON,
    SANDBOX_IMAGE_SQL,
    SANDBOX_MAX_CONCURRENT,
    SANDBOX_MEMORY_LIMIT,
    SANDBOX_PIDS_LIMIT,
    SANDBOX_TIMEOUT,
    SECCOMP_PROFILE,
)

log = logging.getLogger(__name__)
client = docker.from_env()

_semaphore = threading.Semaphore(SANDBOX_MAX_CONCURRENT)


def _security_opt():
    opts = ["no-new-privileges"]
    if SECCOMP_PROFILE:
        opts.append("seccomp={}".format(SECCOMP_PROFILE))
    return opts


def _mk_work_dir(prefix: str) -> str:
    work_dir = tempfile.mkdtemp(prefix=prefix)
    # Sandbox images run as non-root user; directory must be traversable.
    os.chmod(work_dir, 0o755)
    return work_dir


class SandboxResult:
    def __init__(self, exit_code, stdout, stderr, timed_out=False):
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        self.timed_out = timed_out


def run_python_sandbox(code, stdin_data="", timeout=None):
    timeout = timeout or SANDBOX_TIMEOUT
    _semaphore.acquire()
    work_dir = _mk_work_dir(prefix="sandbox_")
    try:
        with open(os.path.join(work_dir, "solution.py"), "w") as f:
            f.write(code)
        if stdin_data:
            with open(os.path.join(work_dir, "input.txt"), "w") as f:
                f.write(stdin_data)

        cmd = "python /workspace/solution.py < /workspace/input.txt" if stdin_data else "python /workspace/solution.py"
        container = client.containers.run(
            SANDBOX_IMAGE_PYTHON,
            command=["sh", "-c", cmd],
            volumes={work_dir: {"bind": "/workspace", "mode": "ro"}},
            mem_limit=SANDBOX_MEMORY_LIMIT,
            cpu_period=SANDBOX_CPU_PERIOD,
            cpu_quota=SANDBOX_CPU_QUOTA,
            pids_limit=SANDBOX_PIDS_LIMIT,
            network_disabled=True,
            read_only=True,
            security_opt=_security_opt(),
            tmpfs={"/tmp": "size=64m"},
            detach=True,
        )
        try:
            result = container.wait(timeout=timeout)
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
            return SandboxResult(result["StatusCode"], stdout, stderr)
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return SandboxResult(-1, "", "Time limit exceeded", timed_out=True)
        finally:
            try:
                container.remove(force=True)
            except Exception:
                log.warning("Failed to remove container")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        _semaphore.release()


def run_pytest_sandbox(code, test_code, timeout=None):
    timeout = timeout or SANDBOX_TIMEOUT
    _semaphore.acquire()
    work_dir = _mk_work_dir(prefix="sandbox_")
    try:
        with open(os.path.join(work_dir, "solution.py"), "w") as f:
            f.write(code)
        with open(os.path.join(work_dir, "test_solution.py"), "w") as f:
            f.write(test_code)

        container = client.containers.run(
            SANDBOX_IMAGE_PYTHON,
            command=["sh", "-c", "cd /workspace && python -m pytest test_solution.py -v --tb=short 2>&1"],
            volumes={work_dir: {"bind": "/workspace", "mode": "ro"}},
            mem_limit=SANDBOX_MEMORY_LIMIT,
            cpu_period=SANDBOX_CPU_PERIOD,
            cpu_quota=SANDBOX_CPU_QUOTA,
            pids_limit=SANDBOX_PIDS_LIMIT,
            network_disabled=True,
            read_only=True,
            security_opt=_security_opt(),
            tmpfs={"/tmp": "size=64m"},
            detach=True,
        )
        try:
            result = container.wait(timeout=timeout)
            output = container.logs().decode("utf-8", errors="replace")
            return SandboxResult(result["StatusCode"], output, "")
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return SandboxResult(-1, "", "Time limit exceeded", timed_out=True)
        finally:
            try:
                container.remove(force=True)
            except Exception:
                log.warning("Failed to remove container")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        _semaphore.release()


def run_sql_sandbox(student_sql, schema_sql, seed_sql, expected_sql, timeout=None):
    timeout = timeout or SANDBOX_TIMEOUT
    _semaphore.acquire()
    work_dir = _mk_work_dir(prefix="sandbox_sql_")
    try:
        for name, content in [
            ("schema.sql", schema_sql),
            ("seed.sql", seed_sql),
            ("student.sql", student_sql),
            ("expected.sql", expected_sql),
        ]:
            with open(os.path.join(work_dir, name), "w") as f:
                f.write(content or "")

        script = """#!/bin/sh
set -e
pg_isready -U postgres || (pg_ctlcluster 16 main start && sleep 1)
createdb -U postgres sandbox_test 2>/dev/null || true
psql -U postgres -d sandbox_test -f /workspace/schema.sql
psql -U postgres -d sandbox_test -f /workspace/seed.sql
STUDENT=$(psql -U postgres -d sandbox_test -t -A -f /workspace/student.sql 2>&1)
EXPECTED=$(psql -U postgres -d sandbox_test -t -A -f /workspace/expected.sql 2>&1)
dropdb -U postgres sandbox_test 2>/dev/null || true
if [ "$STUDENT" = "$EXPECTED" ]; then
    echo "MATCH"
    exit 0
else
    echo "STUDENT_OUTPUT:$STUDENT"
    echo "EXPECTED_OUTPUT:$EXPECTED"
    exit 1
fi
"""
        with open(os.path.join(work_dir, "run.sh"), "w") as f:
            f.write(script)

        container = client.containers.run(
            SANDBOX_IMAGE_SQL,
            command=["sh", "/workspace/run.sh"],
            volumes={work_dir: {"bind": "/workspace", "mode": "ro"}},
            mem_limit=SANDBOX_MEMORY_LIMIT,
            cpu_period=SANDBOX_CPU_PERIOD,
            cpu_quota=SANDBOX_CPU_QUOTA,
            pids_limit=SANDBOX_PIDS_LIMIT,
            network_disabled=True,
            security_opt=_security_opt(),
            tmpfs={"/tmp": "size=64m", "/run/postgresql": "size=16m", "/var/lib/postgresql": "size=128m"},
            detach=True,
        )
        try:
            result = container.wait(timeout=timeout)
            output = container.logs().decode("utf-8", errors="replace")
            return SandboxResult(result["StatusCode"], output, "")
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return SandboxResult(-1, "", "Time limit exceeded", timed_out=True)
        finally:
            try:
                container.remove(force=True)
            except Exception:
                log.warning("Failed to remove container")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        _semaphore.release()


def _run_io_sandbox(image, filename, run_cmd_template, code, stdin_data="", timeout=None):
    """Generic IO sandbox for compiled/interpreted languages."""
    timeout = timeout or SANDBOX_TIMEOUT
    _semaphore.acquire()
    work_dir = _mk_work_dir(prefix="sandbox_generic_")
    try:
        with open(os.path.join(work_dir, filename), "w") as f:
            f.write(code)
        if stdin_data:
            with open(os.path.join(work_dir, "input.txt"), "w") as f:
                f.write(stdin_data)
        cmd = run_cmd_template.format(input_redirect="< /workspace/input.txt" if stdin_data else "")
        container = client.containers.run(
            image,
            command=["sh", "-c", cmd],
            volumes={work_dir: {"bind": "/workspace", "mode": "ro"}},
            mem_limit=SANDBOX_MEMORY_LIMIT,
            cpu_period=SANDBOX_CPU_PERIOD,
            cpu_quota=SANDBOX_CPU_QUOTA,
            pids_limit=SANDBOX_PIDS_LIMIT,
            network_disabled=True,
            read_only=True,
            security_opt=_security_opt(),
            tmpfs={"/tmp": "size=64m"},
            detach=True,
        )
        try:
            result = container.wait(timeout=timeout)
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
            return SandboxResult(result["StatusCode"], stdout, stderr)
        except Exception:
            try:
                container.kill()
            except Exception:
                pass
            return SandboxResult(-1, "", "Time limit exceeded", timed_out=True)
        finally:
            try:
                container.remove(force=True)
            except Exception:
                log.warning("Failed to remove container")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        _semaphore.release()


def run_cpp_sandbox(code, stdin_data="", timeout=None):
    cmd = (
        "g++ -O2 -std=c++17 -o /tmp/solution /workspace/solution.cpp 2>&1 "
        "|| {{ echo 'compilation failed' >&2; exit 99; }}; /tmp/solution {input_redirect}"
    )
    return _run_io_sandbox(SANDBOX_IMAGE_CPP, "solution.cpp", cmd, code, stdin_data, timeout)


def run_js_sandbox(code, stdin_data="", timeout=None):
    cmd = "node /workspace/solution.js {input_redirect}"
    return _run_io_sandbox(SANDBOX_IMAGE_JS, "solution.js", cmd, code, stdin_data, timeout)
