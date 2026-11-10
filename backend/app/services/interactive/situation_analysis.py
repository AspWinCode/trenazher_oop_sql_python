from __future__ import annotations

from typing import Any

from app.services.interactive.base import CheckResult, ConfigError


class SituationAnalysisChecker:
    """config (choice mode): {description: str, question: str, mode: "choice",
    options: [{id, text}], correct_option_ids: [id, ...], explanation?: str}
    config (text mode): {description: str, question: str, mode: "text",
    accepted_answers: [str, ...], case_sensitive?: bool, explanation?: str}
    answer (choice): {selected_option_ids: [id, ...]}
    answer (text): {answer: str}
    """

    def validate_config(self, config: Any) -> None:
        if not isinstance(config, dict):
            raise ConfigError("config must be an object")
        if not isinstance(config.get("description"), str) or not config["description"]:
            raise ConfigError("description must be a non-empty string")
        if not isinstance(config.get("question"), str) or not config["question"]:
            raise ConfigError("question must be a non-empty string")
        mode = config.get("mode")
        if mode not in ("choice", "text"):
            raise ConfigError("mode must be 'choice' or 'text'")
        if mode == "choice":
            options = config.get("options")
            if not isinstance(options, list) or len(options) < 2:
                raise ConfigError("choice mode needs an 'options' list with at least 2 items")
            ids = [o.get("id") for o in options if isinstance(o, dict)]
            if len(ids) != len(options) or len(set(ids)) != len(ids):
                raise ConfigError("every option needs a unique 'id'")
            correct = config.get("correct_option_ids")
            if not isinstance(correct, list) or not correct or any(c not in ids for c in correct):
                raise ConfigError("correct_option_ids must be a non-empty list of existing option ids")
        else:
            accepted = config.get("accepted_answers")
            if not isinstance(accepted, list) or not accepted:
                raise ConfigError("text mode needs a non-empty 'accepted_answers' list")

    def validate_answer(self, config: Any, answer: Any) -> None:
        if not isinstance(answer, dict):
            raise ConfigError("answer must be an object")
        if config.get("mode") == "choice" and not isinstance(answer.get("selected_option_ids"), list):
            raise ConfigError("answer must be {selected_option_ids: [...]}")
        if config.get("mode") == "text" and "answer" not in answer:
            raise ConfigError("answer must be {answer: str}")

    def check(self, config: Any, answer: Any) -> CheckResult:
        if config.get("mode") == "choice":
            return self._check_choice(config, answer)
        return self._check_text(config, answer)

    @staticmethod
    def _check_choice(config: dict, answer: dict) -> CheckResult:
        correct = set(config.get("correct_option_ids") or [])
        selected = set((answer or {}).get("selected_option_ids") or [])
        if len(correct) == 1:
            score = 1.0 if selected == correct else 0.0
        else:
            true_positive = len(correct & selected)
            false_positive = len(selected - correct)
            raw = (true_positive - false_positive) / len(correct) if correct else 0.0
            score = max(0.0, min(1.0, raw))
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={})

    @staticmethod
    def _check_text(config: dict, answer: dict) -> CheckResult:
        value = (answer or {}).get("answer")
        if not isinstance(value, str):
            return CheckResult(status="WA", score=0.0, max_score=1.0, details={})
        case_sensitive = bool(config.get("case_sensitive", False))
        candidate = value.strip()
        accepted = config.get("accepted_answers", [])
        if not case_sensitive:
            candidate = candidate.lower()
            accepted = [str(a).strip().lower() for a in accepted]
        else:
            accepted = [str(a).strip() for a in accepted]
        score = 1.0 if candidate in accepted else 0.0
        status = "AC" if score >= 1.0 else "WA"
        return CheckResult(status=status, score=score, max_score=1.0, details={})
