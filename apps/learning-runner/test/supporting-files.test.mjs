import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolved from this file, because the nx target runs with the app as its
// working directory and the repo root is not a safe assumption.
const SERVER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'server.mjs'
);

/**
 * Supporting files let an exercise ship a module for the learner to import,
 * which is the only way a lesson about imports can have an exercise at all.
 *
 * They are also the first thing in this runner that writes a caller-chosen
 * filename, so the names are checked before anything touches the disk. These
 * drive the real server over HTTP, because a validator that is only unit
 * tested proves nothing about what the route actually accepts.
 */

async function withServer(run) {
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '3099' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    // The server logs nothing on start, so poll until it answers.
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        await fetch('http://127.0.0.1:3099/health');
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return await run();
  } finally {
    server.kill('SIGKILL');
    await once(server, 'close');
  }
}

const post = (body) =>
  fetch('http://127.0.0.1:3099/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((response) => response.json());

test('an exercise can ship a module for the learner to import', async () => {
  const result = await withServer(() =>
    post({
      languageId: 'typescript',
      code: `import { greet } from './greeting.ts';\nconsole.log(greet('Ada'));`,
      supportingFiles: {
        'greeting.ts': `export const greet = (name: string): string => 'Hello, ' + name;`,
      },
    })
  );

  assert.equal(result.success, true, JSON.stringify(result.errors));
  assert.equal(result.output.trim(), 'Hello, Ada');
});

test('a name that could escape the run directory is refused', async () => {
  const attempts = [
    '../escape.ts',
    '/etc/passwd.ts',
    'nested/file.ts',
    '..',
    '.',
  ];

  const results = await withServer(async () => {
    const out = [];
    for (const name of attempts) {
      out.push(
        await post({
          languageId: 'typescript',
          code: 'console.log(1)',
          supportingFiles: { [name]: 'export const x = 1;' },
        })
      );
    }
    return out;
  });

  for (const [index, result] of results.entries()) {
    assert.equal(result.success, false, `${attempts[index]} was accepted`);
  }
});

test('a supporting file cannot replace the learner submission', async () => {
  const result = await withServer(() =>
    post({
      languageId: 'typescript',
      code: `console.log('the learner wrote this')`,
      supportingFiles: { 'main.ts': `console.log('substituted')` },
    })
  );

  assert.equal(result.success, false);
  assert.match(String(result.errors), /may not replace main\.ts/);
});

test('only source file types are accepted', async () => {
  const result = await withServer(() =>
    post({
      languageId: 'typescript',
      code: 'console.log(1)',
      supportingFiles: { '.bashrc': 'echo pwned' },
    })
  );

  assert.equal(result.success, false);
});

test('a run with no supporting files still works', async () => {
  const result = await withServer(() =>
    post({ languageId: 'typescript', code: `console.log('plain')` })
  );

  assert.equal(result.success, true);
  assert.equal(result.output.trim(), 'plain');
});
