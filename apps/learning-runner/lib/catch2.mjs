import { join } from 'node:path';
import { access } from 'node:fs/promises';

/**
 * Where the pre-compiled Catch2 lives.
 *
 * The image downloads the amalgamated distribution and compiles it once at
 * build time, because compiling it per run costs about nine seconds and the
 * whole run budget is ten. With the object pre-built, linking a challenge
 * against it takes well under a second.
 */
export const CATCH2_DIR = process.env.CATCH2_DIR ?? '/opt/catch2';

export function catch2Paths(dir = CATCH2_DIR) {
  return {
    dir,
    header: join(dir, 'catch_amalgamated.hpp'),
    object: join(dir, 'catch_amalgamated.o'),
  };
}

/** Whether this machine can build C++ tests at all. */
export async function catch2Available(dir = CATCH2_DIR) {
  const { header, object } = catch2Paths(dir);
  try {
    await access(header);
    await access(object);
    return true;
  } catch {
    return false;
  }
}

/**
 * The compile command for a C++ submission.
 *
 * Test builds link the pre-compiled Catch2 object, which also supplies main().
 * Plain runs do not, because the learner's own main() would clash with it.
 */
export function cppCompileCommand({ source, output, test, dir = CATCH2_DIR }) {
  const { object } = catch2Paths(dir);
  const base = ['g++', '-std=c++17'];
  return test
    ? [...base, `-I${dir}`, source, object, '-o', output]
    : [...base, source, '-o', output];
}

// "fail.cpp:4: failed: add(2, 3) == 5 for: -1 == 5"
const FAILURE = /^(.+?):(\d+):\s*(?:FAILED|failed):\s*(.*)$/;
// "test cases: 2 | 1 passed | 1 failed"
const SUMMARY = /^test cases:\s*(\d+)\s*\|(.*)$/;
// "All tests passed (3 assertions in 2 test cases)"
const ALL_PASSED = /^All tests passed\s*\((\d+) assertion/;

/**
 * Reads Catch2's compact reporter into structured results.
 *
 * Exit code alone would do for pass or fail, but the learner needs to see
 * which assertion broke and where, so the failure lines are parsed out.
 */
export function parseCatch2Output(output) {
  const lines = String(output ?? '').split('\n');
  const failures = [];
  let total = 0;
  let passed = 0;
  let failed = 0;
  let sawSummary = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const allPassed = ALL_PASSED.exec(line);
    if (allPassed) {
      sawSummary = true;
      continue;
    }

    const summary = SUMMARY.exec(line);
    if (summary) {
      sawSummary = true;
      total = Number(summary[1]);
      const passedMatch = /(\d+)\s+passed/.exec(summary[2]);
      const failedMatch = /(\d+)\s+failed/.exec(summary[2]);
      passed = passedMatch ? Number(passedMatch[1]) : 0;
      failed = failedMatch ? Number(failedMatch[1]) : 0;
      continue;
    }

    const failure = FAILURE.exec(line);
    if (failure) {
      failures.push({
        name: failure[3].trim(),
        passed: false,
        line: Number(failure[2]),
        error: line,
      });
    }
  }

  return { failures, total, passed, failed, sawSummary };
}

/**
 * Turns a Catch2 run into the shape every other language reports.
 *
 * The exit code is what decides the verdict: Catch2 returns 0 when everything
 * passed and 42 when something did not. Parsing only supplies the detail.
 */
export function catch2Results(output, exitCode) {
  const { failures, total, passed, failed, sawSummary } =
    parseCatch2Output(output);
  const succeeded = exitCode === 0 && sawSummary;

  if (succeeded) {
    return {
      testsPassed: true,
      testResults:
        total > 0
          ? [{ name: `${total} test case(s)`, passed: true }]
          : [{ name: 'all assertions', passed: true }],
    };
  }

  return {
    testsPassed: false,
    testResults: failures.length
      ? failures
      : [
          {
            name: failed ? `${failed} of ${total} test case(s)` : 'test run',
            passed: false,
            error: sawSummary
              ? `${passed} passed, ${failed} failed`
              : 'The tests did not report a result.',
          },
        ],
  };
}
