"""strip_answer_fields: every mechanic's config must still render (structural
fields kept) while every answer-revealing field is gone. This guards the
GET /api/tasks/{id} non-admin path — a full-config wipe here breaks the
exercise for every real student (see app/api/tasks.py), while leaking an
answer key lets a student read the expected answer straight from devtools.
"""
from app.services.interactive.public_config import strip_answer_fields

CASES = [
    ("multiple_choice", {"mode": "single", "options": [{"id": "a", "text": "A"}], "correct_option_ids": ["a"]},
     {"options"}, {"correct_option_ids"}),
    ("matching", {"left": [{"id": "l1", "text": "L"}], "right": [{"id": "r1", "text": "R"}], "correct_pairs": [["l1", "r1"]]},
     {"left", "right"}, {"correct_pairs"}),
    ("ordering", {"items": [{"id": "i1", "text": "I"}], "correct_order": ["i1"]},
     {"items"}, {"correct_order"}),
    ("input_answer", {"answer_type": "text", "accepted_answers": ["x"], "case_sensitive": False},
     {"answer_type", "case_sensitive"}, {"accepted_answers"}),
    ("input_answer", {"answer_type": "number", "numeric_value": 42.0, "tolerance": 0.5},
     {"answer_type", "tolerance"}, {"numeric_value"}),
    ("categorization", {"categories": [{"id": "c1", "label": "C"}], "items": [{"id": "i1", "text": "I"}], "correct_assignments": {"i1": ["c1"]}},
     {"categories", "items"}, {"correct_assignments"}),
    ("odd_one_out", {"items": [{"id": "i1", "text": "I"}], "correct_odd_ids": ["i1"], "explanation": "because"},
     {"items"}, {"correct_odd_ids", "explanation"}),
    ("multi_select_elements", {"items": [{"id": "i1", "text": "I"}], "correct_ids": ["i1"]},
     {"items"}, {"correct_ids"}),
    ("pattern_completion", {"sequence_shown": ["1", "2"], "next_values": ["3"], "alternate_answers": [["three"]]},
     {"sequence_shown"}, {"next_values", "alternate_answers"}),
    ("table_fill", {"columns": [{"id": "c1", "label": "C"}], "rows": [{"id": "r1", "label": "R"}], "correct_cells": {"r1:c1": {}}},
     {"columns", "rows"}, {"correct_cells"}),
    ("solution_correction", {"prompt": "fix it", "initial_content": "wrong", "correct_values": ["right"]},
     {"prompt", "initial_content"}, {"correct_values"}),
    ("situation_analysis", {"description": "d", "question": "q", "mode": "choice", "options": [{"id": "a", "text": "A"}], "correct_option_ids": ["a"], "explanation": "e"},
     {"description", "question", "options"}, {"correct_option_ids", "explanation"}),
    ("find_error", {"items": [{"id": "i1", "text": "I"}], "correct_error_ids": ["i1"], "explanation": "e"},
     {"items"}, {"correct_error_ids", "explanation"}),
    ("grouping", {"items": [{"id": "i1", "text": "I"}], "correct_groups": [["i1"]]},
     {"items"}, {"correct_groups"}),
    ("restore_structure", {"slots": [{"id": "s1", "label": "S"}], "pool": [{"id": "p1", "text": "P"}], "correct_placements": {"s1": "p1"}},
     {"slots", "pool"}, {"correct_placements"}),
    ("formula_builder", {"slots": [{"id": "s1"}], "blocks": [{"id": "b1", "text": "B"}], "correct_sequences": [["b1"]]},
     {"slots", "blocks"}, {"correct_sequences"}),
    ("object_assembly", {"zones": [{"id": "z1", "label": "Z"}], "parts": [{"id": "p1", "text": "P"}], "correct_placements": {"z1": "p1"}},
     {"zones", "parts"}, {"correct_placements"}),
    ("parameter_adjustment", {"parameters": [{"id": "p1", "min": 0, "max": 10, "default": 5}], "formula": "p1", "target_min": 1, "target_max": 2},
     {"parameters", "formula"}, {"target_min", "target_max"}),
    ("hotspot", {"regions": [{"id": "r1", "x": 0.1, "y": 0.1, "width": 0.1, "height": 0.1}], "correct_region_ids": ["r1"]},
     {"regions"}, {"correct_region_ids"}),
    ("diagram_builder", {"nodes": [{"id": "n1", "label": "N"}], "correct_edges": [["n1", "n1"]]},
     {"nodes"}, {"correct_edges"}),
    ("hierarchy_builder", {"nodes": [{"id": "n1", "label": "N"}], "correct_parents": {"n1": None}},
     {"nodes"}, {"correct_parents"}),
    ("decision_path", {"start_step_id": "s1", "steps": [{"id": "s1", "prompt": "p", "options": [{"id": "o1", "text": "O", "next_step_id": None}]}], "correct_paths": [["o1"]]},
     {"start_step_id", "steps"}, {"correct_paths"}),
    ("simulation", {"parameters": [{"id": "p1", "min": 0, "max": 10, "default": 5}], "formula": "p1", "target_min": 1, "target_max": 2},
     {"parameters", "formula"}, {"target_min", "target_max"}),
    ("comparison", {"regions": [{"id": "r1", "side": "left", "x": 0.1, "y": 0.1, "width": 0.1, "height": 0.1}], "correct_region_ids": ["r1"]},
     {"regions"}, {"correct_region_ids"}),
]


