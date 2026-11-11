from __future__ import annotations

from typing import Any, Optional

from app.services.interactive.base import CheckResult, ConfigError


class HierarchyBuilderChecker:
    """config: {nodes: [{id, label}], correct_parents: {node_id: parent_id | null}}
    (a node whose correct parent is null/absent is a root)
    answer: {parents: {node_id: parent_id | null}}
    Partial credit = share of nodes whose submitted parent matches the
    correct one.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        nodes = config.get("nodes")
        if not isinstance(nodes, list) or len(nodes) < 2:
            raise ConfigError("nodes must be a list with at least 2 items")
        ids = {n.get("id") for n in nodes if isinstance(n, dict)}
        if len(ids) != len(nodes):
            raise ConfigError("nodes need unique 'id' fields")
        parents = config.get("correct_parents")
        if not isinstance(parents, dict) or not parents:
            raise ConfigError("correct_parents must be a non-empty object")
        for node_id, parent_id in parents.items():
            if node_id not in ids:
                raise ConfigError(f"correct_parents references unknown node '{node_id}'")
            if parent_id is not None and parent_id not in ids:
                raise ConfigError(f"correct_parents['{node_id}'] references unknown parent '{parent_id}'")
            if parent_id == node_id:
                raise ConfigError(f"node '{node_id}' cannot be its own parent")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("parents"), dict):
            raise ConfigError("answer must be {parents: {node_id: parent_id | null}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct = config.get("correct_parents") or {}
        submitted = (answer or {}).get("parents") or {}
        total = len(correct)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})
        matched = sum(1 for node_id, parent_id in correct.items() if submitted.get(node_id, "__missing__") == parent_id)
        score = matched / total
        status = "AC" if matched == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": matched, "total": total})
