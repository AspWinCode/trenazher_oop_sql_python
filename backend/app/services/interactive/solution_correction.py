from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class SolutionCorrectionChecker:
    """config: {prompt?: str, initial_content: str, correct_values: [str, ...],
    case_sensitive?: bool}
    answer: {corrected_content: str}
    All-or-nothing (free-form corrected text vs. a list of accepted versions).
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        if not isinstance(config.get("initial_content"), str) or not config["initial_content"]:
            raise ConfigError("initial_content must be a non-empty string")
        values = config.get("correct_values")
        if not isinstance(values, list) or not values:
            raise ConfigError("correct_values must be a non-empty list")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("corrected_content"), str):
            raise ConfigError("answer must be {corrected_content: str}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        submitted = (answer or {}).get("corrected_content", "")
        case_sensitive = bool(config.get("case_sensitive", False))
        candidate = submitted.strip()
        targets = config.get("correct_values", [])
        if not case_sensitive:
            candidate = candidate.lower()
            targets = [str(t).strip().lower() for t in targets]
        else:
            targets = [str(t).strip() for t in targets]
        score = 1.0 if candidate in targets else 0.0
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={})