def test_strip_answer_fields_keeps_renderable_hides_answer():
    for mechanic, config, keep_keys, drop_keys in CASES:
        public = strip_answer_fields(mechanic, config)
        for key in keep_keys:
            assert key in public, f"{mechanic}: expected renderable key '{key}' to survive stripping"
            assert public[key] == config[key], f"{mechanic}: '{key}' should be unchanged"
        for key in drop_keys:
            assert key not in public, f"{mechanic}: answer key '{key}' leaked to the student"
        # Original config (what grading reads from the DB) must stay untouched.
        for key in drop_keys:
            assert key in config, f"test bug: '{key}' missing from {mechanic} fixture"


def test_strip_answer_fields_fill_blanks_per_blank():
    config = {
        "template": "{{a}}",
        "blanks": [
            {"id": "a", "input_mode": "text", "correct_values": ["x"], "options": None},
            {"id": "b", "input_mode": "select", "correct_values": ["y"], "options": ["x", "y"]},
        ],
    }
    public = strip_answer_fields("fill_blanks", config)
    assert public["template"] == "{{a}}"
    for blank in public["blanks"]:
        assert "correct_values" not in blank
    assert public["blanks"][1]["options"] == ["x", "y"]
    # Original untouched (grading reads this one).
    assert config["blanks"][0]["correct_values"] == ["x"]


def test_strip_answer_fields_point_selection_keeps_count_hides_coordinates():
    config = {
        "target_points": [
            {"id": "t1", "x": 0.2, "y": 0.3, "radius": 0.05},
            {"id": "t2", "x": 0.7, "y": 0.8, "radius": 0.05},
        ]
    }
    public = strip_answer_fields("point_selection", config)
    assert len(public["target_points"]) == 2
    for p in public["target_points"]:
        assert "x" not in p and "y" not in p and "radius" not in p
    # Original untouched.
    assert config["target_points"][0]["x"] == 0.2


def test_strip_answer_fields_deep_copies_nested_structures():
    """Mutating the stripped copy must never affect the source config — that
    source is often the live SQLAlchemy-tracked dict from the Task row."""
    config = {"items": [{"id": "i1", "text": "I"}], "correct_ids": ["i1"]}
    public = strip_answer_fields("multi_select_elements", config)
    public["items"][0]["text"] = "mutated"
    assert config["items"][0]["text"] == "I"
