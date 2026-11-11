from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class ObjectAssemblyChecker:
    """config: {zones: [{id, label}], parts: [{id, text}] (pool, may include
    distractor parts unused by any zone), correct_placements: {zone_id: part_id}}
    answer: {placements: {zone_id: part_id}}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        zones = config.get("zones")
        parts = config.get("parts")
        if not isinstance(zones, list) or not zones:
            raise ConfigError("zones must be a non-empty list")
        if not isinstance(parts, list) or not parts:
            raise ConfigError("parts must be a non-empty list")
        zone_ids = {z.get("id") for z in zones if isinstance(z, dict)}
        part_ids = {p.get("id") for p in parts if isinstance(p, dict)}
        if len(zone_ids) != len(zones) or len(part_ids) != len(parts):
            raise ConfigError("zones/parts need unique 'id' fields")
        placements = config.get("correct_placements")
        if not isinstance(placements, dict) or not placements:
            raise ConfigError("correct_placements must be a non-empty object")
        for zone_id, part_id in placements.items():
            if zone_id not in zone_ids or part_id not in part_ids:
                raise ConfigError("correct_placements must reference existing zone/part ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("placements"), dict):
            raise ConfigError("answer must be {placements: {zone_id: part_id}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = config.get("correct_placements") or {}
        submitted = (answer or {}).get("placements") or {}
        total = len(correct)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})
        matched = sum(1 for zone_id, part_id in correct.items() if submitted.get(zone_id) == part_id)
        score = matched / total
        status = "AC" if matched == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": matched, "total": total})
