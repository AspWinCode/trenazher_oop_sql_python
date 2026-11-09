from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class MultiSelectElementsChecker:
    """config: {prompt?: str, items: [{id, text}], correct_ids: [id, ...]}
    answer: {selected_ids: [id, ...]}
    Proportional credit, penalizing false positives.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        items = config.get("items")
        if not isinstance(items, list) or len(items) < 2:
            raise ConfigError("items must be a list with at least 2 items")
        ids = [i.get("id") for i in items if isinstance(i, dict)]
        if len(ids) != len(items) or len(set(ids)) != len(ids):
            raise ConfigError("every item needs a unique 'id'")
        correct = config.get("correct_ids")
        if not isinstance(correct, list) or not correct or any(c not in ids for c in correct):
            raise ConfigError("correct_ids must be a non-empty list of existing item ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("selected_ids"), list):
            raise ConfigError("answer must be {selected_ids: [...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = set(config.get("correct_ids") or [])
        selected = set((answer or {}).get("selected_ids") or [])
        true_positive = len(correct & selected)
        false_positive = len(selected - correct)
        raw = (true_positive - false_positive) / len(correct) if correct else 0.0
        score = max(0.0, min(1.0, raw))
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(
            status=status, score=score, max_score=1.0,
            details={"correct_ids": sorted(correct), "selected_ids": sorted(selected)},
        )
