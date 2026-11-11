from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError
from app.services.interactive.safe_eval import UnsafeExpressionError, safe_eval


class SimulationChecker:
    """config: {prompt?: str, parameters: [{id, label, min, max, step, default}],
    formula: "<safe arithmetic expression over parameter ids>",
    target_min: number, target_max: number}
    answer: {values: {param_id: number}}

    Same grading rule as parameter_adjustment (all-or-nothing: AC iff the
    formula evaluated at the submitted values lands in [target_min,
    target_max]) — the distinction from parameter_adjustment is purely in the
    student-facing UX (a "Запустить"/"Сбросить" simulation flow vs. live
    slider feedback), per the ТЗ's separate mechanic codes for the two.
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        params = config.get("parameters")
        if not isinstance(params, list) or not params:
            raise ConfigError("parameters must be a non-empty list")
        ids = set()
        for p in params:
            if not isinstance(p, dict) or not p.get("id"):
                raise ConfigError("every parameter needs an 'id'")
            for key in ("min", "max", "default"):
                if not isinstance(p.get(key), (int, float)):
                    raise ConfigError(f"parameter '{p['id']}' needs numeric '{key}'")
            ids.add(p["id"])
        if not isinstance(config.get("formula"), str) or not config["formula"]:
            raise ConfigError("formula must be a non-empty string")
        if not isinstance(config.get("target_min"), (int, float)) or not isinstance(config.get("target_max"), (int, float)):
            raise ConfigError("target_min/target_max must be numeric")
        try:
            safe_eval(config["formula"], {pid: 0.0 for pid in ids})
        except UnsafeExpressionError as exc:
            raise ConfigError(f"invalid formula: {exc}")
        except ZeroDivisionError:
            pass

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("values"), dict):
            raise ConfigError("answer must be {values: {param_id: number}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        params = config.get("parameters") or []
        submitted = (answer or {}).get("values") or {}
        values = {}
        for p in params:
            raw = submitted.get(p["id"], p["default"])
            try:
                values[p["id"]] = float(raw)
            except (TypeError, ValueError):
                values[p["id"]] = float(p["default"])

        try:
            result = safe_eval(config["formula"], values)
        except (UnsafeExpressionError, ZeroDivisionError):
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={"error": "formula_evaluation_failed"})

        in_range = config["target_min"] <= result <= config["target_max"]
        score = 1.0 if in_range else 0.0
        status = "AC" if in_range else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"result": result})
