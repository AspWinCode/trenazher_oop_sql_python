from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class RestoreStructureChecker:
    """config: {slots: [{id, label}], pool: [{id, text}] (available parts,
    may include distractors not used by any slot), correct_placements:
    {slot_id: part_id}}
    answer: {placements: {slot_id: part_id}}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        slots = config.get("slots")
        pool = config.get("pool")
        if not isinstance(slots, list) or not slots:
            raise ConfigError("slots must be a non-empty list")
        if not isinstance(pool, list) or not pool:
            raise ConfigError("pool must be a non-empty list")
        slot_ids = {s.get("id") for s in slots if isinstance(s, dict)}
        part_ids = {p.get("id") for p in pool if isinstance(p, dict)}
        if len(slot_ids) != len(slots) or len(part_ids) != len(pool):
            raise ConfigError("slots/pool items need unique 'id' fields")
        placements = config.get("correct_placements")
        if not isinstance(placements, dict) or not placements:
            raise ConfigError("correct_placements must be a non-empty object")
        for slot_id, part_id in placements.items():
            if slot_id not in slot_ids or part_id not in part_ids:
                raise ConfigError("correct_placements must reference existing slot/pool ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("placements"), dict):
            raise ConfigError("answer must be {placements: {slot_id: part_id}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = config.get("correct_placements") or {}
        submitted = (answer or {}).get("placements") or {}
        total = len(correct)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})
        matched = sum(1 for slot_id, part_id in correct.items() if submitted.get(slot_id) == part_id)
        score = matched / total
        status = "AC" if matched == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": matched, "total": total})
