import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const SERVER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'server.mjs'
);
const PORT = '3100';
const SCRATCH = join(process.cwd(), '.runner-test-scratch');

let server;

test.before(async () => {
  await mkdir(SCRATCH, { recursive: true });
  server = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT,
      LEARNING_SCRATCH_DIR: SCRATCH,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.typescript, true);
        return;
      }
    } catch {
      // The server may still be loading the compiler.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('learning runner did not become healthy');
});

test.after(async () => {
  server.kill('SIGKILL');
  await once(server, 'close');
  await rm(SCRATCH, { recursive: true, force: true });
});

async function post(body) {
  const response = await fetch(`http://127.0.0.1:${PORT}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await response.json();
}

test('runs multiline TypeScript and preserves its output', async () => {
  const result = await post({
    languageId: 'typescript',
    code: `
      const lines: string[] = ['first', 'second', 'third'];
      for (const line of lines) {
        console.log(line);
      }
    `,
    expectedOutput: 'first\nsecond\nthird\n',
  });

  assert.equal(result.success, true, JSON.stringify(result.errors));
  assert.equal(result.testsPassed, true);
  assert.equal(result.output.trim(), 'first\nsecond\nthird');
  assert.doesNotMatch(JSON.stringify(result), /ERR_NO_TYPESCRIPT/);
});

test('transpiles interfaces, type aliases, and enums before testing', async () => {
  const result = await post({
    languageId: 'typescript',
    code: `
      type UserId = number;
      enum Role { Admin = 'admin', Learner = 'learner' }
      interface User { id: UserId; role: Role }
      const user: User = { id: 7, role: Role.Learner };
    `,
    verifier: {
      testCode: `
        test('the typed id survives', function () {
          expect(user.id).toBe(7);
        });
        test('the enum value survives', function () {
          expect(user.role).toBe('learner');
        });
      `,
    },
  });

  assert.equal(result.success, true, JSON.stringify(result.errors));
  assert.equal(result.testsPassed, true);
  assert.deepEqual(
    result.testResults.map((item) => item.passed),
    [true, true]
  );
});

test('reports TypeScript compile errors separately from execution', async () => {
  const result = await post({
    languageId: 'typescript',
    code: 'const count: number = "not a number";',
    verifier: {
      testCode: 'test("never runs", function () { expect(count).toBe(1); });',
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.testsPassed, false);
  assert.equal(result.testResults[0].name, 'Compilation & Build');
  assert.match(result.testResults[0].error, /TS2322/);
  assert.match(result.testResults[0].error, /main\.ts\(1,/);
  assert.doesNotMatch(JSON.stringify(result), /ERR_NO_TYPESCRIPT/);
});

test('reports runtime errors separately from assertion failures', async () => {
  const result = await post({
    languageId: 'typescript',
    code: 'throw new Error("runtime boom");',
    verifier: {
      testCode: 'test("never runs", function () { expect(true).toBe(true); });',
    },
  });

  assert.equal(result.success, false);
  assert.equal(result.testsPassed, false);
  assert.equal(result.testResults[0].name, 'Runtime Error');
  assert.match(result.testResults[0].error, /runtime boom/);
  assert.doesNotMatch(JSON.stringify(result), /ERR_NO_TYPESCRIPT/);
});

test('kills a TypeScript process that exceeds the runner timeout', async () => {
  const result = await post({
    languageId: 'typescript',
    code: 'while (true) {}',
  });

  assert.equal(result.success, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.testsPassed, false);
  assert.doesNotMatch(JSON.stringify(result), /ERR_NO_TYPESCRIPT/);
});
