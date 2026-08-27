/**
 * The pruner has to remove exactly the entries whose files are missing, and
 * leave a healthy manifest untouched.
 *
 * Worth testing rather than eyeballing, because the failure it prevents is
 * silent: a manifest naming one absent file hangs every request the service
 * worker handles, with no error anywhere and a fully green test suite.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  'prune-ngsw-phantoms.mjs'
);

function browserDir(files, manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'ngsw-'));
  for (const [name, body] of Object.entries(files)) {
    const target = join(dir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
  }
  if (manifest) writeFileSync(join(dir, 'ngsw.json'), JSON.stringify(manifest));
  return dir;
}

const run = (dir) => execFileSync('node', [SCRIPT, dir], { encoding: 'utf8' });
const manifestIn = (dir) =>
  JSON.parse(readFileSync(join(dir, 'ngsw.json'), 'utf8'));

test('removes an entry naming a file the bundle does not contain', () => {
  // The real case: a CSS file emitted for the server bundle, listed in a
  // manifest that ships in the browser bundle.
  const dir = browserDir(
    { 'main-AAA.css': 'real' },
    {
      hashTable: { '/main-AAA.css': 'hash-a', '/chunk-GHOST.css': 'hash-b' },
      assetGroups: [
        { name: 'app', urls: ['/main-AAA.css', '/chunk-GHOST.css'] },
      ],
    }
  );

  const output = run(dir);
  const manifest = manifestIn(dir);

  assert.deepEqual(Object.keys(manifest.hashTable), ['/main-AAA.css']);
  assert.deepEqual(manifest.assetGroups[0].urls, ['/main-AAA.css']);
  // The removal has to be visible, or this going wrong later is invisible too.
  assert.match(output, /chunk-GHOST\.css/);
});

test('leaves a healthy manifest alone', () => {
  const dir = browserDir(
    { 'main-AAA.css': 'real', 'main-BBB.js': 'real' },
    {
      hashTable: { '/main-AAA.css': 'hash-a', '/main-BBB.js': 'hash-b' },
      assetGroups: [{ name: 'app', urls: ['/main-AAA.css', '/main-BBB.js'] }],
    }
  );

  const output = run(dir);

  assert.deepEqual(Object.keys(manifestIn(dir).hashTable), [
    '/main-AAA.css',
    '/main-BBB.js',
  ]);
  assert.match(output, /Nothing pruned/);
});

test('treats a build with no service worker as fine, not as a failure', () => {
  // Development builds emit no manifest. Exiting non-zero there would fail
  // every local build for no reason.
  const output = run(browserDir({ 'main-AAA.css': 'real' }, null));

  assert.match(output, /nothing to do/);
});

test('keeps a nested asset that really is present', () => {
  const dir = browserDir(
    { 'assets/img/logo.svg': '<svg/>' },
    {
      hashTable: { '/assets/img/logo.svg': 'hash-a' },
      assetGroups: [{ name: 'assets', urls: ['/assets/img/logo.svg'] }],
    }
  );

  run(dir);

  assert.deepEqual(Object.keys(manifestIn(dir).hashTable), [
    '/assets/img/logo.svg',
  ]);
});

test('fails loudly on a path that does not exist', () => {
  // A typo in the build step must not read as a clean run.
  assert.throws(() => run('/tmp/definitely-not-a-build-output-dir-xyz'));
});
