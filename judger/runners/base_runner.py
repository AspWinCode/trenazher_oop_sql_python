import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TestResult:
    test_id: int
    verdict: str
    runtime: float = 0.0
    actual_output: str = ""
    # Ожидаемый результат, вычисленный раннером (например, эталонные строки SQL).
    # Для типов, где эталона нет (pytest), остаётся пустым.
    expected_output: str = ""


_HEX_ADDR = re.compile(r" at 0x[0-9a-fA-F]+")


def summarize_pytest_failure(stdout: str, limit: int = 800) -> str:
    """Превратить сырой вывод pytest в короткое человекочитаемое сообщение.

    Эталонного значения у pytest-задач нет, а технический лог pytest (адреса
    функций, дампы массивов, 'use -vv') студенту непонятен. Поэтому по приоритету
    распознаём типовые случаи и выдаём одну-две понятные строки."""
    text = _HEX_ADDR.sub("", stdout)
    lines = text.splitlines()
    estripped = [ln[1:].strip() if ln.startswith("E ") else ln.strip() for ln in lines]

    # 1. Не-assert исключение в коде студента (TypeError, NameError, ValueError…)
    for s in estripped:
        m = re.match(r"([\w.]*(?:Error|Exception)): (.+)", s)
        if m and "AssertionError" not in m.group(1):
            return f"Ваш код вызвал ошибку:\n{m.group(1)}: {m.group(2)}"[:limit]

    # 2. Сравнение значений: assert X == Y (без функций/громоздких дампов)
    for s in estripped:
        m = re.search(r"assert\s+(.+?)\s*==\s*(.+)", s)
        if m:
            got, want = m.group(1).strip(), m.group(2).strip()
            if (
                "<function" not in got and "<function" not in want
                and "array(" not in got and "array(" not in want
                and len(got) <= 200 and len(want) <= 200
            ):
                return f"Результат не совпал:\n  получено: {got}\n  ожидалось: {want}"[:limit]

    # 3. numpy-массивы не совпали (array_equal / allclose вернули False)
    if any("array_equal" in s or "allclose" in s for s in estripped):
        return "Результат не совпал с ожидаемым массивом."

    # 4. Различие по индексу (pytest 'At index N diff: A != B')
    for s in estripped:
        m = re.search(r"At index (\d+) diff: (.+?) != (.+)", s)
        if m:
            return (
                f"Различие в позиции {m.group(1)}: "
                f"получено {m.group(2)}, ожидалось {m.group(3)}"
            )[:limit]

    # 5. Запасной вариант: ключевые E-строки без технического мусора
    noise = ("+ where", "+ and", "Full diff", "...Full output", "use '-vv'", "use \"-vv\"")
    e_lines = [s for ln, s in zip(lines, estripped)
               if ln.startswith("E ") and s and not s.startswith(noise)]
    body = e_lines[:6] if e_lines else ["Результат не совпал с ожидаемым."]
    return "\n".join(body)[:limit]


@dataclass
class RunResult:
    verdict: str
    runtime: float = 0.0
    memory: float = 0.0
    error_output: str = ""
    test_results: list[TestResult] = field(default_factory=list)


class BaseRunner(ABC):
    @abstractmethod
    def run(self, code: str, tests: list[dict], **kwargs) -> RunResult:
        pass
