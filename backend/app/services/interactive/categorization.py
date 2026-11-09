from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class CategorizationChecker:
    """config: {categories: [{id, label}], items: [{id, text}],
    correct_assignments: {item_id: [category_id, ...]}}  (one or more valid
    categories per item)
    answer: {assignments: {item_id: category_id}}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        categories = config.get("categories")
        items = config.get("items")
        if not isinstance(categories, list) or len(categories) < 2:
            raise ConfigError("categories must be a list with at least 2 items")
        if not isinstance(items, list) or not items:
            raise ConfigError("items must be a non-empty list")
        cat_ids = {c.get("id") for c in categories if isinstance(c, dict)}
        item_ids = {i.get("id") for i in items if isinstance(i, dict)}
        if len(cat_ids) != len(categories) or len(item_ids) != len(items):
            raise ConfigError("categories/items need unique 'id' fields")
        assignments = config.get("correct_assignments")
        if not isinstance(assignments, dict) or not assignments:
            raise ConfigError("correct_assignments must be a non-empty object")
        for item_id, cats in assignments.items():
            if item_id not in item_ids:
                raise ConfigError(f"correct_assignments references unknown item '{item_id}'")
            if not isinstance(cats, list) or not cats or any(c not in cat_ids for c in cats):
                raise ConfigError(f"correct_assignments['{item_id}'] must be a non-empty list of valid category ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("assignments"), dict):
            raise ConfigError("answer must be {assignments: {item_id: category_id}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = config.get("correct_assignments") or {}
        submitted = (answer or {}).get("assignments") or {}
        total = len(correct)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})
        matched = sum(
            1 for item_id, valid_cats in correct.items() if submitted.get(item_id) in valid_cats
        )
        score = matched / total
        status = "AC" if matched == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": matched, "total": total})
