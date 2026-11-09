from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError

_VALID_MODES = {"text", "number", "select", "drag"}


class FillBlanksChecker:
    """config: {template: str, blanks: [{id, input_mode, options?, correct_values?,
    tolerance?, case_sensitive?}]}
    answer: {blanks: {blank_id: value}}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict) or not isinstance(config.get("template"), str):
            raise ConfigError("config must be an object with a 'template' string")
        blanks = config.get("blanks")
        if not isinstance(blanks, list) or not blanks:
            raise ConfigError("blanks must be a non-empty list")
        ids = set()
        for b in blanks:
            if not isinstance(b, dict) or not b.get("id"):
                raise ConfigError("every blank needs an 'id'")
            if b["id"] in ids:
                raise ConfigError("blank ids must be unique")
            ids.add(b["id"])
            mode = b.get("input_mode")
            if mode not in _VALID_MODES:
                raise ConfigError(f"blank '{b['id']}': input_mode must be one of {sorted(_VALID_MODES)}")
            if mode == "number":
                if not isinstance(b.get("correct_values"), list) or not b["correct_values"]:
                    raise ConfigError(f"blank '{b['id']}': number mode needs 'correct_values' with a numeric value")
            else:
                if not isinstance(b.get("correct_values"), list) or not b["correct_values"]:
                    raise ConfigError(f"blank '{b['id']}': 'correct_values' must be a non-empty list")
                if mode in ("select", "drag") and not isinstance(b.get("options"), list):
                    raise ConfigError(f"blank '{b['id']}': {mode} mode needs an 'options' list")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("blanks"), dict):
            raise ConfigError("answer must be {blanks: {blank_id: value}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        blanks = config.get("blanks") or []
        submitted = (answer or {}).get("blanks") or {}
        total = len(blanks)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})

        correct_count = 0
        per_blank = {}
        for b in blanks:
            bid = b["id"]
            value = submitted.get(bid)
            ok = self._blank_correct(b, value)
            per_blank[bid] = ok
            if ok:
                correct_count += 1

        score = correct_count / total
        status = "AC" if correct_count == total else "WA"
        return CheckResult(
            status=status,
            score=score,
            max_score=1.0,
            details={"per_blank": per_blank, "correct_count": correct_count, "total": total},
        )

    @staticmethod
    def _blank_correct(blank: dict, value: Any) -> bool:
        mode = blank.get("input_mode")
        if value is None:
            return False
        if mode == "number":
            try:
                parsed = float(value)
            except (TypeError, ValueError):
                return False
            tolerance = float(blank.get("tolerance") or 0)
            targets = [float(v) for v in blank.get("correct_values", [])]
            return any(abs(parsed - t) <= tolerance for t in targets)

        # text / select / drag: string comparison
        if not isinstance(value, str):
            return False
        case_sensitive = bool(blank.get("case_sensitive", False))
        candidate = value.strip()
        targets = blank.get("correct_values", [])
        if not case_sensitive:
            candidate = candidate.lower()
            targets = [str(t).strip().lower() for t in targets]
        else:
            targets = [str(t).strip() for t in targets]
        return candidate in targets
