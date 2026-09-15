import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import {
  buildGoTestSource,
  formatGoTestName,
  gotestResults,
  parseGoTestOutput,
} from '../lib/gotest.mjs';
import { prepare } from '../lib/run-plan.mjs';

const PASSING = `
=== RUN   TestDefineUserStruct
--- PASS: TestDefineUserStruct (0.00s)
=== RUN   TestUserValues
--- PASS: TestUserValues (0.00s)
PASS
ok  \tlearning\t0.001s
`;

const FAILING = `
=== RUN   TestDefineUserStruct
--- PASS: TestDefineUserStruct (0.00s)
=== RUN   TestUserValues
    main_test.go:14: input (ID: 1, Name: "Alice"): expected email "alice@example.com", got ""
--- FAIL: TestUserValues (0.00s)
FAIL
FAIL\tlearning\t0.001s
FAIL
`;

const SUBTESTS = `
=== RUN   TestAdd
=== RUN   TestAdd/positive_numbers
--- PASS: TestAdd/positive_numbers (0.00s)
=== RUN   TestAdd/negative_numbers
    main_test.go:18: input (-2, -3): expected -5, got 0
--- FAIL: TestAdd/negative_numbers (0.00s)
--- FAIL: TestAdd (0.00s)
FAIL
FAIL\tlearning\t0.001s
FAIL
`;
const SCRATCH = join(process.cwd(), '.gotest-test-scratch');

test('buildGoTestSource wraps test function if package is missing', () => {
  const code = `func TestFoo(t *testing.T) {}`;
  const wrapped = buildGoTestSource(code);
  assert.match(wrapped, /^package main/);
  assert.match(wrapped, /import \(/);
  assert.match(wrapped, /"testing"/);
  assert.match(wrapped, /func TestFoo/);
});

test('buildGoTestSource preserves full package test code', () => {
  const code = `package main\n\nimport "testing"\n\nfunc TestFoo(t *testing.T) {}`;
  const wrapped = buildGoTestSource(code);
  assert.equal(wrapped.trim(), code.trim());
});

test('formatGoTestName creates readable behavioral titles', () => {
  assert.equal(formatGoTestName('TestDefineUserStruct'), 'Define User Struct');
  assert.equal(
    formatGoTestName('TestAdd/positive_numbers'),
    'Add › positive numbers'
  );
  assert.equal(formatGoTestName('Test_EmailValidation'), 'Email Validation');
});

test('prepare compiles Go separately from test and plain execution', () => {
  const testPlan = prepare('go', true);
  assert.deepEqual(testPlan.compile, [
    ['go', 'test', '-c', '-o', 'main.test', '.'],
  ]);
  assert.deepEqual(testPlan.run, [
    './main.test',
    '-test.v',
    '-test.run',
    '^Test',
    '-test.count=1',
  ]);

  const plainPlan = prepare('go', false);
  assert.deepEqual(plainPlan.compile, [
    ['go', 'build', '-o', 'main', 'main.go'],
  ]);
  assert.deepEqual(plainPlan.run, ['./main']);
});

test('prepare bounds benchmark execution and excludes ordinary tests', () => {
  assert.deepEqual(prepare('go', 'benchmark').compile, [
    ['go', 'test', '-c', '-o', 'main.test', '.'],
  ]);
  assert.deepEqual(prepare('go', 'benchmark').run, [
    './main.test',
    '-test.v',
    '-test.run',
    '^$',
    '-test.bench',
    '^Benchmark',
    '-test.benchtime=100ms',
    '-test.count=1',
  ]);
});

test('reads each test and its outcome', () => {
  const { outcomes, sawSummary, passed, failed } = parseGoTestOutput(FAILING);

  assert.deepEqual(outcomes, [
    { name: 'TestDefineUserStruct', status: 'PASS' },
    { name: 'TestUserValues', status: 'FAIL' },
  ]);
  assert.equal(sawSummary, true);
  assert.equal(passed, 1);
  assert.equal(failed, 1);
});

test('a passing run reports every test by name', () => {
  const { testsPassed, testResults } = gotestResults(PASSING, 0);

  assert.equal(testsPassed, true);
  assert.deepEqual(testResults, [
    { name: 'Define User Struct', passed: true },
    { name: 'User Values', passed: true },
  ]);
});

test('a failing run reports which assertion failed and inputs used', () => {
  const { testsPassed, testResults } = gotestResults(FAILING, 1);

  assert.equal(testsPassed, false);
  assert.equal(testResults.length, 2);
  assert.deepEqual(testResults[0], {
    name: 'Define User Struct',
    passed: true,
  });

  const failure = testResults[1];
  assert.equal(failure.name, 'User Values');
  assert.equal(failure.passed, false);
  assert.match(failure.error, /input \(ID: 1, Name: "Alice"\)/);
  assert.doesNotMatch(failure.error, /main_test\.go/);
});

test('handles subtests cleanly without duplicate parent tests', () => {
  const { testsPassed, testResults } = gotestResults(SUBTESTS, 1);

  assert.equal(testsPassed, false);
  assert.equal(testResults.length, 2);
  assert.deepEqual(testResults[0], {
    name: 'Add › positive numbers',
    passed: true,
  });
  assert.equal(testResults[1].name, 'Add › negative numbers');
  assert.equal(testResults[1].passed, false);
  assert.match(testResults[1].error, /input \(-2, -3\)/);
});

test('a passing benchmark reports the benchmark by name', () => {
  const { testsPassed, testResults } = gotestResults(
    [
      'goos: linux',
      'goarch: amd64',
      'BenchmarkAdd-8 1000000000 0.3000 ns/op',
      'PASS',
      'ok  learning  0.101s',
    ].join('\n'),
    0,
    [],
    'benchmark'
  );

  assert.equal(testsPassed, true);
  assert.deepEqual(testResults, [{ name: 'Add', passed: true }]);
});

test('compilation errors are reported cleanly', () => {
  const { testsPassed, testResults } = gotestResults(
    'FAIL\tlearning [build failed]',
    1,
    ['./main.go:4:2: syntax error']
  );

  assert.equal(testsPassed, false);
  assert.equal(testResults[0].name, 'Compilation & Build');
  assert.equal(testResults[0].passed, false);
  assert.match(testResults[0].error, /syntax error/);
});

test('executes a real Go test in scratch directory', async () => {
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'gotest-e2e-'));
  try {
    await writeFile(join(dir, 'go.mod'), 'module learning\n\ngo 1.22\n');
    await writeFile(
      join(dir, 'main.go'),
      `package main\n\nfunc Add(a, b int) int {\n\treturn a + b\n}\n`
    );
    await writeFile(
      join(dir, 'main_test.go'),
      `package main\n\nimport "testing"\n\nfunc TestAdd(t *testing.T) {\n\tif Add(2, 3) != 5 {\n\t\tt.Errorf("input (2, 3): expected 5, got %d", Add(2, 3))\n\t}\n}\n`
    );

    const child = spawn('go', ['test', '-v', '.'], { cwd: dir });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c.toString()));
    child.stderr.on('data', (c) => (stderr += c.toString()));

    const exitCode = await new Promise((resolve) => child.on('close', resolve));
    assert.equal(exitCode, 0);

    const { testsPassed, testResults } = gotestResults(stdout, exitCode);
    assert.equal(testsPassed, true);
    assert.equal(testResults.length, 1);
    assert.equal(testResults[0].name, 'Add');
    assert.equal(testResults[0].passed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test.after(async () => {
  await rm(SCRATCH, { recursive: true, force: true });
});
