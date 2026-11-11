from __future__ import annotations

import math
from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class PointSelectionChecker:
    """config: {image_url?: str, target_points: [{id, x, y, radius}]}
    (normalized 0..1 coordinates and radius, resolution-independent)
    answer: {points: [{x, y}, ...]}
    Greedy matching: each submitted point can satisfy at most one target
    (closest first), within that target's radius. Partial credit =
    matched_targets / total_targets.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        points = config.get("target_points")
        if not isinstance(points, list) or not points:
            raise ConfigError("target_points must be a non-empty list")
        ids = set()
        for p in points:
            if not isinstance(p, dict) or not p.get("id"):
                raise ConfigError("every target point needs an 'id'")
            for key in ("x", "y", "radius"):
                if not isinstance(p.get(key), (int, float)) or p[key] < 0:
                    raise ConfigError(f"target point '{p['id']}': '{key}' must be a non-negative number")
            if p["id"] in ids:
                raise ConfigError("target point ids must be unique")
            ids.add(p["id"])

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("points"), list):
            raise ConfigError("answer must be {points: [{x, y}, ...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        targets = config.get("target_points") or []
        submitted = (answer or {}).get("points") or []
        total = len(targets)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})

        remaining = list(submitted)
        matched = 0
        for target in targets:
            best_idx = None
            best_dist = None
            for i, pt in enumerate(remaining):
                if not isinstance(pt, dict) or "x" not in pt or "y" not in pt:
                    continue
                try:
                    dist = math.hypot(float(pt["x"]) - target["x"], float(pt["y"]) - target["y"])
                except (TypeError, ValueError):
                    continue
                if dist <= target["radius"] and (best_dist is None or dist < best_dist):
                    best_dist = dist
                    best_idx = i
            if best_idx is not None:
                matched += 1
                remaining.pop(best_idx)

        score = matched / total
        status = "AC" if matched == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": matched, "total": total})
