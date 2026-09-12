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

test('createComposeBuildPlan respects selected service filters', async () => {
  const workspaceRoot = makeComposeFixture();

  const plan = await createComposeBuildPlan({
    workspaceRoot,
    composeFile: 'docker-compose.yaml',
    selectedServices: ['authentication', 'gateway'],
  });

  assert.deepEqual(plan.buildServices, ['authentication', 'gateway']);
  assert.deepEqual(plan.buildApps, ['authentication', 'gateway']);
  assert.ok(!('client-interface' in plan.services));
});

test('resolve-docker-changes excludes non-buildable compose services from unchanged apps', () => {
  const planFile = path.join(
    os.tmpdir(),
    `docker-plan-resolve-${process.pid}.json`
  );
  const outputFile = path.join(
    os.tmpdir(),
    `docker-plan-resolve-output-${process.pid}.txt`
  );
  fs.writeFileSync(outputFile, '');
  fs.writeFileSync(
    planFile,
    JSON.stringify({
      buildApps: ['authentication'],
      services: {
        authentication: { appId: 'authentication' },
        gateway: { appId: 'gateway' },
        'client-interface': { appId: 'client-interface' },
      },
    })
  );

  const result = spawnSync(
    'sh',
    [
      '-lc',
      `node scripts/resolve-docker-changes.mjs --plan-file "${planFile}" --compose-file docker-compose.yaml`,
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputFile,
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const outputs = fs.readFileSync(outputFile, 'utf8');
  assert.match(outputs, /matrix=\["authentication"\]/);
  assert.match(outputs, /unchanged_apps=\["client-interface","gateway"\]/);
  assert.doesNotMatch(outputs, /postgres/);
  assert.doesNotMatch(outputs, /redis/);
});

test('resolve-docker-changes includes workflow logging for changed and unchanged apps', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts/resolve-docker-changes.mjs'),
    'utf8'
  );

  assert.match(script, /Changed apps:/);
  assert.match(script, /Unchanged apps:/);
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

test('docker-build-batched.sh accepts explicit service filters', () => {
  const bakeFile = path.join(
    os.tmpdir(),
    `docker-bake-services-${process.pid}.json`
  );
  fs.writeFileSync(
    bakeFile,
    JSON.stringify({
      target: {
        authentication: {},
        gateway: {},
        'client-interface': {},
      },
    })
  );

  const result = spawnSync(
    'bash',
    [
      'scripts/docker-build-batched.sh',
      '--dry-run',
      '--service',
      'authentication',
      '--service',
      'gateway',
    ],
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
  assert.match(result.stdout, /Found 2 services to build/);
  assert.match(result.stdout, /authentication/);
  assert.match(result.stdout, /gateway/);
  assert.doesNotMatch(result.stdout, /client-interface/);
});

test('docker-build-batched.sh accepts a Compose profile for profiled UI services', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts/docker-build-batched.sh'),
    'utf8'
  );

  assert.match(script, /--profile\)[\s\S]*COMPOSE_PROFILE="\$2"/);
  assert.match(script, /COMPOSE_FLAGS\+=\(--profile "\$COMPOSE_PROFILE"\)/);
});

test('development startup rebuilds runtime images that were overwritten by production builds', () => {
  const buildScript = fs.readFileSync(
    path.join(repoRoot, 'scripts/docker-build-batched.sh'),
    'utf8'
  );

  assert.match(
    buildScript,
    /com\.optimistic-tanuki\.runtime=development/,
    'expected the build planner to require a development runtime marker'
  );
  assert.match(
    buildScript,
    /dev-runtime-image-mismatch/,
    'expected stale production-tagged images to be rebuilt for development'
  );
});

test('development runtime images carry the marker required by startup validation', () => {
  for (const dockerfile of [
    'docker/dev/node-runtime.Dockerfile',
    'docker/dev/ssr-runtime.Dockerfile',
  ]) {
    const contents = fs.readFileSync(path.join(repoRoot, dockerfile), 'utf8');
    assert.match(contents, /com\.optimistic-tanuki\.runtime=development/);
  }
});

test('app-configurator dev runtime uses a stable workspace cwd and shared dist mount', () => {
  const compose = fs.readFileSync(
    path.join(repoRoot, 'docker-compose.dev.yaml'),
    'utf8'
  );
  const seedScript = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const appConfiguratorBlock = compose.match(
    /\n  app-configurator:\n[\s\S]*?\n  forum:\n/
  );

  assert.notEqual(
    appConfiguratorBlock,
    null,
    'app-configurator dev service block must exist before forum'
  );
  assert.match(
    appConfiguratorBlock[0],
    /      - \.\/dist\/apps:\/usr\/src\/app\/dist\/apps/,
    'app-configurator must mount the shared dist/apps root'
  );
  assert.match(
    appConfiguratorBlock[0],
    /working_dir: \/usr\/src\/app/,
    'app-configurator must use a stable workspace working directory'
  );
  assert.match(
    appConfiguratorBlock[0],
    /        '\/usr\/src\/app\/dist\/apps\/app-configurator',/,
    'app-configurator nodemon must watch its stable shared dist path'
  );
  assert.match(
    appConfiguratorBlock[0],
    /        'node',\n        '-L',\n        'dist\/apps\/app-configurator\/main\.js',/,
    'app-configurator must execute from the shared dist path'
  );
  assert.match(
    seedScript,
    /app-configurator sh -lc '[\s\S]*?\/usr\/src\/app\/dist\/apps\/app-configurator\/seed-script\.js/,
    'dev seed must execute the app-configurator bundle from the stable shared path'
  );
});

test('workspace dev runtime uses a stable workspace cwd and shared dist mount', () => {
  const compose = fs.readFileSync(
    path.join(repoRoot, 'docker-compose.dev.yaml'),
    'utf8'
  );
  const workspaceBlock = compose.match(
    /\n  workspace:\n[\s\S]*?\n  wellness:\n/
  );

  assert.notEqual(
    workspaceBlock,
    null,
    'workspace dev service block must exist before wellness'
  );
  assert.match(
    workspaceBlock[0],
    /      - \.\/dist\/apps:\/usr\/src\/app\/dist\/apps/,
    'workspace must mount the shared dist/apps root'
  );
  assert.match(
    workspaceBlock[0],
    /working_dir: \/usr\/src\/app/,
    'workspace must use a stable working directory'
  );
  assert.match(
    workspaceBlock[0],
    /        '\/usr\/src\/app\/dist\/apps\/workspace',/,
    'workspace nodemon must watch its stable shared dist path'
  );
  assert.match(
    workspaceBlock[0],
    /        'node',\n        '-L',\n        'dist\/apps\/workspace\/main\.js',/,
    'workspace must execute from the shared dist path'
  );
});

