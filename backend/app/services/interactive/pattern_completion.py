from __future__ import annotations

from typing import Any, List

from app.services.interactive.base import CheckResult, ConfigError


class PatternCompletionChecker:
    """config: {sequence_shown: [str, ...], next_values: [str, ...],
    input_mode: "text"|"number", tolerance?: number,
    alternate_answers?: [[str, ...], ...]}
    answer: {values: [str, ...]}  (same length as next_values)
    Checked against next_values and every alternate_answers sequence; best
    (highest-scoring) match wins. Partial credit = position-match-ratio.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        if not isinstance(config.get("sequence_shown"), list) or not config["sequence_shown"]:
            raise ConfigError("sequence_shown must be a non-empty list")
        next_values = config.get("next_values")
        if not isinstance(next_values, list) or not next_values:
            raise ConfigError("next_values must be a non-empty list")
        if config.get("input_mode", "text") not in ("text", "number"):
            raise ConfigError("input_mode must be 'text' or 'number'")
        alternates = config.get("alternate_answers", [])
        if not isinstance(alternates, list):
            raise ConfigError("alternate_answers must be a list of sequences")
        for alt in alternates:
            if not isinstance(alt, list) or len(alt) != len(next_values):
                raise ConfigError("each alternate_answers sequence must match next_values length")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("values"), list):
            raise ConfigError("answer must be {values: [...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        next_values: List[Any] = config.get("next_values") or []
        candidates = [next_values, *(config.get("alternate_answers") or [])]
        submitted = (answer or {}).get("values") or []
        total = len(next_values)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})

        is_number = config.get("input_mode", "text") == "number"
        tolerance = float(config.get("tolerance") or 0)

        best_matches = 0
        for candidate in candidates:
            matches = 0
            for i, target in enumerate(candidate):
                if i >= len(submitted):
                    continue
                if self._values_match(submitted[i], target, is_number, tolerance):
                    matches += 1
            best_matches = max(best_matches, matches)

        score = best_matches / total
        status = "AC" if best_matches == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"matched": best_matches, "total": total})

    @staticmethod
    def _values_match(submitted: Any, target: Any, is_number: bool, tolerance: float) -> bool:
        if is_number:
            try:
                return abs(float(submitted) - float(target)) <= tolerance
            except (TypeError, ValueError):
                return False
        return str(submitted).strip().lower() == str(target).strip().lower()
