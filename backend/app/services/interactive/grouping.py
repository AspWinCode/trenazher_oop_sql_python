from __future__ import annotations

from itertools import combinations
from typing import Any, Dict, List

from app.services.interactive.base import CheckResult, ConfigError


def _partition_map(groups: List[List[str]]) -> Dict[str, int]:
    mapping: Dict[str, int] = {}
    for idx, group in enumerate(groups):
        for item_id in group:
            mapping[item_id] = idx
    return mapping


class GroupingChecker:
    """config: {items: [{id, text}], correct_groups: [[id, ...], [id, ...], ...]}
    answer: {groups: [[id, ...], ...]}  (student's own partition — arbitrary
    number of groups, group order/labels don't matter)

    Graded by pairwise co-occurrence agreement (same idea as the Rand index):
    for every pair of items, check whether "same group" agrees between the
    submitted and correct partition. AC only when the partitions match exactly
    (up to group order/naming).
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
        groups = config.get("correct_groups")
        if not isinstance(groups, list) or len(groups) < 2:
            raise ConfigError("correct_groups must be a list with at least 2 groups")
        seen = set()
        for g in groups:
            if not isinstance(g, list) or not g:
                raise ConfigError("each group must be a non-empty list of item ids")
            for item_id in g:
                if item_id not in ids or item_id in seen:
                    raise ConfigError("correct_groups must partition all item ids exactly once")
                seen.add(item_id)
        if seen != set(ids):
            raise ConfigError("correct_groups must cover every item exactly once")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("groups"), list):
            raise ConfigError("answer must be {groups: [[id, ...], ...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        items = config.get("items") or []
        all_ids = [i["id"] for i in items]
        correct_map = _partition_map(config.get("correct_groups") or [])
        submitted_map = _partition_map((answer or {}).get("groups") or [])

        pairs = list(combinations(all_ids, 2))
        if not pairs:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})

        agree = 0
        for a, b in pairs:
            correct_same = correct_map.get(a) == correct_map.get(b)
            submitted_same = submitted_map.get(a) is not None and submitted_map.get(a) == submitted_map.get(b)
            if correct_same == submitted_same:
                agree += 1

        score = agree / len(pairs)
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"agreeing_pairs": agree, "total_pairs": len(pairs)})
