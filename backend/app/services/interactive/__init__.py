from __future__ import annotations

from app.services.interactive.base import Checker, CheckResult, ConfigError
from app.services.interactive.categorization import CategorizationChecker
from app.services.interactive.fill_blanks import FillBlanksChecker
from app.services.interactive.find_error import FindErrorChecker
from app.services.interactive.formula_builder import FormulaBuilderChecker
from app.services.interactive.grouping import GroupingChecker
from app.services.interactive.hotspot import HotspotChecker
from app.services.interactive.input_answer import InputAnswerChecker
from app.services.interactive.matching import MatchingChecker
from app.services.interactive.multi_select_elements import MultiSelectElementsChecker
from app.services.interactive.multiple_choice import MultipleChoiceChecker
from app.services.interactive.object_assembly import ObjectAssemblyChecker
from app.services.interactive.odd_one_out import OddOneOutChecker
from app.services.interactive.ordering import OrderingChecker
from app.services.interactive.parameter_adjustment import ParameterAdjustmentChecker
from app.services.interactive.pattern_completion import PatternCompletionChecker
from app.services.interactive.point_selection import PointSelectionChecker
from app.services.interactive.restore_structure import RestoreStructureChecker
from app.services.interactive.situation_analysis import SituationAnalysisChecker
from app.services.interactive.solution_correction import SolutionCorrectionChecker
from app.services.interactive.table_fill import TableFillChecker

# One entry per mechanic code. Adding a new mechanic later = one new module +
# one new line here; nothing else in this package needs to change.
MECHANIC_CHECKERS: dict[str, Checker] = {
    "multiple_choice": MultipleChoiceChecker(),
    "matching": MatchingChecker(),
    "ordering": OrderingChecker(),
    "fill_blanks": FillBlanksChecker(),
    "input_answer": InputAnswerChecker(),
    "categorization": CategorizationChecker(),
    "odd_one_out": OddOneOutChecker(),
    "multi_select_elements": MultiSelectElementsChecker(),
    "pattern_completion": PatternCompletionChecker(),
    "table_fill": TableFillChecker(),
    "solution_correction": SolutionCorrectionChecker(),
    "situation_analysis": SituationAnalysisChecker(),
    "find_error": FindErrorChecker(),
    "grouping": GroupingChecker(),
    "restore_structure": RestoreStructureChecker(),
    "formula_builder": FormulaBuilderChecker(),
    "object_assembly": ObjectAssemblyChecker(),
    "parameter_adjustment": ParameterAdjustmentChecker(),
    "hotspot": HotspotChecker(),
    "point_selection": PointSelectionChecker(),
}


def get_checker(mechanic: str | None) -> Checker:
    if not mechanic or mechanic not in MECHANIC_CHECKERS:
        raise ConfigError(f"Unknown or missing mechanic: {mechanic!r}")
    return MECHANIC_CHECKERS[mechanic]


__all__ = ["MECHANIC_CHECKERS", "get_checker", "CheckResult", "ConfigError", "Checker"]
