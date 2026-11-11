from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class DecisionPathChecker:
    """config: {steps: [{id, prompt, options: [{id, text, next_step_id}]}],
    start_step_id: str, correct_paths: [[option_id, ...], ...]}
    (one or more acceptable full option-id sequences from start to end)
    answer: {path: [option_id, ...]}
    AC iff the submitted path exactly matches one of correct_paths; otherwise
    partial credit = best per-position match ratio against the closest
    accepted path (same idea as pattern_completion/formula_builder).
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        steps = config.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ConfigError("steps must be a non-empty list")
        step_ids = set()
        option_ids = set()
        for s in steps:
            if not isinstance(s, dict) or not s.get("id") or not s.get("prompt"):
                raise ConfigError("every step needs 'id' and 'prompt'")
            options = s.get("options")
            if not isinstance(options, list) or not options:
                raise ConfigError(f"step '{s['id']}' needs a non-empty 'options' list")
            step_ids.add(s["id"])
            for o in options:
                if not isinstance(o, dict) or not o.get("id") or not o.get("text"):
                    raise ConfigError(f"step '{s['id']}': every option needs 'id' and 'text'")
                if o["id"] in option_ids:
                    raise ConfigError("option ids must be unique across the whole exercise")
                option_ids.add(o["id"])
        if config.get("start_step_id") not in step_ids:
            raise ConfigError("start_step_id must reference an existing step")
        paths = config.get("correct_paths")
        if not isinstance(paths, list) or not paths:
            raise ConfigError("correct_paths must be a non-empty list of option-id sequences")
        for p in paths:
            if not isinstance(p, list) or not p or any(o not in option_ids for o in p):
                raise ConfigError("each correct_paths entry must be a non-empty list of existing option ids")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict) or not isinstance(answer.get("path"), list):
            raise ConfigError("answer must be {path: [option_id, ...]}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        paths = config.get("correct_paths") or []
        submitted = (answer or {}).get("path") or []

        if any(list(submitted) == list(p) for p in paths):
            return CheckResult(status="AC", score=1.0, max_score=1.0, details={})

        best_score = 0.0
        for p in paths:
            matches = sum(1 for i, opt in enumerate(p) if i < len(submitted) and submitted[i] == opt)
            best_score = max(best_score, matches / len(p))

        return CheckResult(status="WA", score=best_score, max_score=1.0, details={})
