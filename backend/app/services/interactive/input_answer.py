from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class InputAnswerChecker:
    """config (text): {answer_type: "text", accepted_answers: [str...], case_sensitive?: bool}
    config (number): {answer_type: "number", numeric_value: float, tolerance?: float,
                       tolerance_mode?: "absolute"|"relative"}
    answer: {answer: str | number}
    All-or-nothing (no partial credit for a single free-form value).
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        answer_type = config.get("answer_type")
        if answer_type not in ("text", "number"):
            raise ConfigError("answer_type must be 'text' or 'number'")
        if answer_type == "text":
            accepted = config.get("accepted_answers")
            if not isinstance(accepted, list) or not accepted:
                raise ConfigError("text mode needs a non-empty 'accepted_answers' list")
        else:
            if not isinstance(config.get("numeric_value"), (int, float)):
                raise ConfigError("number mode needs a numeric 'numeric_value'")
            if config.get("tolerance_mode", "absolute") not in ("absolute", "relative"):
                raise ConfigError("tolerance_mode must be 'absolute' or 'relative'")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or "answer" not in answer:
            raise ConfigError("answer must be {answer: ...}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        value = (answer or {}).get("answer")
        max_score = 1.0
        if config.get("answer_type") == "number":
            score = 1.0 if self._number_matches(config, value) else 0.0
        else:
            score = 1.0 if self._text_matches(config, value) else 0.0
        status = "AC" if score >= max_score else "WA"
        return CheckResult(status=status, score=score, max_score=max_score, details={})

    @staticmethod
    def _number_matches(config: dict, value: Any) -> bool:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return False
        target = float(config["numeric_value"])
        tolerance = float(config.get("tolerance") or 0)
        if config.get("tolerance_mode", "absolute") == "relative":
            tolerance = tolerance * abs(target)
        return abs(parsed - target) <= tolerance

    @staticmethod
    def _text_matches(config: dict, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        case_sensitive = bool(config.get("case_sensitive", False))
        candidate = value.strip()
        accepted = config.get("accepted_answers", [])
        if not case_sensitive:
            candidate = candidate.lower()
            accepted = [str(a).strip().lower() for a in accepted]
        else:
            accepted = [str(a).strip() for a in accepted]
        return candidate in accepted
