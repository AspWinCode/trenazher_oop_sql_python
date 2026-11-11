from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


def _normalize_edge(edge: list, directed: bool) -> tuple:
    a, b = edge[0], edge[1]
    return (a, b) if directed else tuple(sorted((a, b)))


class DiagramBuilderChecker:
    """config: {directed?: bool, nodes: [{id, label}],
    correct_edges: [[from_id, to_id], ...]}
    answer: {edges: [[from_id, to_id], ...]}
    Proportional credit, penalizing extra/wrong edges (same tp-fp formula as
    multi_select_elements, applied to the edge set instead of an item set).
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
        edges = config.get("correct_edges")
        if not isinstance(edges, list) or not edges:
            raise ConfigError("correct_edges must be a non-empty list of [from_id, to_id] pairs")
        for e in edges:
            if not isinstance(e, (list, tuple)) or len(e) != 2 or e[0] not in ids or e[1] not in ids:
                raise ConfigError("each correct_edges entry must be a [from_id, to_id] pair of existing node ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("edges"), list):
            raise ConfigError("answer must be {edges: [[from_id, to_id], ...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        directed = bool(config.get("directed", True))
        correct = {_normalize_edge(e, directed) for e in (config.get("correct_edges") or [])}
        submitted_raw = (answer or {}).get("edges") or []
        submitted = {
            _normalize_edge(e, directed) for e in submitted_raw if isinstance(e, (list, tuple)) and len(e) == 2
        }

        true_positive = len(correct & submitted)
        false_positive = len(submitted - correct)
        raw = (true_positive - false_positive) / len(correct) if correct else 0.0
        score = max(0.0, min(1.0, raw))
        status = "AC" if submitted == correct else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": true_positive, "total": len(correct)})
