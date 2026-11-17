const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

test('migration retries boundedly and hides database errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'directory-migrate-'));
  try {
    const counter = join(dir, 'count');
    writeFileSync(join(dir, 'timeout'), '#!/bin/sh\nn=0; [ ! -f "$COUNT" ] || n=$(cat "$COUNT"); n=$((n+1)); echo "$n" > "$COUNT"; echo secret-database-error >&2; [ "$n" -ge "${SUCCEED_AT:-99}" ]\n', { mode: 0o755 });
    writeFileSync(join(dir, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const run = (extra = {}) => spawnSync('sh', [resolve('apps/directory/migrate-with-retry.sh')], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, COUNT: counter, DIRECTORY_DATABASE_URL: 'private-value', ...extra } });
    let result = run({ SUCCEED_AT: '3' });
    assert.equal(result.status, 0);
    assert.equal(readFileSync(counter, 'utf8').trim(), '3');
    assert.doesNotMatch(result.stdout + result.stderr, /secret-database-error|private-value/);
    rmSync(counter);
    result = run();
    assert.equal(result.status, 1);
    assert.equal(readFileSync(counter, 'utf8').trim(), '12');
    assert.match(result.stderr, /exhausted retries/);
    assert.doesNotMatch(result.stdout + result.stderr, /secret-database-error|private-value/);
    result = run({ DIRECTORY_DATABASE_URL: '' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is required/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
