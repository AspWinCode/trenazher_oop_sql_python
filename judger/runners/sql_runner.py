import time

from judger.runners.base_runner import BaseRunner, RunResult, TestResult
from judger.sandbox.docker_manager import run_sql_sandbox


class SQLRunner(BaseRunner):
    def run(self, code: str, tests: list[dict], **kwargs) -> RunResult:
        sql_schema = kwargs.get("sql_schema", "")
        sql_seed = kwargs.get("sql_seed", "")

        all_results = []
        overall_verdict = "AC"
        total_runtime = 0.0

        for test in tests:
            test_id = test["id"]
            expected_sql = test.get("expected_output", "")

            start = time.time()
            result = run_sql_sandbox(code, sql_schema, sql_seed, expected_sql)
            elapsed = time.time() - start
            total_runtime += elapsed

            if result.timed_out:
                tr = TestResult(test_id=test_id, verdict="TLE", runtime=elapsed)
                overall_verdict = "TLE"
            elif result.exit_code == 0 and "MATCH" in result.stdout:
                tr = TestResult(test_id=test_id, verdict="AC", runtime=elapsed, actual_output="Match")
            else:
                tr = TestResult(
                    test_id=test_id, verdict="WA", runtime=elapsed,
                    actual_output=result.stdout[:2000],
                )
                if overall_verdict == "AC":
                    overall_verdict = "WA"
            all_results.append(tr)

        return RunResult(verdict=overall_verdict, runtime=total_runtime, test_results=all_results)
