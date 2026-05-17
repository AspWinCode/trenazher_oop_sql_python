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


def run_pytest_sandbox(code, test_code, extra_files=None, timeout=None):
    """Run pytest sandbox.

    extra_files: list of {"name": str, "content": str} written alongside solution.py.
    Used to provide CSV/JSON/Excel data files for pandas/matplotlib tasks.
    """
    timeout = timeout or SANDBOX_TIMEOUT
    _semaphore.acquire()
    work_dir = _mk_work_dir(prefix="sandbox_")
    try:
        with open(os.path.join(work_dir, "solution.py"), "w") as f:
            f.write(code)
        with open(os.path.join(work_dir, "test_solution.py"), "w") as f:
            f.write(test_code)
        for file_entry in (extra_files or []):
            fname = os.path.basename(file_entry.get("name", ""))
            if fname:
                with open(os.path.join(work_dir, fname), "w", encoding="utf-8") as f:
                    f.write(file_entry.get("content", ""))

        container = client.containers.run(
            SANDBOX_IMAGE_PYTHON,
            command=["sh", "-c",
                     "cp /workspace/* /tmp/ 2>/dev/null || true && "
                     "cd /tmp && python -m pytest test_solution.py -v --tb=short "
                     "-p no:cacheprovider 2>&1"],
            volumes={work_dir: {"bind": "/workspace", "mode": "ro"}},
            environment={"PYTHONDONTWRITEBYTECODE": "1", "MPLBACKEND": "Agg"},
            mem_limit=SANDBOX_MEMORY_LIMIT,
            cpu_period=SANDBOX_CPU_PERIOD,
            cpu_quota=SANDBOX_CPU_QUOTA,
            pids_limit=SANDBOX_PIDS_LIMIT,
            network_disabled=True,
            read_only=True,
            security_opt=_security_opt(),
            tmpfs={"/tmp": "size=128m"},
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


def run_sql_sandbox(student_sql, schema_sql, seed_sql, expected_sql, verification_sql=None, timeout=None):
    """Run SQL sandbox.

    Two modes:
    - SELECT mode (verification_sql is None/empty): student.sql and expected.sql are both
      run on separate identical databases; their text outputs are compared directly.
      Used for tasks where the student writes a SELECT query.
    - DML mode (verification_sql is set): student.sql and expected.sql are each run as DML
      on separate databases, then verification_sql (a SELECT) is run on both and results
      compared. Used for INSERT/UPDATE/DELETE/CREATE TABLE tasks.
    """
    timeout = timeout or SANDBOX_TIMEOUT
    _semaphore.acquire()
    work_dir = _mk_work_dir(prefix="sandbox_sql_")
    try:
        for name, content in [
            ("schema.sql", schema_sql),
            ("seed.sql", seed_sql),
            ("student.sql", student_sql),
            ("expected.sql", expected_sql),
            ("verification.sql", verification_sql),
        ]:
            with open(os.path.join(work_dir, name), "w") as f:
                f.write(content or "")

        script = """#!/bin/sh
set -e
mkdir -p /var/lib/postgresql/data /run/postgresql
chown -R postgres:postgres /var/lib/postgresql /run/postgresql
su-exec postgres pg_ctl initdb -D /var/lib/postgresql/data -o "--auth=trust --username=postgres" -s
su-exec postgres pg_ctl start -D /var/lib/postgresql/data -l /tmp/pg.log -w -s

# Setup student database
su-exec postgres createdb sandbox_student
su-exec postgres psql -d sandbox_student -q -f /workspace/schema.sql
su-exec postgres psql -d sandbox_student -q -f /workspace/seed.sql

# Setup expected database
su-exec postgres createdb sandbox_expected
su-exec postgres psql -d sandbox_expected -q -f /workspace/schema.sql
su-exec postgres psql -d sandbox_expected -q -f /workspace/seed.sql

if [ -s /workspace/verification.sql ]; then
    # DML mode: run student/expected SQL silently, then compare via verification query
    su-exec postgres psql -d sandbox_student -q -f /workspace/student.sql > /dev/null 2>&1 || true
    su-exec postgres psql -d sandbox_expected -q -f /workspace/expected.sql > /dev/null 2>&1 || true
    STUDENT=$(su-exec postgres psql -d sandbox_student -t -A -f /workspace/verification.sql 2>&1)
    EXPECTED=$(su-exec postgres psql -d sandbox_expected -t -A -f /workspace/verification.sql 2>&1)
else
    # SELECT mode: compare direct output of student vs expected query
    STUDENT=$(su-exec postgres psql -d sandbox_student -t -A -f /workspace/student.sql 2>&1)
    EXPECTED=$(su-exec postgres psql -d sandbox_expected -t -A -f /workspace/expected.sql 2>&1)
fi

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
            command=["/workspace/run.sh"],
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
