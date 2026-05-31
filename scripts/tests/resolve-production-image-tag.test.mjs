import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);
const resolverPath = path.join(
  repoRoot,
  'scripts',
  'resolve-production-image-tag.sh'
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `Command failed: ${command} ${args.join(' ')}\n${result.stderr}\n${
      result.stdout
    }`
  );
  return result.stdout.trim();
}

function makeGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-tag-resolver-'));
  const remote = path.join(dir, 'remote.git');
  const source = path.join(dir, 'source');
  const deploy = path.join(dir, 'deploy');

  run('git', ['init', '--bare', remote]);
  run('git', ['clone', remote, source]);
  run('git', ['config', 'user.email', 'test@example.com'], { cwd: source });
  run('git', ['config', 'user.name', 'Test User'], { cwd: source });

  fs.writeFileSync(path.join(source, 'app.txt'), 'initial\n');
  run('git', ['add', 'app.txt'], { cwd: source });
  run('git', ['commit', '-m', 'initial'], { cwd: source });
  run('git', ['branch', '-M', 'main'], { cwd: source });
  run('git', ['push', '-u', 'origin', 'main'], { cwd: source });

  run('git', ['clone', remote, deploy]);

  fs.writeFileSync(path.join(source, 'app.txt'), 'promoted\n');
  run('git', ['commit', '-am', 'promoted'], { cwd: source });
  run('git', ['push', 'origin', 'main'], { cwd: source });

  const promotedRevision = run('git', ['rev-parse', 'main'], { cwd: source });
  const staleRevision = run('git', ['rev-parse', 'main'], { cwd: deploy });

  return { deploy, promotedRevision, staleRevision };
}

test('resolve-production-image-tag resolves branch names from the remote-tracking ref before stale local refs', () => {
  const { deploy, promotedRevision, staleRevision } = makeGitFixture();
  assert.notEqual(promotedRevision, staleRevision);

  const result = spawnSync('sh', [resolverPath, deploy, 'main'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), `sha-${promotedRevision.slice(0, 7)}`);
});

test('resolve-production-image-tag preserves explicit PRODUCTION_IMAGE_TAG', () => {
  const { deploy } = makeGitFixture();

  const result = spawnSync('sh', [resolverPath, deploy, 'main'], {
    env: {
      ...process.env,
      PRODUCTION_IMAGE_TAG: 'sha-explicit',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), 'sha-explicit');
});
