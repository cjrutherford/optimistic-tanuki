import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { createComposeBuildPlan } from '../lib/docker-service-planner.mjs';

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function makeComposeFixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'docker-service-planner-')
  );

  writeFile(
    path.join(root, 'docker-compose.yaml'),
    `services:
  postgres:
    image: postgres:17
  authentication:
    build:
      context: .
      dockerfile: ./apps/authentication/Dockerfile
  gateway:
    build:
      context: .
      dockerfile: ./apps/gateway/Dockerfile
    depends_on:
      authentication:
        condition: service_started
  client-interface:
    build:
      context: .
      dockerfile: ./apps/client-interface/Dockerfile
    depends_on:
      gateway:
        condition: service_started
`
  );

  writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', packageManager: 'pnpm@11.0.9' }, null, 2)
  );
  writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  writeFile(path.join(root, 'nx.json'), '{}\n');
  writeFile(
    path.join(root, 'libs/shared/index.ts'),
    'export const shared = 1;\n'
  );

  writeFile(
    path.join(root, 'apps/authentication/Dockerfile'),
    `FROM node:24-alpine
WORKDIR /usr/src/app
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY nx.json ./
COPY libs/ ./libs/
COPY apps/authentication/ ./apps/authentication/
RUN true
`
  );
  writeFile(
    path.join(root, 'apps/authentication/src/main.ts'),
    'export const auth = 1;\n'
  );

  writeFile(
    path.join(root, 'apps/gateway/Dockerfile'),
    `FROM node:24-alpine
WORKDIR /usr/src/app
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY nx.json ./
COPY libs/ ./libs/
COPY apps/gateway/ ./apps/gateway/
RUN true
`
  );
  writeFile(
    path.join(root, 'apps/gateway/src/main.ts'),
    'export const gateway = 1;\n'
  );

  writeFile(
    path.join(root, 'apps/client-interface/Dockerfile'),
    `FROM node:24-alpine
WORKDIR /usr/src/app
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY nx.json ./
COPY apps/client-interface/ ./apps/client-interface/
RUN true
`
  );
  writeFile(
    path.join(root, 'apps/client-interface/src/main.ts'),
    'export const client = 1;\n'
  );

  return root;
}

test('createComposeBuildPlan builds all services on first run, then only changed services plus restart dependents', async () => {
  const workspaceRoot = makeComposeFixture();

  const firstPlan = await createComposeBuildPlan({
    workspaceRoot,
    composeFile: 'docker-compose.yaml',
  });

  assert.deepEqual(firstPlan.buildServices, [
    'authentication',
    'client-interface',
    'gateway',
  ]);
  assert.deepEqual(firstPlan.restartServices, [
    'authentication',
    'client-interface',
    'gateway',
  ]);

  const secondPlan = await createComposeBuildPlan({
    workspaceRoot,
    composeFile: 'docker-compose.yaml',
    previousState: firstPlan.state,
  });

  assert.deepEqual(secondPlan.buildServices, []);
  assert.deepEqual(secondPlan.restartServices, []);

  writeFile(
    path.join(workspaceRoot, 'apps/authentication/src/main.ts'),
    'export const auth = 2;\n'
  );

  const changedPlan = await createComposeBuildPlan({
    workspaceRoot,
    composeFile: 'docker-compose.yaml',
    previousState: firstPlan.state,
  });

  assert.deepEqual(changedPlan.buildServices, ['authentication']);
  assert.deepEqual(changedPlan.restartServices, [
    'authentication',
    'client-interface',
    'gateway',
  ]);
});

test('docker-build-batched.sh defaults to batch size 10', () => {
  const bakeFile = path.join(os.tmpdir(), `docker-bake-${process.pid}.json`);
  fs.writeFileSync(
    bakeFile,
    JSON.stringify({
      target: {
        'db-setup': {},
        authentication: {},
        gateway: {},
      },
    })
  );

  const result = spawnSync(
    'bash',
    ['scripts/docker-build-batched.sh', '--dry-run'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DOCKER_BUILD_BAKE_FILE: bakeFile,
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Batch size: 10/);
});

test('docker-start-phased.sh dry run still executes the full phased startup path without a plan file', () => {
  const result = spawnSync(
    'bash',
    ['scripts/docker-start-phased.sh', '--dry-run', '--full-restart'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Phase 1: Infrastructure/);
  assert.match(result.stdout, /Startup complete/);
});

test('dev-seed.sh does not rely on docker compose run one-off containers', () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'dev-seed.sh');
  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.doesNotMatch(script, /docker compose .*\brun --rm\b/);
});

test('docker:dev stays incremental while docker:dev:bootstrap owns seeding', () => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert.equal(
    packageJson.scripts['docker:dev'],
    './scripts/docker-dev-refresh.sh'
  );
  assert.match(packageJson.scripts['docker:dev:bootstrap'], /docker:dev:seed/);
});

test('dev-seed.sh refreshes videos before seeding it', () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'dev-seed.sh');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const refreshIndex = script.indexOf('refresh_service videos');
  const seedIndex = script.indexOf(
    'run_seed_with_media_volume videos "${APP_RUNTIME_DIR}" node ./dist/apps/videos/seed-videos.js'
  );

  assert.notEqual(
    refreshIndex,
    -1,
    'expected videos to be refreshed before seeding'
  );
  assert.notEqual(seedIndex, -1, 'expected videos seed command to exist');
  assert.ok(
    refreshIndex < seedIndex,
    'expected videos refresh to happen before videos seed'
  );
});

test('prod and generic seed scripts use the business-site seed entrypoint', () => {
  const prodScript = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'prod-seed.sh'),
    'utf8'
  );
  const genericScript = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'run-seed.sh'),
    'utf8'
  );

  assert.match(prodScript, /node \.\/seed-business\.mjs/);
  assert.doesNotMatch(prodScript, /seed-trainer\.mjs/);

  assert.match(genericScript, /node \/app\/seed-business\.mjs/);
  assert.doesNotMatch(genericScript, /business-site.*seed-trainer\.mjs/);
});
