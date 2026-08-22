import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  catch2Available,
  catch2Paths,
  catch2Results,
  cppCompileCommand,
  parseCatch2Output,
} from '../lib/catch2.mjs';
import { prepare, buildSource } from '../lib/run-plan.mjs';

const run = promisify(execFile);

// Catch2's compact reporter, captured from a real run.
const PASSING = `RNG seed: 2320593610
All tests passed (3 assertions in 2 test cases)
`;
const FAILING = `RNG seed: 3602940808
fail.cpp:4: failed: add(2, 3) == 5 for: -1 == 5
test cases: 2 | 1 passed | 1 failed
assertions: 2 | 1 passed | 1 failed
`;

test('reads a clean run as a pass', () => {
  const parsed = parseCatch2Output(PASSING);
  assert.equal(parsed.sawSummary, true);
  assert.equal(parsed.failures.length, 0);

  const { testsPassed } = catch2Results(PASSING, 0);
  assert.equal(testsPassed, true);
});

test('reads a failing run and keeps the assertion that broke', () => {
  const parsed = parseCatch2Output(FAILING);
  assert.equal(parsed.total, 2);
  assert.equal(parsed.passed, 1);
  assert.equal(parsed.failed, 1);
  assert.equal(parsed.failures.length, 1);
  assert.equal(parsed.failures[0].line, 4);
  assert.match(parsed.failures[0].name, /add\(2, 3\) == 5/);
});

test('the exit code decides the verdict, not the text', () => {
  // Catch2 exits 42 when something failed.
  assert.equal(catch2Results(FAILING, 42).testsPassed, false);
  assert.equal(catch2Results(PASSING, 0).testsPassed, true);
});

test('a crash before any summary is not a pass', () => {
  const { testsPassed, testResults } = catch2Results('Segmentation fault', 139);
  assert.equal(testsPassed, false);
  assert.match(testResults[0].error, /did not report a result/);
});

test('an empty output is not a pass', () => {
  assert.equal(catch2Results('', 0).testsPassed, false);
});

test('test builds link Catch2 and plain runs do not', () => {
  const testCmd = cppCompileCommand({
    source: 'main.cpp',
    output: 'main',
    test: true,
    dir: '/opt/catch2',
  });
  assert.ok(testCmd.includes('/opt/catch2/catch_amalgamated.o'));
  assert.ok(testCmd.includes('-I/opt/catch2'));

  // A plain run keeps the learner's own main(), so Catch2's must not be linked.
  const runCmd = cppCompileCommand({
    source: 'main.cpp',
    output: 'main',
    test: false,
    dir: '/opt/catch2',
  });
  assert.ok(!runCmd.some((part) => part.includes('catch_amalgamated')));
});

test('a C++ test run asks for the compact reporter', () => {
  const plan = prepare('cpp', true, '/opt/catch2');
  assert.deepEqual(plan.run, ['./main', '--reporter', 'compact']);
  assert.equal(prepare('cpp', false, '/opt/catch2').run[0], './main');
});

test('test code goes after the code it is testing', () => {
  const source = buildSource(
    'cpp',
    'int add(int a,int b){return a+b;}',
    'TEST_CASE("x"){}'
  );
  assert.ok(source.indexOf('int add') < source.indexOf('TEST_CASE'));
});

test('an unknown language has no plan', () => {
  assert.equal(prepare('cobol', false, '/opt/catch2'), null);
});

// The real thing, when a pre-compiled Catch2 is available. The runner image
// builds one; a developer machine may not have it, so this skips rather than
// fails. Point CATCH2_DIR at a built copy to exercise it.
const available = await catch2Available();

test(
  'compiles and runs a real Catch2 exercise',
  { skip: available ? false : 'no pre-compiled Catch2 (set CATCH2_DIR)' },
  async () => {
    const { dir, object } = catch2Paths();
    const work = await mkdtemp(join(tmpdir(), 'catch2-test-'));
    try {
      await writeFile(
        join(work, 'main.cpp'),
        buildSource(
          'cpp',
          'int add(int a, int b) { return a + b; }',
          '#include "catch_amalgamated.hpp"\nTEST_CASE("add", "[m]") { REQUIRE(add(2, 3) == 5); }'
        )
      );

      await run(
        'g++',
        ['-std=c++17', `-I${dir}`, 'main.cpp', object, '-o', 'main'],
        { cwd: work }
      );

      const { stdout } = await run('./main', ['--reporter', 'compact'], {
        cwd: work,
      });
      assert.equal(catch2Results(stdout, 0).testsPassed, true);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
);

test(
  'reports a wrong answer as a failure, with the assertion',
  { skip: available ? false : 'no pre-compiled Catch2 (set CATCH2_DIR)' },
  async () => {
    const { dir, object } = catch2Paths();
    const work = await mkdtemp(join(tmpdir(), 'catch2-test-'));
    try {
      await writeFile(
        join(work, 'main.cpp'),
        buildSource(
          'cpp',
          'int add(int a, int b) { return a - b; }',
          '#include "catch_amalgamated.hpp"\nTEST_CASE("add", "[m]") { REQUIRE(add(2, 3) == 5); }'
        )
      );

      await run(
        'g++',
        ['-std=c++17', `-I${dir}`, 'main.cpp', object, '-o', 'main'],
        { cwd: work }
      );

      let stdout = '';
      let code = 0;
      try {
        ({ stdout } = await run('./main', ['--reporter', 'compact'], {
          cwd: work,
        }));
      } catch (error) {
        stdout = error.stdout ?? '';
        code = error.code ?? 1;
      }

      const { testsPassed, testResults } = catch2Results(stdout, code);
      assert.equal(testsPassed, false);
      assert.match(testResults[0].name, /add\(2, 3\) == 5/);
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
);
