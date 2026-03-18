from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TestResult:
    test_id: int
    verdict: str
    runtime: float = 0.0
    actual_output: str = ""


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
