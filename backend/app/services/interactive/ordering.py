from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class OrderingChecker:
    """config: {items: [{id, text}], correct_order: [id...]}
    answer: {order: [id...]}
    Partial credit = position-match-ratio against correct_order.
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
        order = config.get("correct_order")
        if not isinstance(order, list) or sorted(order) != sorted(ids):
            raise ConfigError("correct_order must be a permutation of item ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("order"), list):
            raise ConfigError("answer must be {order: [...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct_order = config.get("correct_order") or []
        submitted = (answer or {}).get("order") or []
        total = len(correct_order)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})
        matches = sum(
            1 for i, correct_id in enumerate(correct_order) if i < len(submitted) and submitted[i] == correct_id
        )
        score = matches / total
        status = "AC" if list(submitted) == list(correct_order) else "WA"
        return CheckResult(
            status=status,
            score=score,
            max_score=1.0,
            details={"matched_positions": matches, "total_positions": total},
        )
