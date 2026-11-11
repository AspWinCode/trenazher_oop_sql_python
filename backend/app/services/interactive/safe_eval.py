from __future__ import annotations

import ast
from typing import Any

# Minimal safe arithmetic expression evaluator for parameter_adjustment's
# recompute formula. Only numbers, named variables (parameter ids), +-*/,
# unary +-, parentheses and ** are allowed — no calls, attribute access,
# subscripts, comparisons, names other than the provided variables, etc.
# This is intentionally NOT a general scripting sandbox: it is a restricted
# arithmetic grammar, matching the ТЗ requirement for a "limited, safe
# mechanism, without executing arbitrary code".

_ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod)
_ALLOWED_UNARYOPS = (ast.UAdd, ast.USub)


class UnsafeExpressionError(ValueError):
    pass


def safe_eval(expression: str, variables: dict[str, float]) -> float:
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise UnsafeExpressionError(f"invalid expression: {exc}") from exc
    return _eval_node(tree.body, variables)


def _eval_node(node: ast.AST, variables: dict[str, float]) -> float:
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return float(node.value)
        raise UnsafeExpressionError("only numeric constants are allowed")
    if isinstance(node, ast.Name):
        if node.id not in variables:
            raise UnsafeExpressionError(f"unknown variable '{node.id}'")
        return float(variables[node.id])
    if isinstance(node, ast.BinOp) and isinstance(node.op, _ALLOWED_BINOPS):
        left = _eval_node(node.left, variables)
        right = _eval_node(node.right, variables)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
        if isinstance(node.op, ast.Pow):
            return left ** right
        if isinstance(node.op, ast.Mod):
            return left % right
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, _ALLOWED_UNARYOPS):
        value = _eval_node(node.operand, variables)
        return value if isinstance(node.op, ast.UAdd) else -value
    raise UnsafeExpressionError(f"unsupported expression element: {type(node).__name__}")