test('blogging dev runtime uses a stable workspace cwd and shared dist mount', () => {
  const compose = fs.readFileSync(
    path.join(repoRoot, 'docker-compose.dev.yaml'),
    'utf8'
  );
  const bloggingBlock = compose.match(/\n  blogging:\n[\s\S]*?\n  gateway:\n/);

  assert.notEqual(
    bloggingBlock,
    null,
    'blogging dev service block must exist before gateway'
  );
  assert.match(
    bloggingBlock[0],
    /      - \.\/dist\/apps:\/usr\/src\/app\/dist\/apps/,
    'blogging must mount the shared dist/apps root'
  );
  assert.match(
    bloggingBlock[0],
    /working_dir: \/usr\/src\/app/,
    'blogging must use a stable workspace working directory'
  );
  assert.match(
    bloggingBlock[0],
    /        '\/usr\/src\/app\/dist\/apps\/blogging',/,
    'blogging nodemon must watch its stable shared dist path'
  );
  assert.match(
    bloggingBlock[0],
    /        'node',\n        '-L',\n        'dist\/apps\/blogging\/main\.js',/,
    'blogging must execute from the shared dist path'
  );
});

test('permissions dev runtime uses a stable workspace cwd and shared dist mount', () => {
  const compose = fs.readFileSync(
    path.join(repoRoot, 'docker-compose.dev.yaml'),
    'utf8'
  );
  const permissionsBlock = compose.match(
    /\n  permissions:\n[\s\S]*?\n  store:\n/
  );

  assert.notEqual(
    permissionsBlock,
    null,
    'permissions dev service block must exist before store'
  );
  assert.match(
    permissionsBlock[0],
    /      - \.\/dist\/apps:\/usr\/src\/app\/dist\/apps/,
    'permissions must mount the shared dist/apps root'
  );
  assert.match(
    permissionsBlock[0],
    /working_dir: \/usr\/src\/app/,
    'permissions must use a stable workspace working directory'
  );
  assert.match(
    permissionsBlock[0],
    /        '\/usr\/src\/app\/dist\/apps\/permissions',/,
    'permissions nodemon must watch its stable shared dist path'
  );
  assert.match(
    permissionsBlock[0],
    /        'node',\n        '-L',\n        'dist\/apps\/permissions\/main\.js',/,
    'permissions must execute from the shared dist path'
  );
});

test('dev seed executes the permissions bundle from the stable shared dist path', () => {
  const seedScript = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(
    seedScript,
    /run_seed permissions "\$\{APP_RUNTIME_DIR\}" node \.\/dist\/apps\/permissions\/seed-permissions\.js/
  );
  assert.doesNotMatch(
    seedScript,
    /run_seed permissions "\$\{APP_RUNTIME_DIR\}" node \.\/seed-permissions\.js/
  );
});

test('source-built client dependencies avoid recursive ownership rewrites', () => {
  for (const app of [
    'ai-orchestrator',
    'app-configurator',
    'assets',
    'authentication',
    'blogging',
    'chat-collector',
    'client-interface',
    'forum',
    'gateway',
    'lead-tracker',
    'permissions',
    'profile',
    'project-planning',
    'prompt-proxy',
    'social',
    'store',
    'telos-docs-service',
  ]) {
    const dockerfile = fs.readFileSync(
      path.join(repoRoot, 'apps', app, 'Dockerfile'),
      'utf8'
    );

    assert.doesNotMatch(dockerfile, /RUN chown -R node:node \./, app);
    assert.doesNotMatch(dockerfile, /pnpm add -w/, app);
  }
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

test('docker-start-phased.sh starts missing managed services even when the restart plan is empty', () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'docker-start-phased-missing-service-')
  );
  const dockerLogPath = path.join(tempRoot, 'docker.log');
  const fakeBinDir = path.join(tempRoot, 'bin');
  const planFile = path.join(tempRoot, 'plan.json');

  fs.mkdirSync(fakeBinDir, { recursive: true });
  writeFile(
    path.join(fakeBinDir, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${dockerLogPath}"
if [[ "$*" == *" config --format json" ]]; then
  printf '{"services":{}}\\n'
  exit 0
fi
if [[ "$*" == *" ps --services --filter status=running" ]]; then
  printf 'postgres\\ngateway\\nowner-console\\n'
  exit 0
fi
if [[ "$*" == *" ps" ]]; then
  printf 'NAME STATUS\\n'
  exit 0
fi
exit 0
`
  );
  fs.chmodSync(path.join(fakeBinDir, 'docker'), 0o755);
  fs.writeFileSync(
    planFile,
    JSON.stringify({
      restartServices: [],
    })
  );

  const result = spawnSync(
    'bash',
    ['scripts/docker-start-phased.sh', 'docker-compose.dev.yaml', '0'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DOCKER_BUILD_PLAN_FILE: planFile,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    fs.readFileSync(dockerLogPath, 'utf8'),
    /up -d --no-deps .*business-site/
  );
});

test('docker-start-phased.sh adds missing managed services to an incremental restart', () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'docker-start-phased-incremental-missing-')
  );
  const dockerLogPath = path.join(tempRoot, 'docker.log');
  const fakeBinDir = path.join(tempRoot, 'bin');
  const planFile = path.join(tempRoot, 'plan.json');

  fs.mkdirSync(fakeBinDir, { recursive: true });
  writeFile(
    path.join(fakeBinDir, 'docker'),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "${dockerLogPath}"
if [[ "$*" == *" config --format json" ]]; then
  printf '{"services":{}}\\n'
  exit 0
fi
if [[ "$*" == *" ps --services --filter status=running" ]]; then
  printf 'postgres\\nredis\\nauthentication\\ngateway\\nowner-console\\n'
  exit 0
fi
if [[ "$*" == *" ps" ]]; then
  printf 'NAME STATUS\\n'
  exit 0
fi
exit 0
`
  );
  fs.chmodSync(path.join(fakeBinDir, 'docker'), 0o755);
  fs.writeFileSync(
    planFile,
    JSON.stringify({
      restartServices: ['admin-api'],
    })
  );

  const result = spawnSync(
    'bash',
    ['scripts/docker-start-phased.sh', 'docker-compose.dev.yaml', '0'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DOCKER_BUILD_PLAN_FILE: planFile,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
      },
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    fs.readFileSync(dockerLogPath, 'utf8'),
    /up -d --no-deps .*admin-api.*business-site/
  );
});

test('dev-seed.sh does not rely on docker compose run one-off containers', () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'dev-seed.sh');
  const script = fs.readFileSync(scriptPath, 'utf8');

  assert.doesNotMatch(script, /docker compose .*\brun --rm\b/);
});

