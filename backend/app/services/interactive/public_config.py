from __future__ import annotations

import copy
from typing import Any

# Per-mechanic list of top-level config keys that reveal the answer and must
# never reach a non-admin's browser. Grading always reads the untouched
# config straight from the DB (see grading_service.py), so stripping here only
# affects what the student-facing renderer receives — never correctness.
_TOP_LEVEL_ANSWER_KEYS: dict[str, list[str]] = {
    "multiple_choice": ["correct_option_ids"],
    "matching": ["correct_pairs"],
    "ordering": ["correct_order"],
    "input_answer": ["accepted_answers", "numeric_value"],
    "categorization": ["correct_assignments"],
    "odd_one_out": ["correct_odd_ids", "explanation"],
    "multi_select_elements": ["correct_ids"],
    "pattern_completion": ["next_values", "alternate_answers"],
    "table_fill": ["correct_cells"],
    "solution_correction": ["correct_values"],
    "situation_analysis": ["correct_option_ids", "accepted_answers", "explanation"],
    "find_error": ["correct_error_ids", "explanation"],
    "grouping": ["correct_groups"],
    "restore_structure": ["correct_placements"],
    "formula_builder": ["correct_sequences"],
    "object_assembly": ["correct_placements"],
    "parameter_adjustment": ["target_min", "target_max"],
    "hotspot": ["correct_region_ids"],
    "diagram_builder": ["correct_edges"],
    "hierarchy_builder": ["correct_parents"],
    "decision_path": ["correct_paths"],
    "simulation": ["target_min", "target_max"],
    "comparison": ["correct_region_ids"],
    # fill_blanks, point_selection: handled below (nested / shape-preserving strip).
}


def strip_answer_fields(mechanic: str | None, config: Any) -> Any:
    """Return a copy of `config` safe to send to a non-admin: structurally
    identical (so the renderer still works), but with every answer-revealing
    field removed. Falls back to returning the config unchanged for an
    unknown mechanic — validate_config already runs before this is ever
    reached in practice, and `check()`/`validate_answer()` only ever see the
    original, unstripped config fetched fresh from the DB."""
    if not isinstance(config, dict):
        return config
    public = copy.deepcopy(config)

    if mechanic == "fill_blanks":
        for blank in public.get("blanks") or []:
            if isinstance(blank, dict):
                blank.pop("correct_values", None)
        return public

    if mechanic == "point_selection":
        # The renderer only needs the *count* of target points (to cap how
        # many clicks it accepts) — their real x/y/radius is the answer.
        public["target_points"] = [
            {"id": p.get("id")} if isinstance(p, dict) else p for p in public.get("target_points") or []
        ]
        return public

    for key in _TOP_LEVEL_ANSWER_KEYS.get(mechanic, []):
        public.pop(key, None)
    return public
