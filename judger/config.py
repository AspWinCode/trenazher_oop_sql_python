import os


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value


REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
BACKEND_INTERNAL_URL = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:8000/api/submissions/internal")
JUDGER_INTERNAL_TOKEN = _require_env("JUDGER_INTERNAL_TOKEN")
BACKEND_REQUEST_TIMEOUT = float(os.environ.get("BACKEND_REQUEST_TIMEOUT", "10"))

SANDBOX_IMAGE_PYTHON = os.environ.get("SANDBOX_IMAGE_PYTHON", "platform-sandbox-python:latest")
SANDBOX_IMAGE_SQL = os.environ.get("SANDBOX_IMAGE_SQL", "platform-sandbox-sql:latest")
SANDBOX_IMAGE_CPP = os.environ.get("SANDBOX_IMAGE_CPP", "platform-sandbox-cpp:latest")
SANDBOX_IMAGE_JS = os.environ.get("SANDBOX_IMAGE_JS", "platform-sandbox-js:latest")
SANDBOX_TIMEOUT = int(os.environ.get("SANDBOX_TIMEOUT", "30"))
SANDBOX_MEMORY_LIMIT = os.environ.get("SANDBOX_MEMORY_LIMIT", "256m")
SANDBOX_CPU_PERIOD = int(os.environ.get("SANDBOX_CPU_PERIOD", "100000"))
SANDBOX_CPU_QUOTA = int(os.environ.get("SANDBOX_CPU_QUOTA", "50000"))
SANDBOX_PIDS_LIMIT = int(os.environ.get("SANDBOX_PIDS_LIMIT", "64"))
SANDBOX_MAX_CONCURRENT = int(os.environ.get("SANDBOX_MAX_CONCURRENT", "8"))

SECCOMP_PROFILE = os.environ.get("SECCOMP_PROFILE", "")  # path to seccomp JSON, empty = default docker profile