test('dev-seed.sh builds a missing Chat Collector runtime before refreshing it', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  const runtimeCheckIndex = script.indexOf(
    'ensure_development_runtime chat-collector ./dist/apps/chat-collector/main.js'
  );
  const refreshIndex = script.indexOf(
    'refresh_services store authentication profile social payments assets chat-collector classifieds'
  );

  assert.notEqual(
    runtimeCheckIndex,
    -1,
    'expected Chat Collector runtime to be ensured before service refresh'
  );
  assert.ok(
    runtimeCheckIndex < refreshIndex,
    'expected Chat Collector runtime to be available before refresh'
  );
});

test('dev-seed.sh provisions an idempotent documented local owner account', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(script, /DEV_OWNER_EMAIL:-owner@optimistic-tanuki\.local/);
  assert.match(script, /DEV_OWNER_PASSWORD:-DevOwner!123/);
  assert.match(script, /x-ot-appscope: owner-console/);
  assert.match(script, /Owner Console registration is closed/);
});

test('dev-seed.sh provisions owned and foreign app fixtures through the APIs', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  const ownerAuthIndex = script.indexOf('authenticate_seed_identity owner');
  const workspaceLookupIndex = script.indexOf(
    'provision_business_workspace owner'
  );
  const ownerAppSeedIndex = script.indexOf('seed_app_configuration owner');
  const foreignRegistrationIndex = script.indexOf(
    'register_seed_identity foreign "${foreign_email}" "${foreign_password}" business-site true'
  );
  const foreignAuthIndex = script.indexOf(
    'authenticate_seed_identity foreign "${foreign_email}" "${foreign_password}"'
  );
  const foreignWorkspaceIndex = script.indexOf(
    'provision_business_workspace foreign'
  );
  const foreignAppSeedIndex = script.indexOf('seed_app_configuration foreign');

  assert.ok(ownerAuthIndex >= 0, 'expected owner session authentication');
  assert.ok(
    workspaceLookupIndex > ownerAuthIndex,
    'expected owned workspace lookup/provision after owner authentication'
  );
  assert.ok(
    ownerAppSeedIndex > workspaceLookupIndex,
    'expected owned app fixture after workspace lookup/provision'
  );
  assert.ok(
    foreignRegistrationIndex > ownerAppSeedIndex,
    'expected foreign identity registration after owned fixture'
  );
  assert.ok(
    foreignAuthIndex > foreignRegistrationIndex,
    'expected foreign identity authentication after registration'
  );
  assert.ok(
    foreignWorkspaceIndex > foreignAuthIndex,
    'expected foreign workspace lookup/provision after foreign authentication'
  );
  assert.ok(
    foreignAppSeedIndex > foreignWorkspaceIndex,
    'expected foreign app fixture after foreign workspace lookup/provision'
  );

  assert.match(script, /authentication\/session/);
  assert.match(script, /workspaces\/business-sites\/provision/);
  assert.match(script, /APP_CONFIG_SEED_OWNER_USER_ID/);
  assert.match(script, /APP_CONFIG_SEED_APP_INSTANCE_ID/);
  assert.match(script, /node \.\/seed-script\.js/);
  const fixtureBlock = script.slice(
    script.indexOf('register_seed_identity()'),
    script.indexOf('wait_for_chat_collector()')
  );
  assert.doesNotMatch(
    fixtureBlock,
    /(?:INSERT\s+INTO|UPDATE\s+[^\n]+\s+SET|psql\b)/i
  );
});

test('dev-seed.sh provisions a distinct configurable-client owner fixture after business-site owner setup', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const businessOwner = script.indexOf('verify_seed_configuration owner');
  const configurableEmail = script.indexOf(
    'CONFIGURABLE_CLIENT_OWNER_EMAIL:-configurable-client-owner-v2@optimistic-tanuki.local'
  );
  const configurablePassword = script.indexOf(
    'CONFIGURABLE_CLIENT_OWNER_PASSWORD:-DevConfigurableClient!123'
  );
  const configurableRegistration = script.indexOf(
    'register_configurable_client_identity configurable-client-owner'
  );
  const configurableAuth = script.indexOf(
    'register_configurable_client_identity configurable-client-owner'
  );
  const configurableWorkspace = script.indexOf(
    'provision_business_workspace owner-configurable-client'
  );
  const configurableSeed = script.indexOf(
    'seed_app_configuration owner-configurable-client'
  );
  const configurableVerify = script.indexOf(
    'verify_seed_configuration owner-configurable-client'
  );
  const foreignAuth = script.indexOf(
    'register_seed_identity foreign "${foreign_email}" "${foreign_password}" business-site true'
  );

  assert.ok(
    businessOwner >= 0,
    'expected the existing business-site owner fixture'
  );
  assert.ok(configurableEmail > businessOwner);
  assert.ok(configurablePassword > configurableEmail);
  assert.ok(configurableRegistration > configurablePassword);
  assert.equal(
    configurableAuth,
    configurableRegistration,
    'expected the configurable-client identity flow to have one entry point'
  );
  assert.ok(configurableAuth > businessOwner);
  assert.ok(configurableWorkspace > configurableAuth);
  assert.ok(configurableSeed > configurableWorkspace);
  assert.ok(configurableVerify > configurableSeed);
  assert.ok(foreignAuth > configurableVerify);

  const configurableBlock = script.slice(configurableAuth, foreignAuth);
  assert.match(configurableBlock, /configurable-client/);
  assert.match(
    script,
    /register_configurable_client_identity configurable-client-owner[\s\S]*configurable-client/
  );
  assert.doesNotMatch(
    configurableBlock,
    /\"\$\{owner_(?:email|password)\}/,
    'expected the configurable-client fixture not to reuse standard owner credentials'
  );
  assert.match(configurableBlock, /CONFIGURABLE_CLIENT_USER_ID/);
  assert.match(configurableBlock, /CONFIGURABLE_CLIENT_PROFILE_ID/);
  assert.match(configurableBlock, /CONFIGURABLE_CLIENT_WORKSPACE_ID/);
  assert.match(
    configurableBlock,
    /scoped_fixture_id app-instance configurable-client "\$\{CONFIGURABLE_CLIENT_WORKSPACE_ID\}"/
  );
  assert.match(
    configurableBlock,
    /scoped_fixture_id membership configurable-client "\$\{CONFIGURABLE_CLIENT_WORKSPACE_ID\}"/
  );
  assert.doesNotMatch(
    configurableBlock,
    /c5555555-5555-4555-8555-555555555555|c6666666-6666-4666-8666-666666666666/,
    'expected configurable-client fixture IDs to be derived from its workspace and scope'
  );
  assert.doesNotMatch(
    configurableBlock,
    /a5555555-5555-4555-8555-555555555555/
  );
  assert.doesNotMatch(
    configurableBlock,
    /b5555555-5555-4555-8555-555555555555/
  );
});

