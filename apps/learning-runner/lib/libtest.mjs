/**
 * Reading Rust's built-in test output.
 *
 * The runner compiles with `rustc --test`, so the binary is libtest's harness
 * and its exit code already decides the verdict. This exists only to say which
 * test failed and why, which the learner cannot get from a non-zero exit.
 *
 * The format has been stable for years:
 *
 *   running 2 tests
 *   test tests::it_adds ... ok
 *   test tests::it_fails ... FAILED
 *
 *   failures:
 *
 *   ---- tests::it_fails stdout ----
 *   thread 'tests::it_fails' panicked at main.rs:10:20:
 *   assertion `left == right` failed
 *     left: 3
 *    right: 99
 *
 *   test result: FAILED. 1 passed; 1 failed; 0 ignored; ...
 */

const OUTCOME = /^test (\S+) \.\.\. (ok|FAILED|ignored)$/;
const SUMMARY = /^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed/;
const FAILURE_HEADER = /^---- (\S+) stdout ----$/;

/**
 * The panic message for each failed test, keyed by test name.
 *
 * Everything libtest prints under a failure header belongs to that test until
 * the next header or the failures list. The backtrace hint is dropped because
 * the learner cannot act on it here.
 */
function failureDetails(lines) {
  const details = new Map();
  let current = null;
  let collected = [];

  const commit = () => {
    if (!current) return;
    const message = collected
      .filter((line) => !line.startsWith('note: run with `RUST_BACKTRACE'))
      .join('\n')
      .trim();
    if (message) details.set(current, message);
  };

  for (const line of lines) {
    const header = FAILURE_HEADER.exec(line.trim());
    if (header) {
      commit();
      current = header[1];
      collected = [];
      continue;
    }
    // The trailing "failures:" list repeats the names with no detail, and
    // the summary line ends the section.
    if (current && (line.trim() === 'failures:' || SUMMARY.test(line.trim()))) {
      commit();
      current = null;
      continue;
    }
    if (current) collected.push(line);
  }
  commit();

  return details;
}

export function parseLibtestOutput(output) {
  const lines = String(output ?? '').split('\n');
  const outcomes = [];
  let sawSummary = false;
  let passed = 0;
  let failed = 0;

  for (const line of lines) {
    const outcome = OUTCOME.exec(line.trim());
    if (outcome) {
      outcomes.push({ name: outcome[1], status: outcome[2] });
      continue;
    }
    const summary = SUMMARY.exec(line.trim());
    if (summary) {
      sawSummary = true;
      passed = Number(summary[2]);
      failed = Number(summary[3]);
    }
  }

  return { outcomes, sawSummary, passed, failed };
}

/**
 * Turns a libtest run into the shape every other language reports.
 *
 * The exit code is the verdict, exactly as with Catch2: libtest returns 0 when
 * every test passed and non-zero otherwise. Parsing only supplies the detail,
 * so output that cannot be read still fails safe rather than passing an
 * exercise nobody checked.
 */
export function libtestResults(output, exitCode) {
  const { outcomes, sawSummary, passed, failed } = parseLibtestOutput(output);
  const details = failureDetails(String(output ?? '').split('\n'));
  const succeeded = exitCode === 0 && sawSummary;

  const testResults = outcomes
    .filter((outcome) => outcome.status !== 'ignored')
    .map((outcome) => ({
      name: outcome.name,
      passed: outcome.status === 'ok',
      ...(outcome.status === 'FAILED' && details.has(outcome.name)
        ? { error: details.get(outcome.name) }
        : {}),
    }));

  if (testResults.length > 0) return { testsPassed: succeeded, testResults };

  // A harness that ran but declared no tests is an exercise with no
  // assertions, which must not read as a pass.
  return {
    testsPassed: succeeded && sawSummary && passed > 0,
    testResults: [
      {
        name: 'test run',
        passed: succeeded && passed > 0,
        error: sawSummary
          ? `${passed} passed, ${failed} failed`
          : 'The tests did not report a result.',
      },
    ],
  };
}
