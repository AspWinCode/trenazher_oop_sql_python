from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class HotspotChecker:
    """config: {image_url?: str, regions: [{id, x, y, width, height}]
    (rectangles in normalized 0..1 coordinates, resolution-independent),
    correct_region_ids: [id, ...]}
    answer: {selected_region_ids: [id, ...]}
    Proportional credit, penalizing false positives.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        regions = config.get("regions")
        if not isinstance(regions, list) or len(regions) < 2:
            raise ConfigError("regions must be a list with at least 2 items")
        ids = []
        for r in regions:
            if not isinstance(r, dict) or not r.get("id"):
                raise ConfigError("every region needs an 'id'")
            for key in ("x", "y", "width", "height"):
                if not isinstance(r.get(key), (int, float)) or not (0 <= r[key] <= 1):
                    raise ConfigError(f"region '{r['id']}': '{key}' must be a number in [0, 1]")
            ids.append(r["id"])
        if len(set(ids)) != len(ids):
            raise ConfigError("region ids must be unique")
        correct = config.get("correct_region_ids")
        if not isinstance(correct, list) or not correct or any(c not in ids for c in correct):
            raise ConfigError("correct_region_ids must be a non-empty list of existing region ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("selected_region_ids"), list):
            raise ConfigError("answer must be {selected_region_ids: [...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = set(config.get("correct_region_ids") or [])
        selected = set((answer or {}).get("selected_region_ids") or [])
        true_positive = len(correct & selected)
        false_positive = len(selected - correct)
        raw = (true_positive - false_positive) / len(correct) if correct else 0.0
        score = max(0.0, min(1.0, raw))
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={})
