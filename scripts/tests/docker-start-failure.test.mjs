import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
test('incremental Compose startup failure is not masked by the conditional function call', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-start-failure-'));
  try {
    fs.writeFileSync(
      path.join(root, 'docker-compose.yaml.plan.json'),
      JSON.stringify({ restartServices: ['gateway'] })
    );
    fs.writeFileSync(
      path.join(root, 'docker'),
      `#!/bin/sh\ncase "$*" in\n*"config --services"*) echo gateway;;\n*"ps --services"*) echo gateway;;\n*"up "*) exit 42;;\n*) exit 0;;\nesac\n`,
      { mode: 0o700 }
    );
    const script = path.resolve('scripts/docker-start-phased.sh');
    const r = spawnSync('bash', [script, 'docker-compose.yaml', '0'], {
      cwd: root,
      env: {
        ...process.env,
        PATH: root + ':' + process.env.PATH,
        DOCKER_BUILD_PLAN_FILE: path.join(
          root,
          'docker-compose.yaml.plan.json'
        ),
        DOCKER_DEV_EXTERNAL_SERVICES: '',
      },
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(r.status, 42, r.stderr);
    assert.ok(!r.stdout.includes('Startup complete'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explicit development scope excludes unrelated restart candidates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-start-scope-'));
  try {
    fs.writeFileSync(
      path.join(root, 'docker-compose.yaml.plan.json'),
      JSON.stringify({ restartServices: ['gateway', 'project-planning'] })
    );
    fs.writeFileSync(
      path.join(root, 'docker'),
      `#!/bin/sh\ncase "$*" in\n*"config --services"*) echo gateway;;\n*"ps --services"*) echo gateway;;\n*"up "*) case "$*" in *project-planning*) exit 99;; *) exit 0;; esac;;\n*) exit 0;;\nesac\n`,
      { mode: 0o700 }
    );
    const r = spawnSync(
      'bash',
      [
        path.resolve('scripts/docker-start-phased.sh'),
        'docker-compose.yaml',
        '0',
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: root + ':' + process.env.PATH,
          DOCKER_BUILD_PLAN_FILE: path.join(
            root,
            'docker-compose.yaml.plan.json'
          ),
          DOCKER_DEV_EXTERNAL_SERVICES: '',
          DOCKER_DEV_SERVICES: 'gateway',
        },
        encoding: 'utf8',
        timeout: 15000,
      }
    );
    assert.equal(r.status, 0, r.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
