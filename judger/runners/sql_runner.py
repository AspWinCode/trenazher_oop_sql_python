import time

from judger.runners.base_runner import BaseRunner, RunResult, TestResult
from judger.sandbox.docker_manager import run_sql_sandbox


class SQLRunner(BaseRunner):
    def run(self, code: str, tests: list[dict], **kwargs) -> RunResult:
        sql_schema = kwargs.get("sql_schema", "")
        sql_seed = kwargs.get("sql_seed", "")

        if not tests:
            return RunResult(verdict="WA", error_output="Нет тестов для проверки. Добавьте тесты к задаче.")

        all_results = []
        overall_verdict = "AC"
        total_runtime = 0.0

        for test in tests:
            test_id = test["id"]
            expected_sql = test.get("expected_output", "")
            verification_sql = test.get("verification_sql") or ""
            # input_data used as per-test seed SQL; falls back to task-level sql_seed
            test_seed = test.get("input_data") or sql_seed

            start = time.time()
            result = run_sql_sandbox(code, sql_schema, test_seed, expected_sql, verification_sql)
            elapsed = time.time() - start
            total_runtime += elapsed

            if result.timed_out:
                tr = TestResult(test_id=test_id, verdict="TLE", runtime=elapsed)
                overall_verdict = "TLE"
            elif result.exit_code == 2 or "INTERNAL_ERROR:" in result.stdout:
                # Schema/seed loading failed — task config problem, not student error
                tr = TestResult(test_id=test_id, verdict="IE", runtime=elapsed,
                                actual_output=result.stdout[:2000])
                overall_verdict = "IE"
            elif result.exit_code == 0 and "MATCH" in result.stdout:
                tr = TestResult(test_id=test_id, verdict="AC", runtime=elapsed, actual_output="Match")
            elif "RUNTIME_ERROR:" in result.stdout:
                # Student SQL raised an error (DML mode)
                error_text = result.stdout.split("RUNTIME_ERROR:", 1)[-1].strip()
                tr = TestResult(test_id=test_id, verdict="WA", runtime=elapsed,
                                actual_output=error_text[:2000])
                if overall_verdict == "AC":
                    overall_verdict = "WA"
            else:
                tr = TestResult(
                    test_id=test_id, verdict="WA", runtime=elapsed,
                    actual_output=result.stdout[:2000],
                )
                if overall_verdict == "AC":
                    overall_verdict = "WA"
            all_results.append(tr)

        return RunResult(verdict=overall_verdict, runtime=total_runtime, test_results=all_results)
