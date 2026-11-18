import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  restoreGuard,
  validateManifest,
  isSafeDbName,
} = require('./directory-backup-lib.cjs');

const sha = 'a'.repeat(64);
const manifest = () => ({
  createdAt: '2026-11-17T00:00:00.000Z',
  toolVersion: 'directory-backup/1',
  databases: {
    ot_directory: {
      file: 'ot_directory.dump',
      bytes: 10,
      sha256: sha,
      latestMigration: 'DirectoryExports1794969950698',
      rowCounts: { directory_town: 3 },
      providerBudget: { attempts: 2, reservedCents: 5 },
    },
  },
  exports: { file: 'exports.tar', bytes: 1, sha256: sha, fileCount: 0 },
});

test('a complete manifest validates', () => {
  assert.deepEqual(validateManifest(manifest()), []);
});

test('manifest validation names each defect', () => {
  const m = manifest();
  m.databases.ot_directory.sha256 = 'xyz';
  m.databases.ot_directory.file = '../escape';
  m.databases.ot_directory.rowCounts.directory_town = -1;
  delete m.exports;
  const errors = validateManifest(m).join('|');
  assert.match(errors, /sha256 invalid/);
  assert.match(errors, /file invalid/);
  assert.match(errors, /rowCounts.directory_town invalid/);
  assert.match(errors, /exports missing/);
});

test('scratch targets restore without --live', () => {
  assert.equal(restoreGuard({ target: 's9_scratch_restore' }).ok, true);
});

test('live databases are refused without --live', () => {
  const r = restoreGuard({ target: 'ot_directory' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /without --live/);
});

test('--live is refused while a directory container runs', () => {
  const r = restoreGuard({
    target: 'ot_directory_census_stage',
    live: true,
    running: ['optimistic-tanuki-directory-worker-1'],
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /fence not in place/);
});

test('--live passes only when every directory container is stopped', () => {
  const r = restoreGuard({
    target: 'ot_directory',
    live: true,
    running: ['town-square-directory-db'],
  });
  assert.equal(r.ok, true);
});

test('--live on a scratch name and unsafe identifiers are refused', () => {
  assert.equal(restoreGuard({ target: 's9_scratch', live: true }).ok, false);
  assert.equal(isSafeDbName('x"; DROP DATABASE ot_directory; --'), false);
  assert.equal(restoreGuard({ target: 'Bad-Name' }).ok, false);
});
