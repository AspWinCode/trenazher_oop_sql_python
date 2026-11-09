from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class MultipleChoiceChecker:
    """config: {mode: "single"|"multi", options: [{id, text}], correct_option_ids: [id...], shuffle?: bool}
    answer: {selected_option_ids: [id...]}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        mode = config.get("mode")
        if mode not in ("single", "multi"):
            raise ConfigError("mode must be 'single' or 'multi'")
        options = config.get("options")
        if not isinstance(options, list) or len(options) < 2:
            raise ConfigError("options must be a list with at least 2 items")
        ids = [o.get("id") for o in options if isinstance(o, dict)]
        if len(ids) != len(options) or any(i is None for i in ids) or len(set(ids)) != len(ids):
            raise ConfigError("every option needs a unique 'id'")
        correct = config.get("correct_option_ids")
        if not isinstance(correct, list) or not correct:
            raise ConfigError("correct_option_ids must be a non-empty list")
        if any(c not in ids for c in correct):
            raise ConfigError("correct_option_ids must reference existing option ids")
        if mode == "single" and len(correct) != 1:
            raise ConfigError("mode 'single' requires exactly one correct_option_id")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("selected_option_ids"), list):
            raise ConfigError("answer must be {selected_option_ids: [...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = set(config.get("correct_option_ids") or [])
        selected = set((answer or {}).get("selected_option_ids") or [])
        max_score = 1.0
        if config.get("mode") == "single":
            score = 1.0 if selected == correct else 0.0
        else:
            true_positive = len(correct & selected)
            false_positive = len(selected - correct)
            raw = (true_positive - false_positive) / len(correct) if correct else 0.0
            score = max(0.0, min(1.0, raw))
        status = "AC" if score >= max_score else "WA"
        return CheckResult(
            status=status,
            score=score,
            max_score=max_score,
            details={"correct_option_ids": sorted(correct), "selected_option_ids": sorted(selected)},
        )
