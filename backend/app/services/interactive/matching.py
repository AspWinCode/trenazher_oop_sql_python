from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class MatchingChecker:
    """1:1 pairs only (Phase 1 scope).

    config: {left: [{id, text}], right: [{id, text}], correct_pairs: [[left_id, right_id], ...]}
    answer: {pairs: [[left_id, right_id], ...]}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        left = config.get("left")
        right = config.get("right")
        if not isinstance(left, list) or not left or not isinstance(right, list) or not right:
            raise ConfigError("left and right must be non-empty lists")
        left_ids = {item.get("id") for item in left if isinstance(item, dict)}
        right_ids = {item.get("id") for item in right if isinstance(item, dict)}
        if len(left_ids) != len(left) or len(right_ids) != len(right):
            raise ConfigError("left/right items need unique 'id' fields")
        pairs = config.get("correct_pairs")
        if not isinstance(pairs, list) or not pairs:
            raise ConfigError("correct_pairs must be a non-empty list of [left_id, right_id] pairs")
        seen_left, seen_right = set(), set()
        for pair in pairs:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise ConfigError("each correct_pair must be a [left_id, right_id] pair")
            l, r = pair
            if l not in left_ids or r not in right_ids:
                raise ConfigError("correct_pairs must reference existing left/right ids")
            if l in seen_left or r in seen_right:
                raise ConfigError("correct_pairs must be 1:1 (no id reused) in Phase 1")
            seen_left.add(l)
            seen_right.add(r)

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("pairs"), list):
            raise ConfigError("answer must be {pairs: [[left_id, right_id], ...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct_pairs = {tuple(p) for p in (config.get("correct_pairs") or [])}
        submitted = (answer or {}).get("pairs") or []
        submitted_pairs = {tuple(p) for p in submitted if isinstance(p, (list, tuple)) and len(p) == 2}
        max_score = float(len(correct_pairs)) if correct_pairs else 1.0
        matched = len(correct_pairs & submitted_pairs)
        score = matched / max_score if max_score else 0.0
        status = "AC" if matched == len(correct_pairs) and submitted_pairs == correct_pairs else "WA"
        return CheckResult(
            status=status,
            score=score,
            max_score=1.0,
            details={"matched_pairs": matched, "total_pairs": len(correct_pairs)},
        )
