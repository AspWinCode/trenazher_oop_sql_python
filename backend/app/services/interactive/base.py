from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


class ConfigError(ValueError):
    """Raised by validate_config/validate_answer on malformed admin config or answer."""


@dataclass
class CheckResult:
    status: str  # "AC" | "WA"
    score: float
    max_score: float
    details: dict = field(default_factory=dict)


class Checker(Protocol):
    """Common interface every interactive-exercise mechanic implements.

    Server-authoritative: `config` always carries the correct-answer data: it is
    stripped from the API response for non-admins before it ever reaches a
    student's browser (see api/tasks.py get_task), so checkers can assume they
    always have the real answer when grading.
    """

    def validate_config(self, config: Any) -> None:
        """Raise ConfigError if `config` is not a well-formed config for this mechanic."""
        ...

    def validate_answer(self, config: Any, answer: Any) -> None:
        """Raise ConfigError if `answer` is not shaped like a valid submission for this mechanic."""
        ...

    def check(self, config: Any, answer: Any) -> CheckResult:
        """Grade `answer` against `config`. Assumes validate_* already passed."""
        ...