test('dev-seed.sh cleans only obsolete P11 configs from the original configurable-client workspace before isolated provisioning', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const cleanupStart = script.indexOf('cleanup_legacy_p11_configurations()');
  const cleanupEnd = script.indexOf(
    '\nbuild_app_configurator_runtime()',
    cleanupStart
  );
  const cleanup = script.slice(cleanupStart, cleanupEnd);
  const ownerVerify = script.indexOf(
    'verify_seed_configuration owner-configurable-client'
  );
  const cleanupCall = script.indexOf(
    'cleanup_legacy_p11_configurations "${CONFIGURABLE_CLIENT_COOKIE}"'
  );
  const firstP11Provision = script.indexOf(
    'register_configurable_client_identity p11-joinable-owner'
  );

  assert.ok(
    cleanupStart >= 0,
    'expected a dedicated legacy P11 cleanup helper'
  );
  assert.ok(
    cleanupEnd > cleanupStart,
    'expected the cleanup helper to be bounded'
  );
  assert.match(cleanup, /p11-joinable/);
  assert.match(cleanup, /p11-request-only/);
  assert.match(cleanup, /p11-private/);
  assert.match(cleanup, /app-config\/by-name/);
  assert.match(cleanup, /-X DELETE/);
  assert.match(cleanup, /x-ot-appscope: \$\{app_scope\}/);
  assert.match(cleanup, /x-ot-app-id: \$\{app_scope\}/);
  assert.match(cleanup, /workspaceSlug=\$\{encoded_workspace_slug\}/);
  assert.match(cleanup, /404\)/);
  assert.doesNotMatch(cleanup, /demo-app/);
  assert.ok(
    ownerVerify >= 0,
    'expected the configurable-client owner fixture verification'
  );
  assert.ok(
    cleanupCall > ownerVerify,
    'expected cleanup after original owner setup'
  );
  assert.ok(
    firstP11Provision > cleanupCall,
    'expected cleanup before isolated P11 provisioning'
  );
});

