import time

from judger.runners.base_runner import BaseRunner, RunResult, TestResult
from judger.sandbox.docker_manager import run_cpp_sandbox


class CppRunner(BaseRunner):
    def run(self, code, tests, **kwargs):
        all_results = []
        overall_verdict = "AC"
        total_runtime = 0.0

        for test in tests:
            test_id = test["id"]
            input_data = test.get("input_data", "")
            expected = (test.get("expected_output", "") or "").strip()

            start = time.time()
            result = run_cpp_sandbox(code, stdin_data=input_data or "")
            elapsed = time.time() - start
            total_runtime += elapsed

            if result.timed_out:
                tr = TestResult(test_id=test_id, verdict="TLE", runtime=elapsed)
                overall_verdict = "TLE"
            elif "compilation failed" in result.stderr.lower() or result.exit_code == 99:
                tr = TestResult(test_id=test_id, verdict="CE", runtime=elapsed, actual_output=result.stderr[:2000])
                if overall_verdict == "AC":
                    overall_verdict = "CE"
            elif result.exit_code != 0:
                tr = TestResult(test_id=test_id, verdict="RE", runtime=elapsed, actual_output=result.stderr[:2000])
                if overall_verdict == "AC":
                    overall_verdict = "RE"
            else:
                actual = result.stdout.strip()
                if actual == expected:
                    tr = TestResult(test_id=test_id, verdict="AC", runtime=elapsed, actual_output=actual)
                else:
                    tr = TestResult(test_id=test_id, verdict="WA", runtime=elapsed, actual_output=actual)
                    if overall_verdict == "AC":
                        overall_verdict = "WA"
            all_results.append(tr)

        return RunResult(verdict=overall_verdict, runtime=total_runtime, test_results=all_results)
