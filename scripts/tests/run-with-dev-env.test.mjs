import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
test('development runner loads file values, preserves exported overrides, and propagates failure without printing secrets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-env-runner-'));
  try {
    fs.writeFileSync(
      path.join(dir, '.env'),
      'OT_TEST_CONFIG=file-fixture\nOT_TEST_OVERRIDE=file-fixture\n'
    );
    const r = spawnSync(
      process.execPath,
      [
        path.resolve('scripts/run-with-dev-env.mjs'),
        process.execPath,
        '-e',
        'if(process.env.OT_TEST_CONFIG!=="file-fixture"||process.env.OT_TEST_OVERRIDE!=="exported-fixture")process.exit(99);process.exit(7)',
      ],
      {
        cwd: dir,
        env: { ...process.env, OT_TEST_OVERRIDE: 'exported-fixture' },
        encoding: 'utf8',
        timeout: 15000,
      }
    );
    assert.equal(r.status, 7, r.stderr);
    assert.equal(r.stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