test('dev-seed.sh remains valid POSIX shell', () => {
  const result = spawnSync(
    'sh',
    ['-n', path.join(repoRoot, 'scripts', 'dev-seed.sh')],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('dev-seed.sh legacy P11 cleanup is idempotent and fails on unexpected Gateway statuses', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const helperStart = script.indexOf('json_field()');
  const helperEnd = script.indexOf(
    '\nbuild_app_configurator_runtime()',
    helperStart
  );
  const helper = script.slice(helperStart, helperEnd);
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dev-seed-cleanup-')
  );
  const curlPath = path.join(fixtureRoot, 'curl');
  const logPath = path.join(fixtureRoot, 'curl.log');

  fs.writeFileSync(
    curlPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const methodIndex = args.indexOf('-X');
const method = methodIndex >= 0 ? args[methodIndex + 1] : 'GET';
const url = args.at(-1);
fs.appendFileSync(process.env.CURL_LOG, JSON.stringify({ method, url, args }) + '\\n');
if (process.env.CURL_MODE === 'error') {
  process.stdout.write('gateway unavailable\\n503');
  process.exit(0);
}
if (process.env.CURL_MODE === 'absent') {
  process.stdout.write('missing\\n404');
  process.exit(0);
}
if (method === 'DELETE') {
  if (process.env.CURL_MODE === 'delete-absent') {
    process.stdout.write('already gone\\n404');
    process.exit(0);
  }
  process.stdout.write('deleted\\n204');
  process.exit(0);
}
const encodedName = url.match(/\\/by-name\\/([^?]+)/)?.[1];
const name = decodeURIComponent(encodedName || '');
process.stdout.write(JSON.stringify({ id: 'config-' + name, name, appScope: 'configurable-client' }));
process.stdout.write('\\n200');
`,
    { mode: 0o755 }
  );

  const runCleanup = (mode) =>
    spawnSync(
      'bash',
      [
        '-c',
        `${helper}
cleanup_legacy_p11_configurations cookie owner-configurable-client configurable-client
`,
      ],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PATH: `${fixtureRoot}:${process.env.PATH}`,
          CURL_LOG: logPath,
          CURL_MODE: mode,
          HOST_GATEWAY_BASE_URL: 'http://gateway.test',
        },
        encoding: 'utf8',
      }
    );

  const removed = runCleanup('present');
  assert.equal(removed.status, 0, removed.stderr || removed.stdout);
  const requests = fs
    .readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(requests.length, 6);
  assert.deepEqual(
    requests.map(({ method, url }) => [method, url]),
    [
      [
        'GET',
        'http://gateway.test/api/app-config/by-name/p11-joinable?workspaceSlug=owner-configurable-client',
      ],
      [
        'DELETE',
        'http://gateway.test/api/app-config/config-p11-joinable?workspaceSlug=owner-configurable-client',
      ],
      [
        'GET',
        'http://gateway.test/api/app-config/by-name/p11-request-only?workspaceSlug=owner-configurable-client',
      ],
      [
        'DELETE',
        'http://gateway.test/api/app-config/config-p11-request-only?workspaceSlug=owner-configurable-client',
      ],
      [
        'GET',
        'http://gateway.test/api/app-config/by-name/p11-private?workspaceSlug=owner-configurable-client',
      ],
      [
        'DELETE',
        'http://gateway.test/api/app-config/config-p11-private?workspaceSlug=owner-configurable-client',
      ],
    ]
  );
  assert.ok(
    requests.every(({ args }) =>
      args.includes('x-ot-appscope: configurable-client')
    )
  );
  assert.ok(
    requests.every(({ args }) =>
      args.includes('x-ot-app-id: configurable-client')
    )
  );

  fs.writeFileSync(logPath, '');
  const deleteAbsent = runCleanup('delete-absent');
  assert.equal(
    deleteAbsent.status,
    0,
    deleteAbsent.stderr || deleteAbsent.stdout
  );
  assert.equal(fs.readFileSync(logPath, 'utf8').trim().split('\n').length, 6);

  fs.writeFileSync(logPath, '');
  const absent = runCleanup('absent');
  assert.equal(absent.status, 0, absent.stderr || absent.stdout);
  assert.equal(fs.readFileSync(logPath, 'utf8').trim().split('\n').length, 3);

  fs.writeFileSync(logPath, '');
  const failed = runCleanup('error');
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /HTTP 503/);
  assert.equal(fs.readFileSync(logPath, 'utf8').trim().split('\n').length, 1);
});

test('dev-seed.sh creates the configurable-client Blog catalog before seeding its publishable app', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const catalogFunction = script.indexOf(
    'seed_configurable_client_blog_catalog()'
  );
  const configurableSeed = script.indexOf(
    'seed_app_configuration owner-configurable-client'
  );
  const catalogCall = script.indexOf(
    'seed_configurable_client_blog_catalog owner-configurable-client'
  );

  assert.ok(
    catalogFunction >= 0,
    'expected an idempotent configurable-client Blog catalog seeder'
  );
  assert.ok(
    catalogCall > 0,
    'expected the configurable-client fixture to seed a Blog catalog'
  );
  assert.ok(
    catalogCall < configurableSeed,
    'expected the Blog catalog before app configuration'
  );
  const seedBlock = script.slice(
    catalogCall,
    script.indexOf('verify_seed_configuration owner-configurable-client')
  );
  assert.match(seedBlock, /CONFIGURABLE_CLIENT_BLOG_CATALOG_ID/);
  const appSeedFunction = script.slice(
    script.indexOf('seed_app_configuration()'),
    script.indexOf('verify_seed_configuration()')
  );
  assert.match(appSeedFunction, /APP_CONFIG_SEED_BLOG_CATALOG_ID/);
  assert.match(
    catalogFunction >= 0
      ? script.slice(
          catalogFunction,
          script.indexOf('seed_app_configuration()', catalogFunction)
        )
      : '',
    /api\/blog\/catalogs\/mine/
  );
  assert.match(
    catalogFunction >= 0
      ? script.slice(
          catalogFunction,
          script.indexOf('seed_app_configuration()', catalogFunction)
        )
      : '',
    /api\/blog\/catalogs/
  );
});

test('dev-seed.sh creates an idempotent published configurable-client Blog post in the selected catalog', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const postFunction = script.indexOf('seed_configurable_client_blog_post()');
  const catalogCall = script.indexOf(
    'seed_configurable_client_blog_catalog owner-configurable-client'
  );
  const postCall = script.indexOf(
    'seed_configurable_client_blog_post owner-configurable-client'
  );
  const configurableSeed = script.indexOf(
    'seed_app_configuration owner-configurable-client'
  );

  assert.ok(
    postFunction >= 0,
    'expected an idempotent configurable-client Blog post seeder'
  );
  assert.ok(postCall > catalogCall, 'expected the Blog post after its catalog');
  assert.ok(
    postCall < configurableSeed,
    'expected the Blog post before publishing its app configuration'
  );

  const postBlock = script.slice(
    postFunction,
    script.indexOf('seed_app_configuration()', postFunction)
  );
  assert.match(postBlock, /api\/post\/published\?catalogId=/);
  assert.match(postBlock, /api\/post\?workspaceSlug=/);
  assert.match(postBlock, /selectedCatalogId/);
  assert.match(postBlock, /isDraft: false/);
  assert.match(
    script.slice(postCall, configurableSeed),
    /CONFIGURABLE_CLIENT_BLOG_CATALOG_ID/
  );
});

test('dev-seed.sh never prints the configurable-client fixture password', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const configurableBlock = script.slice(
    script.indexOf('CONFIGURABLE_CLIENT_OWNER_EMAIL'),
    script.indexOf('foreign_email=')
  );

  assert.match(configurableBlock, /CONFIGURABLE_CLIENT_OWNER_PASSWORD/);
  assert.doesNotMatch(
    configurableBlock,
    /echo[^\n]*(?:PASSWORD|password)|printf[^\n]*(?:PASSWORD|password)/,
    'expected the disposable password to stay out of seed output'
  );
  assert.doesNotMatch(
    configurableBlock,
    /DevConfigurableClient!123[^\n]*(?:echo|printf)/,
    'expected the password value not to be printed'
  );
});

test('dev-seed.sh reuses an existing configurable-client identity through login first', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const configurableFunction = script.slice(
    script.indexOf('register_configurable_client_identity()'),
    script.indexOf('provision_business_workspace()')
  );

  assert.match(configurableFunction, /attempt_seed_identity_login/);
  assert.match(
    configurableFunction,
    /case \"\$SEED_LOGIN_STATUS\" in[\s\S]*401\|404\|5\*/
  );
  assert.match(
    configurableFunction,
    /register_seed_identity \"\$identity_label\"/
  );
  assert.match(
    configurableFunction,
    /authenticate_seed_identity \"\$identity_label\"/
  );
  assert.ok(
    configurableFunction.indexOf('attempt_seed_identity_login') <
      configurableFunction.indexOf('register_seed_identity'),
    'expected login to be attempted before registration'
  );
  assert.doesNotMatch(configurableFunction, /400\|409/);
  assert.doesNotMatch(
    configurableFunction,
    /is_existing_identity_registration_error/
  );
  assert.doesNotMatch(
    configurableFunction,
    /echo[^\n]*(?:identity_password|identity_login_body|registration_body)/,
    'expected diagnostics not to print credentials or raw auth bodies'
  );
  assert.doesNotMatch(
    configurableFunction,
    /(?:echo|printf)[^\n]*identity_payload/,
    'expected registration diagnostics not to print the request payload'
  );
});

test('dev-seed.sh registers the foreign fixture before authenticating it', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const foreignStart = script.indexOf('foreign_email=');
  const foreignEnd = script.indexOf(
    'run_optional_seeders post-core',
    foreignStart
  );
  const foreignBlock = script.slice(foreignStart, foreignEnd);
  const foreignRegister = foreignBlock.indexOf(
    'register_seed_identity foreign "${foreign_email}" "${foreign_password}" business-site true'
  );
  const foreignAuth = foreignBlock.indexOf(
    'authenticate_seed_identity foreign "${foreign_email}" "${foreign_password}"'
  );
  const ownerStart = script.indexOf('authenticate_seed_identity owner');
  const ownerEnd = script.indexOf('CONFIGURABLE_CLIENT_COOKIE=', ownerStart);
  const ownerBlock = script.slice(ownerStart, ownerEnd);
  const configurableStart = script.indexOf('CONFIGURABLE_CLIENT_COOKIE=');
  const configurableEnd = script.indexOf('foreign_email=', configurableStart);
  const configurableBlock = script.slice(configurableStart, configurableEnd);

  assert.ok(
    foreignRegister >= 0,
    'expected foreign fixture registration with existing-identity allowance'
  );
  assert.match(
    foreignBlock,
    /register_seed_identity foreign[\s\S]*authenticate_seed_identity foreign[\s\S]*provision_business_workspace foreign/
  );
  assert.ok(
    foreignAuth > foreignRegister,
    'expected foreign authentication after registration'
  );
  assert.ok(
    ownerBlock.includes('authenticate_seed_identity owner') &&
      !ownerBlock.includes('register_seed_identity owner'),
    'expected the owner flow to retain its existing bootstrap authentication'
  );
  assert.match(
    configurableBlock,
    /register_configurable_client_identity configurable-client-owner/,
    'expected configurable-client flow to retain its dedicated identity helper'
  );
  assert.doesNotMatch(
    configurableBlock,
    /register_seed_identity configurable-client-owner/
  );
});

test('dev-seed.sh only treats an explicit missing-user login 5xx as a registration fallback', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const helperStart = script.indexOf('is_missing_identity_login_response()');
  const helperEnd = script.indexOf(
    '\nattempt_seed_identity_login()',
    helperStart
  );

  assert.ok(helperStart >= 0, 'expected a missing-identity login classifier');
  assert.ok(helperEnd > helperStart, 'expected the classifier to be complete');

  const helper = script.slice(helperStart, helperEnd);
  const probe = spawnSync(
    'bash',
    [
      '-c',
      `${helper}
is_missing_identity_login_response 401 '{"message":"anything"}'
is_missing_identity_login_response 500 '{"message":"User not found"}'
if ! is_missing_identity_login_response 500 '{"statusCode":500,"message":"Login failed: User not found"}'; then
  exit 5
fi
is_missing_identity_login_response 500 '{"error":{"message":"Identity missing"}}'
if is_missing_identity_login_response 500 '{"message":"database unavailable"}'; then
  exit 3
fi
if is_missing_identity_login_response 500 '{"message":"User credentials are invalid"}'; then
  exit 4
fi
`,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(
    probe.status,
    0,
    `expected only explicit missing-user responses to be classified as fallback: ${probe.stderr}`
  );

  const attemptFunction = script.slice(
    script.indexOf('attempt_seed_identity_login()'),
    script.indexOf('register_configurable_client_identity()')
  );
  assert.match(
    attemptFunction,
    /is_missing_identity_login_response "\$identity_login_status" "\$identity_login_body"/
  );
  assert.match(attemptFunction, /5\*\)[\s\S]*SEED_LOGIN_MISSING_IDENTITY=true/);
});

test('dev-seed.sh accepts a gateway 500 only when registration explicitly reports an existing identity', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const helperStart = script.indexOf(
    'is_existing_identity_registration_error()'
  );
  const helperEnd = script.indexOf('\nregister_seed_identity()', helperStart);
  const helper = script.slice(helperStart, helperEnd);
  const probe = spawnSync(
    'sh',
    [
      '-c',
      `${helper}
if ! is_existing_identity_registration_error 500 '{"message":"Registration failed: User already exists"}'; then
  exit 2
fi
if is_existing_identity_registration_error 500 '{"message":"database unavailable"}'; then
  exit 3
fi
`,
    ],
    { encoding: 'utf8' }
  );

  assert.equal(
    probe.status,
    0,
    `expected only an explicit existing-user 500 to be idempotent: ${probe.stderr}`
  );

  const registerFunction = script.slice(
    script.indexOf('register_seed_identity()'),
    script.indexOf('authenticate_seed_identity()')
  );
  assert.match(registerFunction, /400\|409\|500\)/);
});

test('dev-seed.sh reprovisions an existing configurable-client workspace for owner backfill', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const workspaceFunction = script.slice(
    script.indexOf('provision_business_workspace()'),
    script.indexOf('demo_app_configuration_payload()')
  );

  assert.match(
    script,
    /provision_business_workspace owner-configurable-client "\$\{CONFIGURABLE_CLIENT_PROFILE_ID\}" \\\n+  "\$\{CONFIGURABLE_CLIENT_COOKIE\}" configurable-client true/,
    'expected configurable-client to force the idempotent provision endpoint'
  );
  assert.match(
    workspaceFunction,
    /always_provision="\$\{5:-false\}"/,
    'expected the workspace planner to expose an explicit reprovision mode'
  );
  assert.match(
    workspaceFunction,
    /if \[ "\$\{always_provision\}" != "true" \]; then[\s\S]*workspace_lookup[\s\S]*fi[\s\S]*workspace_response=/,
    'expected existing-workspace discovery to be bypassed before authoritative provisioning'
  );
  assert.match(
    workspaceFunction,
    /json_field "\$workspace_body" workspace\.workspaceId/,
    'expected the provision response to remain authoritative for the workspace ID'
  );
});

test('dev-seed.sh only uses registration fallback for explicit configurable-client auth misses', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const configurableFunction = script.slice(
    script.indexOf('register_configurable_client_identity()'),
    script.indexOf('provision_business_workspace()')
  );

  assert.match(configurableFunction, /401\|404\|5\*/);
  assert.match(
    configurableFunction,
    /Unable to authenticate \$\{identity_label\} fixture identity: HTTP/
  );
  assert.match(
    script.slice(
      script.indexOf('register_seed_identity()'),
      script.indexOf('authenticate_seed_identity()')
    ),
    /201\) ;;/
  );
  assert.doesNotMatch(configurableFunction, /configurable-client true/);
  assert.doesNotMatch(configurableFunction, /registration_body/);
});

test('dev-seed.sh parameterizes app fixture scope without changing business-site defaults', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const workspaceFunction = script.slice(
    script.indexOf('provision_business_workspace()'),
    script.indexOf('demo_app_configuration_payload()')
  );
  const appFunction = script.slice(
    script.indexOf('seed_app_configuration()'),
    script.indexOf('verify_seed_configuration()')
  );
  const verifyFunction = script.slice(
    script.indexOf('verify_seed_configuration()'),
    script.indexOf('build_app_configurator_runtime()')
  );

  assert.match(
    workspaceFunction,
    /identity_app_scope="\$\{4:-business-site\}"/
  );
  assert.match(appFunction, /app_scope="\$\{9:-business-site\}"/);
  assert.match(appFunction, /APP_CONFIG_SEED_APP_SCOPE=\$\{app_scope\}/);
  assert.match(verifyFunction, /app_scope="\$\{4:-business-site\}"/);
  assert.match(
    script,
    /provision_business_workspace owner "\$\{OWNER_PROFILE_ID\}" "\$\{OWNER_COOKIE\}"/
  );
  assert.match(
    script,
    /APP_CONFIG_SEED_APP_INSTANCE_ID:-\$\(scoped_fixture_id app-instance business-site "\$\{OWNER_WORKSPACE_ID\}"\)/
  );
  assert.match(
    script,
    /APP_CONFIG_SEED_FOREIGN_APP_INSTANCE_ID:-\$\(scoped_fixture_id app-instance business-site "\$\{FOREIGN_WORKSPACE_ID\}"\)/
  );
});

test('dev-seed.sh only reuses a workspace when its app scope matches', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const workspaceFunction = script.slice(
    script.indexOf('provision_business_workspace()'),
    script.indexOf('demo_app_configuration_payload()')
  );

  assert.match(
    workspaceFunction,
    /entry\?\.appScope === appScope/,
    'expected workspace reuse to inspect appScope'
  );
  assert.match(
    workspaceFunction,
    /expected_slug="owner-\$\{identity_app_scope\}-\$\{identity_profile_id\}"/,
    'expected non-business scopes to use a scope-derived identity'
  );
  assert.match(
    workspaceFunction,
    /JSON\.stringify\(\{ appScope, slug, displayName \}\)/,
    'expected workspace creation to send appScope explicitly'
  );
});

test('dev-seed.sh runs the idempotent app-configurator runtime before Gateway lookup', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const seedFunction = script.slice(
    script.indexOf('seed_app_configuration()'),
    script.indexOf('verify_seed_configuration()')
  );

  assert.match(
    seedFunction,
    /app-config\/by-name\/demo-app/,
    'expected lookup by stable demo-app name'
  );
  const runtimeIndex = seedFunction.indexOf(
    'node /usr/src/app/dist/apps/app-configurator/seed-script.js'
  );
  const lookupIndex = seedFunction.indexOf('app-config/by-name/demo-app');

  assert.ok(runtimeIndex >= 0, 'expected the idempotent seed runtime');
  assert.ok(lookupIndex >= 0, 'expected the stable-key Gateway lookup');
  assert.ok(
    runtimeIndex < lookupIndex,
    'expected app instance, membership, and configuration reconciliation before Gateway lookup'
  );
  assert.match(
    seedFunction,
    /configuration_lookup[\s\S]*curl[\s\S]*configuration_url/,
    'expected a supported Gateway lookup request after runtime reconciliation'
  );
  assert.match(
    seedFunction,
    /configuration_lookup_status[\s\S]*-X PUT[\s\S]*app-config\//,
    'expected existing configurations to use the supported update endpoint'
  );
  assert.match(
    script,
    /expectedRevision/,
    'expected updates to use optimistic concurrency'
  );
});

test('dev-seed.sh does not issue a duplicate create after runtime reconciliation', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const seedFunction = script.slice(
    script.indexOf('seed_app_configuration()'),
    script.indexOf('verify_seed_configuration()')
  );
  const runtimeCalls =
    seedFunction.match(
      /node \/usr\/src\/app\/dist\/apps\/app-configurator\/seed-script\.js/g
    ) || [];
  const lookupIndex = seedFunction.indexOf('app-config/by-name/demo-app');
  const runtimeIndex = seedFunction.indexOf(
    'node /usr/src/app/dist/apps/app-configurator/seed-script.js'
  );
  const updateIndex = seedFunction.indexOf('-X PUT');

  assert.ok(
    lookupIndex >= 0,
    'expected the stable-key lookup in the seed function'
  );
  assert.equal(
    runtimeCalls.length,
    1,
    'expected exactly one idempotent runtime invocation per fixture seed'
  );
  assert.ok(
    runtimeIndex < lookupIndex,
    'expected runtime reconciliation before lookup'
  );
  assert.ok(updateIndex > lookupIndex, 'expected update after the lookup');
  assert.doesNotMatch(
    seedFunction,
    /404\)[\s\S]*node \.\/seed-script\.js/,
    'expected no duplicate runtime create branch after Gateway lookup'
  );
  assert.match(
    seedFunction,
    /Unable to look up \$\{identity_label\} demo configuration:/,
    'expected a post-runtime lookup failure to stop instead of creating again'
  );
});

test('dev-seed.sh supports an opt-in live-stack seed mode without Compose refreshes', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(script, /DEV_SEED_SKIP_REFRESH:-false/);
  assert.match(
    script,
    /if \[ "\$\{DEV_SEED_SKIP_REFRESH\}" = "true" \]; then[\s\S]*Skipping Compose refresh/
  );
  assert.match(
    script,
    /refresh_service\(\)[\s\S]*DEV_SEED_SKIP_REFRESH[\s\S]*docker compose[\s\S]*up -d/
  );
  assert.match(
    script,
    /refresh_services\(\)[\s\S]*DEV_SEED_SKIP_REFRESH[\s\S]*docker compose[\s\S]*up -d/
  );
});

test('dev-seed.sh preserves a healthy gateway and builds its dev runtime before replacement', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(
    script,
    /refresh_gateway_safely\(\)[\s\S]*docker inspect[\s\S]*healthy[\s\S]*Skipping gateway refresh/
  );
  assert.match(
    script,
    /refresh_gateway_safely\(\)[\s\S]*docker compose \$\{COMPOSE_FILES\} up -d --build --force-recreate/
  );
  assert.match(
    script,
    /refresh_gateway_safely\n(?=[\s\S]*build_app_configurator_runtime)/
  );
  assert.doesNotMatch(
    script,
    /\nrefresh_service gateway\n/,
    'expected the gateway to use the health-aware refresh path'
  );
});

test('dev-seed.sh waits for authentication and profile health before owner provisioning', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  const refreshIndex = script.indexOf(
    'refresh_services store authentication profile social payments assets chat-collector classifieds'
  );
  const authReadyIndex = script.indexOf(
    'wait_for_tcp_service authentication 3001'
  );
  const profileReadyIndex = script.indexOf('wait_for_tcp_service profile 3002');
  const ownerIndex = script.indexOf('\nseed_default_owner\n', authReadyIndex);

  assert.ok(refreshIndex >= 0, 'expected the required service refresh');
  assert.ok(
    authReadyIndex > refreshIndex,
    'expected auth readiness after refresh'
  );
  assert.ok(
    profileReadyIndex > authReadyIndex,
    'expected profile readiness after authentication readiness'
  );
  assert.ok(
    ownerIndex > profileReadyIndex,
    'expected owner provisioning after both dependencies'
  );
  const readinessFunction = script.slice(
    script.indexOf('wait_for_tcp_service()'),
    script.indexOf('seed_default_owner()')
  );
  assert.match(readinessFunction, /require\("node:net"\)/);
  assert.match(readinessFunction, /createConnection\([\s\S]*TCP_SERVICE_HOST/);
  assert.match(readinessFunction, /exec -T[\s\S]*app-configurator node -e/);
  assert.match(readinessFunction, /setTimeout\(5000\)/);
  assert.doesNotMatch(
    readinessFunction,
    /health-check|ClientProxyFactory|firstValueFrom/,
    'expected a raw TCP readiness probe rather than a Nest message'
  );
  assert.doesNotMatch(
    script,
    /wait_for_gateway\nseed_default_owner\nsleep 15/,
    'expected fixed owner-provisioning sleep to be replaced by readiness checks'
  );
});

test('dev-seed.sh waits for all refreshed TCP services before restarting the gateway', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  const dependencyRefreshIndex = script.indexOf(
    'refresh_services store authentication profile social payments assets chat-collector classifieds'
  );
  const appConfiguratorReadyIndex = script.indexOf(
    '\nwait_for_tcp_service app-configurator 3014 app-configurator\n'
  );
  const authReadyIndex = script.indexOf(
    '\nwait_for_tcp_service authentication 3001 authentication\n'
  );
  const profileReadyIndex = script.indexOf(
    '\nwait_for_tcp_service profile 3002 profile\n'
  );
  const gatewayRestartIndex = script.indexOf(
    '\nrestart_gateway_after_dependencies\n'
  );
  const gatewayWaitIndex = script.indexOf(
    '\nwait_for_gateway\n',
    gatewayRestartIndex
  );
  const restartFunction = script.slice(
    script.indexOf('restart_gateway_after_dependencies()'),
    script.indexOf('refresh_app_configurator_safely()')
  );

  assert.ok(
    appConfiguratorReadyIndex > dependencyRefreshIndex,
    'expected app-configurator TCP readiness after dependency refresh'
  );
  assert.ok(
    authReadyIndex > appConfiguratorReadyIndex,
    'expected authentication TCP readiness after app-configurator'
  );
  assert.ok(
    profileReadyIndex > authReadyIndex,
    'expected profile TCP readiness after authentication'
  );
  assert.ok(
    gatewayRestartIndex > profileReadyIndex,
    'expected the gateway restart after all dependency TCP readiness checks'
  );
  assert.ok(
    gatewayWaitIndex > gatewayRestartIndex,
    'expected gateway readiness only after the restart'
  );
  assert.match(restartFunction, /DEV_SEED_SKIP_REFRESH/);
  assert.match(restartFunction, /Skipping gateway restart/);
  assert.match(
    restartFunction,
    /docker compose \$\{COMPOSE_FILES\} restart gateway/
  );
  assert.doesNotMatch(
    restartFunction,
    /up -d|force-recreate|--build/,
    'expected a restart without rebuild or recreation'
  );
});

test('dev-seed.sh preserves a running app-configurator and builds its dev runtime before replacement', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  const bundleIndex = script.indexOf('build_app_configurator_runtime');
  const refreshIndex = script.indexOf('\nrefresh_app_configurator_safely\n');
  const refreshFunction = script.slice(
    script.indexOf('refresh_app_configurator_safely()'),
    script.indexOf('ensure_development_runtime()')
  );

  assert.ok(
    refreshIndex > bundleIndex,
    'expected the seed bundle to be available before app-configurator refresh'
  );
  assert.match(refreshFunction, /docker inspect[\s\S]*State\.Status/);
  assert.match(
    refreshFunction,
    /running[\s\S]*Skipping app-configurator refresh/
  );
  assert.match(
    refreshFunction,
    /docker compose \$\{COMPOSE_FILES\} up -d --build --force-recreate/
  );
  assert.doesNotMatch(
    script,
    /\nrefresh_service app-configurator\n/,
    'expected app-configurator to use the health-aware refresh path'
  );
});

test('dev-seed.sh includes auxiliary seeders by default', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(script, /DEV_SEED_SKIP_OPTIONAL:-false/);
  assert.match(script, /DEV_SEED_SKIP_OPTIONAL must be true or false/);

  const optionalBlock = script.slice(
    script.indexOf('seed_optional_services()'),
    script.indexOf('refresh_service gateway')
  );

  assert.notEqual(
    optionalBlock,
    '',
    'expected auxiliary seeders to be grouped in a dedicated block'
  );
  for (const marker of [
    'run_seed telos-docs-service',
    'run_seed permissions',
    'SEED_DEMO_FORUM_TOPICS',
  ]) {
    assert.match(optionalBlock, new RegExp(marker));
  }
});

test('dev-seed.sh can skip auxiliary seeders without skipping core fixtures', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(
    script,
    /if \[ "\$\{DEV_SEED_SKIP_OPTIONAL\}" = "true" \]; then[\s\S]*Skipping optional seeders[\s\S]*else[\s\S]*seed_optional_services/
  );

  const coreMarkers = [
    '\nseed_default_owner\n',
    'provision_business_workspace owner',
    'seed_app_configuration owner',
    'verify_seed_configuration owner',
    'register_seed_identity foreign "${foreign_email}" "${foreign_password}" business-site true',
    'provision_business_workspace foreign',
    'seed_app_configuration foreign',
    'verify_seed_configuration foreign',
  ];
  let previousIndex = -1;
  for (const marker of coreMarkers) {
    const markerIndex = script.indexOf(marker);
    assert.ok(markerIndex > previousIndex, `expected core marker: ${marker}`);
    previousIndex = markerIndex;
  }
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

test('dev-seed.sh waits for videos to accept connections before video seeding', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );
  const refreshIndex = script.indexOf('refresh_service videos');
  const readyIndex = script.indexOf(
    'wait_for_videos\nif has_video_seed_media; then\n  run_seed_with_media_volume'
  );
  const seedIndex = script.indexOf(
    'run_seed_with_media_volume videos "${APP_RUNTIME_DIR}" node ./dist/apps/videos/seed-videos.js'
  );

  assert.ok(refreshIndex < readyIndex, 'expected videos to be refreshed first');
  assert.ok(readyIndex < seedIndex, 'expected videos readiness before seeding');
});

test('dev-seed.sh skips video seeding when the optional media library is empty', () => {
  const script = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'dev-seed.sh'),
    'utf8'
  );

  assert.match(script, /has_video_seed_media\(\)/);
  assert.match(
    script,
    /if has_video_seed_media; then\n  run_seed_with_media_volume videos/
  );
  assert.match(script, /Skipping video seed: no supported media files/);
});

test('the dev videos service uses the case-correct mounted TV directory', () => {
  const compose = fs.readFileSync(
    path.join(repoRoot, 'docker-compose.dev.yaml'),
    'utf8'
  );

  assert.match(compose, /VIDEO_SEED_SOURCE_DIR=\/media\/TV/);
  assert.doesNotMatch(compose, /VIDEO_SEED_SOURCE_DIR=\/media\/Tv/);
});

test('video seed refuses to create fake mp4 fallback assets', () => {
  const seed = fs.readFileSync(
    path.join(repoRoot, 'apps', 'videos', 'src', 'seed-videos.ts'),
    'utf8'
  );

  assert.doesNotMatch(seed, /Placeholder video asset/);
  assert.match(seed, /Video seed source directory .* does not exist/);
});

test('videos build uses the Nx webpack executor required by its webpack plugin', () => {
  const project = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'apps', 'videos', 'project.json'),
      'utf8'
    )
  );

  assert.equal(project.targets.build.executor, '@nx/webpack:webpack');
  assert.equal(
    project.targets.build.options.webpackConfig,
    'apps/videos/webpack.config.js'
  );
  assert.equal(project.targets.build.options.outputPath, 'dist/apps/videos');
  assert.equal(project.targets.build.options.deleteOutputPath, false);
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

test('generic Docker seed resolves the app-configurator bundle in dev and production layouts', () => {
  const genericScript = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'run-seed.sh'),
    'utf8'
  );

  assert.match(
    genericScript,
    /\/usr\/src\/app\/dist\/apps\/app-configurator\/seed-script\.js/
  );
  assert.match(genericScript, /\/usr\/src\/app\/seed-script\.js/);
  assert.doesNotMatch(
    genericScript,
    /run_seed_docker "app-configurator" "node seed-script\.js"/
  );
});
