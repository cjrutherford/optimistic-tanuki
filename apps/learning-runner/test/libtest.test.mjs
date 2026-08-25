import test from 'node:test';
import assert from 'node:assert/strict';

import { libtestResults, parseLibtestOutput } from '../lib/libtest.mjs';

/**
 * These are real libtest output, captured from the runner rather than written
 * from memory, because the whole value of this parser is that it matches what
 * rustc actually prints.
 */

const PASSING = `
running 2 tests
test tests::it_adds ... ok
test tests::it_subtracts ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

`;

const FAILING = `
running 2 tests
test tests::it_adds ... ok
test tests::it_fails ... FAILED

failures:

---- tests::it_fails stdout ----

thread 'tests::it_fails' (12915) panicked at main.rs:10:20:
assertion \`left == right\` failed
  left: 3
 right: 99
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace


failures:
    tests::it_fails

test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

`;

test('reads each test and its outcome', () => {
  const { outcomes, sawSummary, passed, failed } = parseLibtestOutput(FAILING);

  assert.deepEqual(outcomes, [
    { name: 'tests::it_adds', status: 'ok' },
    { name: 'tests::it_fails', status: 'FAILED' },
  ]);
  assert.equal(sawSummary, true);
  assert.equal(passed, 1);
  assert.equal(failed, 1);
});

test('a passing run reports every test by name', () => {
  const { testsPassed, testResults } = libtestResults(PASSING, 0);

  assert.equal(testsPassed, true);
  assert.deepEqual(testResults, [
    { name: 'tests::it_adds', passed: true },
    { name: 'tests::it_subtracts', passed: true },
  ]);
});

test('a failing run says which test failed and why', () => {
  const { testsPassed, testResults } = libtestResults(FAILING, 101);

  assert.equal(testsPassed, false);
  assert.equal(testResults.length, 2);
  assert.deepEqual(testResults[0], { name: 'tests::it_adds', passed: true });

  const failure = testResults[1];
  assert.equal(failure.name, 'tests::it_fails');
  assert.equal(failure.passed, false);
  // The learner needs the assertion, not the backtrace hint.
  assert.match(failure.error, /assertion `left == right` failed/);
  assert.match(failure.error, /left: 3/);
  assert.doesNotMatch(failure.error, /RUST_BACKTRACE/);
});

test('the exit code decides the verdict, not the parse', () => {
  // Output that says everything passed cannot rescue a non-zero exit: a
  // process killed part way through must not read as a pass.
  const { testsPassed } = libtestResults(PASSING, 101);
  assert.equal(testsPassed, false);
});

test('output that cannot be read fails rather than passes', () => {
  const { testsPassed, testResults } = libtestResults('', 0);

  assert.equal(testsPassed, false);
  assert.equal(testResults[0].passed, false);
  assert.match(testResults[0].error, /did not report a result/);
});

test('a harness that ran no tests at all is not a pass', () => {
  const empty = `
running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
`;
  const { testsPassed } = libtestResults(empty, 0);

  assert.equal(testsPassed, false);
});

test('ignored tests are not reported as passing', () => {
  const withIgnored = `
running 2 tests
test tests::it_adds ... ok
test tests::not_yet ... ignored

test result: ok. 1 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.00s
`;
  const { testsPassed, testResults } = libtestResults(withIgnored, 0);

  assert.equal(testsPassed, true);
  assert.deepEqual(testResults, [{ name: 'tests::it_adds', passed: true }]);
});
