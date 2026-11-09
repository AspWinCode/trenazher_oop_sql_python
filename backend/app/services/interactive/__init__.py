from __future__ import annotations

from app.services.interactive.base import Checker, CheckResult, ConfigError
from app.services.interactive.fill_blanks import FillBlanksChecker
from app.services.interactive.input_answer import InputAnswerChecker
from app.services.interactive.matching import MatchingChecker
from app.services.interactive.multiple_choice import MultipleChoiceChecker
from app.services.interactive.ordering import OrderingChecker

# One entry per mechanic code. Adding a new mechanic later = one new module +
# one new line here; nothing else in this package needs to change.
MECHANIC_CHECKERS: dict[str, Checker] = {
    "multiple_choice": MultipleChoiceChecker(),
    "matching": MatchingChecker(),
    "ordering": OrderingChecker(),
    "fill_blanks": FillBlanksChecker(),
    "input_answer": InputAnswerChecker(),
}


def get_checker(mechanic: str | None) -> Checker:
    if not mechanic or mechanic not in MECHANIC_CHECKERS:
        raise ConfigError(f"Unknown or missing mechanic: {mechanic!r}")
    return MECHANIC_CHECKERS[mechanic]


__all__ = ["MECHANIC_CHECKERS", "get_checker", "CheckResult", "ConfigError", "Checker"]
