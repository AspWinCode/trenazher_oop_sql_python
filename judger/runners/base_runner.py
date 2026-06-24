from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TestResult:
    test_id: int
    verdict: str
    runtime: float = 0.0
    actual_output: str = ""
    # Ожидаемый результат, вычисленный раннером (например, эталонные строки SQL).
    # Для типов, где эталона нет (pytest), остаётся пустым.
    expected_output: str = ""


def summarize_pytest_failure(stdout: str, limit: int = 2000) -> str:
    """Из сырого вывода pytest вытащить суть провала: строки ассертов/ошибок
    (в pytest они начинаются с 'E '). Эталонного значения у pytest-задач нет,
    поэтому студенту показываем именно разбор ошибки, а не код теста."""
    lines = stdout.splitlines()
    picked = [ln.rstrip()[1:].strip() for ln in lines if ln.startswith("E ")]
    if not picked:
        failed = [ln.strip() for ln in lines if ln.strip().startswith("FAILED")]
        picked = failed if failed else [ln for ln in lines if ln.strip()][-15:]
    return "\n".join(picked)[:limit]


@dataclass
class RunResult:
    verdict: str
    runtime: float = 0.0
    memory: float = 0.0
    error_output: str = ""
    test_results: list[TestResult] = field(default_factory=list)


class BaseRunner(ABC):
    @abstractmethod
    def run(self, code: str, tests: list[dict], **kwargs) -> RunResult:
        pass
