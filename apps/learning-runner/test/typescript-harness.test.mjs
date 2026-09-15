import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import {
  TYPESCRIPT_HARNESS,
  RESULT_MARKER,
  splitTestResults,
  allTestsPassed,
} from '../lib/typescript-harness.mjs';
import {
  buildSource,
  prepare,
  TYPESCRIPT_COMPILER_CONFIG,
  TYPESCRIPT_CONFIG_FILE,
} from '../lib/run-plan.mjs';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const TYPESCRIPT_COMPILER = require.resolve('typescript/lib/tsc.js');
const SCRATCH = join(process.cwd(), '.typescript-harness-test-scratch');

test('does not hand a TypeScript file to Node native stripping', () => {
  const plan = prepare('typescript', false);

  assert.deepEqual(plan.compile, [
    [
      'node',
      'node_modules/typescript/lib/tsc.js',
      '--project',
      TYPESCRIPT_CONFIG_FILE,
    ],
  ]);
  assert.deepEqual(plan.run, [
    'node',
    '--enable-source-maps',
    'compiled/main.js',
  ]);
  assert.doesNotMatch(plan.run.join(' '), /experimental-strip-types/);
});

test('keeps non-TypeScript dispatch on its existing toolchains', () => {
  assert.deepEqual(prepare('go', false).run, ['./main']);
  assert.deepEqual(prepare('rust', false), {
    compile: [['rustc', '--edition', '2021', 'main.rs', '-o', 'main']],
    run: ['./main'],
  });
  assert.deepEqual(prepare('cpp', false, '/opt/catch2'), {
    compile: [['g++', '-std=c++17', 'main.cpp', '-o', 'main']],
    run: ['./main'],
  });
});

/** Runs harness + code the way the runner does, and reads the results back. */
async function harness(body) {
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'harness-test-'));
  try {
    const file = join(dir, 'main.ts');
    await writeFile(
      file,
      buildSource('typescript', '', body, TYPESCRIPT_HARNESS)
    );
    await writeFile(
      join(dir, TYPESCRIPT_CONFIG_FILE),
      JSON.stringify(TYPESCRIPT_COMPILER_CONFIG)
    );
    const plan = prepare('typescript', true, undefined, TYPESCRIPT_COMPILER);
    let stdout = '';
    try {
      await run(plan.compile[0][0], plan.compile[0].slice(1), { cwd: dir });
      ({ stdout } = await run(plan.run[0], plan.run.slice(1), { cwd: dir }));
    } catch (error) {
      stdout = error.stdout ?? '';
    }

    test.after(async () => {
      await rm(SCRATCH, { recursive: true, force: true });
    });
    return splitTestResults(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('a passing assertion is reported as passing', async () => {
  const { testResults } = await harness(
    `test('adds', () => { expect(1 + 1).toBe(2); });`
  );
  assert.deepEqual(testResults, [{ name: 'adds', passed: true }]);
  assert.equal(allTestsPassed(testResults), true);
});

test('a failing assertion names what it wanted and what it got', async () => {
  const { testResults } = await harness(
    `test('adds', () => { expect(1 + 1).toBe(3); });`
  );
  assert.equal(testResults[0].passed, false);
  assert.match(testResults[0].error, /Expected 3, received 2/);
  assert.equal(allTestsPassed(testResults), false);
});

// The old harness rethrew, so the first failure hid every later one.
test('one failure does not stop the remaining cases', async () => {
  const { testResults } = await harness(`
    test('first', () => { expect(1).toBe(2); });
    test('second', () => { expect(2).toBe(2); });
    test('third', () => { expect(3).toBe(3); });
  `);
  assert.equal(testResults.length, 3);
  assert.deepEqual(
    testResults.map((r) => r.passed),
    [false, true, true]
  );
});

test('toContain works on arrays and strings', async () => {
  const { testResults } = await harness(`
    test('array', () => { expect([1, 2, 3]).toContain(2); });
    test('string', () => { expect('hello world').toContain('world'); });
    test('missing', () => { expect([1]).toContain(9); });
  `);
  assert.deepEqual(
    testResults.map((r) => r.passed),
    [true, true, false]
  );
});

test('toThrow catches a throwing function and can match the message', async () => {
  const { testResults } = await harness(`
    test('throws', () => { expect(() => { throw new Error('boom'); }).toThrow(); });
    test('message', () => { expect(() => { throw new Error('boom'); }).toThrow('boom'); });
    test('wrong message', () => { expect(() => { throw new Error('boom'); }).toThrow('bang'); });
    test('never throws', () => { expect(() => 1).toThrow(); });
  `);
  assert.deepEqual(
    testResults.map((r) => r.passed),
    [true, true, false, false]
  );
});

test('spies record calls, counts and arguments', async () => {
  const { testResults } = await harness(`
    test('called', () => { const s = spy(); s(); expect(s).toHaveBeenCalled(); });
    test('times', () => { const s = spy(); s(); s(); expect(s).toHaveBeenCalledTimes(2); });
    test('with', () => { const s = spy(); s(1, 'a'); expect(s).toHaveBeenCalledWith(1, 'a'); });
    test('not called', () => { const s = spy(); expect(s).toHaveBeenCalled(); });
  `);
  assert.deepEqual(
    testResults.map((r) => r.passed),
    [true, true, true, false]
  );
});

test('a spy still returns what its implementation returns', async () => {
  const { testResults } = await harness(
    `test('impl', () => { const s = spy((n) => n * 2); expect(s(21)).toBe(42); });`
  );
  assert.equal(testResults[0].passed, true);
});

test('the remaining matchers behave', async () => {
  const { testResults } = await harness(`
    test('toEqual', () => { expect({ a: 1 }).toEqual({ a: 1 }); });
    test('toBeTruthy', () => { expect(1).toBeTruthy(); });
    test('toBeFalsy', () => { expect(0).toBeFalsy(); });
    test('toBeNull', () => { expect(null).toBeNull(); });
    test('toBeUndefined', () => { expect(undefined).toBeUndefined(); });
    test('toHaveLength', () => { expect([1, 2]).toHaveLength(2); });
    test('toBeCloseTo', () => { expect(0.1 + 0.2).toBeCloseTo(0.3); });
  `);
  assert.equal(
    testResults.every((r) => r.passed),
    true,
    JSON.stringify(testResults)
  );
});

test('it is an alias for test', async () => {
  const { testResults } = await harness(
    `it('works', () => { expect(1).toBe(1); });`
  );
  assert.equal(testResults[0].name, 'works');
});

test("the learner's own output is kept out of the results payload", async () => {
  const { output, testResults } = await harness(`
    console.log('hello from the learner');
    test('passes', () => { expect(1).toBe(1); });
  `);
  assert.match(output, /hello from the learner/);
  assert.ok(!output.includes(RESULT_MARKER));
  assert.equal(testResults.length, 1);
});

test('splitTestResults leaves plain output alone', () => {
  assert.deepEqual(splitTestResults('just output'), {
    output: 'just output',
    testResults: [],
  });
});

test('splitTestResults keeps the output when the payload is corrupt', () => {
  const { output, testResults } = splitTestResults(
    `visible\n${RESULT_MARKER}\n{not json`
  );
  assert.equal(output, 'visible');
  assert.deepEqual(testResults, []);
});

test('a run with no cases at all does not count as passing', () => {
  assert.equal(allTestsPassed([]), false);
});
