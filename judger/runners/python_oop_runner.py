import time

from judger.runners.base_runner import BaseRunner, RunResult, TestResult
from judger.sandbox.docker_manager import run_pytest_sandbox


class PythonOOPRunner(BaseRunner):
    def run(self, code: str, tests: list[dict], **kwargs) -> RunResult:
        if not tests:
            return RunResult(verdict="WA", error_output="Нет тестов для проверки. Добавьте тесты к задаче.")

        all_results = []
        overall_verdict = "AC"
        total_runtime = 0.0

        for test in tests:
            test_id = test["id"]
            test_code = test.get("expected_output", "")
            test_files = test.get("test_files") or []

            start = time.time()
            result = run_pytest_sandbox(code, test_code, extra_files=test_files)
            elapsed = time.time() - start
            total_runtime += elapsed

            if result.timed_out:
                tr = TestResult(test_id=test_id, verdict="TLE", runtime=elapsed)
                overall_verdict = "TLE"
            elif result.exit_code == 0:
                tr = TestResult(test_id=test_id, verdict="AC", runtime=elapsed, actual_output="All tests passed")
            else:
                tr = TestResult(
                    test_id=test_id, verdict="WA", runtime=elapsed,
                    actual_output=result.stdout[:2000],
                )
                if overall_verdict == "AC":
                    overall_verdict = "WA"
            all_results.append(tr)

        return RunResult(verdict=overall_verdict, runtime=total_runtime, test_results=all_results)
