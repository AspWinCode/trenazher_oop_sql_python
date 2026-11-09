from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


def _cell_key(row_id: str, col_id: str) -> str:
    return f"{row_id}:{col_id}"


class TableFillChecker:
    """config: {columns: [{id, label}], rows: [{id, label}],
    locked_cells?: {"row_id:col_id": value},
    correct_cells: {"row_id:col_id": {type: "text"|"number", values: [str...],
                                        tolerance?: number, case_sensitive?: bool}}}
    answer: {cells: {"row_id:col_id": value}}  (only editable cells)
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        columns = config.get("columns")
        rows = config.get("rows")
        if not isinstance(columns, list) or not columns:
            raise ConfigError("columns must be a non-empty list")
        if not isinstance(rows, list) or not rows:
            raise ConfigError("rows must be a non-empty list")
        col_ids = {c.get("id") for c in columns if isinstance(c, dict)}
        row_ids = {r.get("id") for r in rows if isinstance(r, dict)}
        correct_cells = config.get("correct_cells")
        if not isinstance(correct_cells, dict) or not correct_cells:
            raise ConfigError("correct_cells must be a non-empty object")
        for key, spec in correct_cells.items():
            if ":" not in key:
                raise ConfigError(f"correct_cells key '{key}' must be 'row_id:col_id'")
            row_id, col_id = key.split(":", 1)
            if row_id not in row_ids or col_id not in col_ids:
                raise ConfigError(f"correct_cells key '{key}' references unknown row/column")
            if not isinstance(spec, dict) or spec.get("type") not in ("text", "number"):
                raise ConfigError(f"correct_cells['{key}'] needs type 'text' or 'number'")
            if not isinstance(spec.get("values"), list) or not spec["values"]:
                raise ConfigError(f"correct_cells['{key}'] needs a non-empty 'values' list")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("cells"), dict):
            raise ConfigError("answer must be {cells: {'row_id:col_id': value}}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        correct_cells = config.get("correct_cells") or {}
        submitted = (answer or {}).get("cells") or {}
        total = len(correct_cells)
        if total == 0:
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})

        matched = 0
        per_cell = {}
        for key, spec in correct_cells.items():
            value = submitted.get(key)
            ok = self._cell_correct(spec, value)
            per_cell[key] = ok
            if ok:
                matched += 1

        score = matched / total
        status = "AC" if matched == total else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={"per_cell": per_cell})

    @staticmethod
    def _cell_correct(spec: dict, value: Any) -> bool:
        if value is None:
            return False
        if spec["type"] == "number":
            try:
                parsed = float(value)
            except (TypeError, ValueError):
                return False
            tolerance = float(spec.get("tolerance") or 0)
            return any(abs(parsed - float(v)) <= tolerance for v in spec["values"])
        if not isinstance(value, str):
            return False
        case_sensitive = bool(spec.get("case_sensitive", False))
        candidate = value.strip()
        targets = spec["values"]
        if not case_sensitive:
            candidate = candidate.lower()
            targets = [str(t).strip().lower() for t in targets]
        else:
            targets = [str(t).strip() for t in targets]
        return candidate in targets
