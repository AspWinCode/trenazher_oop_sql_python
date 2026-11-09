from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class OddOneOutChecker:
    """config: {items: [{id, text}], correct_odd_ids: [id, ...], explanation?: str}
    answer: {selected_ids: [id, ...]}
    Proportional credit, penalizing false positives (same formula as
    multiple_choice multi-select).
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        items = config.get("items")
        if not isinstance(items, list) or len(items) < 3:
            raise ConfigError("items must be a list with at least 3 items")
        ids = [i.get("id") for i in items if isinstance(i, dict)]
        if len(ids) != len(items) or len(set(ids)) != len(ids):
            raise ConfigError("every item needs a unique 'id'")
        odd = config.get("correct_odd_ids")
        if not isinstance(odd, list) or not odd or any(o not in ids for o in odd):
            raise ConfigError("correct_odd_ids must be a non-empty list of existing item ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("selected_ids"), list):
            raise ConfigError("answer must be {selected_ids: [...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = set(config.get("correct_odd_ids") or [])
        selected = set((answer or {}).get("selected_ids") or [])
        true_positive = len(correct & selected)
        false_positive = len(selected - correct)
        raw = (true_positive - false_positive) / len(correct) if correct else 0.0
        score = max(0.0, min(1.0, raw))
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(
            status=status, score=score, max_score=1.0,
            details={"correct_odd_ids": sorted(correct), "selected_ids": sorted(selected)},
        )
