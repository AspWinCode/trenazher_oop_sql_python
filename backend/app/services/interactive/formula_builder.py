from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class FormulaBuilderChecker:
    """config: {prompt?: str, slots: [{id}], blocks: [{id, text}],
    correct_sequences: [[block_id, ...], ...]  (one or more accepted
    sequences, each the same length as slots), allow_reuse?: bool}
    answer: {sequence: [block_id, ...]}
    Partial credit = best-matching accepted sequence's position-match-ratio.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        slots = config.get("slots")
        blocks = config.get("blocks")
        if not isinstance(slots, list) or not slots:
            raise ConfigError("slots must be a non-empty list")
        if not isinstance(blocks, list) or not blocks:
            raise ConfigError("blocks must be a non-empty list")
        block_ids = {b.get("id") for b in blocks if isinstance(b, dict)}
        if len(block_ids) != len(blocks):
            raise ConfigError("blocks need unique 'id' fields")
        sequences = config.get("correct_sequences")
        if not isinstance(sequences, list) or not sequences:
            raise ConfigError("correct_sequences must be a non-empty list of sequences")
        for seq in sequences:
            if not isinstance(seq, list) or len(seq) != len(slots) or any(b not in block_ids for b in seq):
                raise ConfigError("each correct_sequences entry must match slots length and reference existing block ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("sequence"), list):
            raise ConfigError("answer must be {sequence: [block_id, ...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        sequences = config.get("correct_sequences") or []
        submitted = (answer or {}).get("sequence") or []
        total = len(config.get("slots") or [])
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})

        best_matches = 0
        for seq in sequences:
            matches = sum(1 for i, block_id in enumerate(seq) if i < len(submitted) and submitted[i] == block_id)
            best_matches = max(best_matches, matches)

        score = best_matches / total
        status = "AC" if best_matches == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": best_matches, "total": total})
