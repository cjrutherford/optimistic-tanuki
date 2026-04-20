#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url);
const packageJson = JSON.parse(
  readFileSync(new URL('package.json', root), 'utf8'),
);

const dockerScripts = Object.entries(packageJson.scripts).filter(([name]) =>
  name.startsWith('docker:'),
);
const referencedScripts = new Set();
const directlyInvokedScripts = new Set();

for (const [, command] of dockerScripts) {
  for (const match of command.matchAll(
    /(?:^|\s)(sh\s+)?(\.\/scripts\/[^\s;&|]+\.sh)\b/g,
  )) {
    const script = match[2];
    const usesShell = Boolean(match[1]);
    if (!usesShell) {
      directlyInvokedScripts.add(script);
    }
    referencedScripts.add(script);
  }
}

assert.deepEqual([...referencedScripts].sort(), [
  './scripts/dev-seed.sh',
  './scripts/docker-build-batched.sh',
  './scripts/docker-start-phased.sh',
  './scripts/prod-seed.sh',
]);

for (const script of referencedScripts) {
  const path = new URL(script.slice(2), root);
  assert.equal(existsSync(path), true, `${script} must exist`);
  if (directlyInvokedScripts.has(script)) {
    assert.equal(
      (statSync(path).mode & 0o111) !== 0,
      true,
      `${script} must be executable`,
    );
  }
}

function collectServiceNames(fileName) {
  const content = readFileSync(new URL(fileName, root), 'utf8');
  const services = new Set();
  let inServices = false;

  for (const line of content.split('\n')) {
    if (line === 'services:') {
      inServices = true;
      continue;
    }
    if (inServices && /^\S/.test(line) && line.trim() !== '') {
      break;
    }
    const match = inServices ? line.match(/^  ([a-zA-Z0-9_-]+):\s*$/) : null;
    if (match) {
      services.add(match[1]);
    }
  }

  return services;
}

const composeServices = new Set([
  ...collectServiceNames('docker-compose.yaml'),
  ...collectServiceNames('docker-compose.dev.yaml'),
]);

const phasedStartupServices = [
  'postgres',
  'redis',
  'db-setup',
  'authentication',
  'profile',
  'social',
  'permissions',
  'app-configurator',
  'system-configurator-api',
  'finance',
  'payments',
  'store',
  'assets',
  'project-planning',
  'chat-collector',
  'prompt-proxy',
  'telos-docs-service',
  'blogging',
  'forum',
  'wellness',
  'classifieds',
  'ai-orchestration',
  'lead-tracker',
  'gateway',
  'app-configurator-seed',
  'ot-client-interface',
  'forgeofwill-client-interface',
  'digital-homestead-client-interface',
  'hai-client-interface',
  'local-hub-client-interface',
  'crdn-client-interface',
  'leads-app',
  'store-client',
  'configurable-client',
  'fin-commander',
  'owner-console',
  'd6',
  'system-configurator',
];

for (const service of phasedStartupServices) {
  assert.equal(
    composeServices.has(service),
    true,
    `${service} must exist in compose files`,
  );
}

const composeYaml = readFileSync(new URL('docker-compose.yaml', root), 'utf8');
const dockerfileReferences = [
  ...composeYaml.matchAll(/^\s+dockerfile:\s+(.+)$/gm),
].map((match) => match[1].replace(/^['"]|['"]$/g, ''));

assert.equal(
  dockerfileReferences.includes('./docker/db-setup/Dockerfile'),
  true,
  'db-setup Dockerfile must be referenced by docker-compose.yaml',
);

for (const dockerfile of dockerfileReferences) {
  const normalizedPath = normalize(dockerfile.replace(/^\.\//, ''));
  const dockerfileUrl = new URL(normalizedPath, root);
  assert.equal(existsSync(dockerfileUrl), true, `${dockerfile} must exist`);
  assert.equal(
    existsSync(new URL(dirname(normalizedPath), root)),
    true,
    `${dirname(dockerfile)} directory must exist`,
  );
}

const tempDir = mkdtempSync(join(tmpdir(), 'docker-bootstrap-'));
const bakeFile = join(tempDir, 'bake.json');
writeFileSync(
  bakeFile,
  JSON.stringify({
    target: {
      'db-setup': {},
      authentication: {},
      gateway: {},
      profile: {},
      'app-configurator-seed': {},
      'store-seed': {},
    },
  }),
);

function execForOutput(command, args, options) {
  try {
    return execFileSync(command, args, options);
  } catch (error) {
    if (
      error?.code === 'EPERM' &&
      error.status === 0 &&
      typeof error.stdout === 'string'
    ) {
      return error.stdout;
    }
    throw error;
  }
}

const buildOutput = execForOutput(
  'bash',
  [
    './scripts/docker-build-batched.sh',
    '--dry-run',
    '2',
    'docker-compose.dev.yaml',
  ],
  {
    cwd: root,
    env: { ...process.env, DOCKER_BUILD_BAKE_FILE: bakeFile },
    encoding: 'utf8',
  },
);

assert.match(
  buildOutput,
  /Compose flags: -f docker-compose\.yaml -f docker-compose\.dev\.yaml/,
);
assert.match(buildOutput, /Found 3 services to build/);
assert.match(buildOutput, /DRY RUN: docker buildx bake -f .* db-setup/);
assert.match(
  buildOutput,
  /DRY RUN: docker buildx bake -f .* authentication gateway/,
);
assert.match(buildOutput, /DRY RUN: docker buildx bake -f .* profile/);
assert.doesNotMatch(buildOutput, /app-configurator-seed|store-seed/);

const startupOutput = execForOutput(
  'bash',
  [
    './scripts/docker-start-phased.sh',
    '--dry-run',
    'docker-compose.dev.yaml',
    '0',
    '--force-recreate',
  ],
  {
    cwd: root,
    encoding: 'utf8',
  },
);

assert.match(
  startupOutput,
  /Compose flags: -f docker-compose\.yaml -f docker-compose\.dev\.yaml/,
);
assert.match(startupOutput, /Extra flags: --force-recreate/);
assert.match(
  startupOutput,
  /DRY RUN: docker compose .* up -d --force-recreate postgres redis/,
);
assert.match(startupOutput, /DRY RUN: docker compose .* wait db-setup/);
assert.match(
  startupOutput,
  /DRY RUN: docker compose .* up -d --no-deps --force-recreate .*gateway/,
);

const seedRuntimeEntries = [
  {
    path: 'dist/apps/telos-docs-service/seed-persona.js',
    label: 'telos docs persona seed',
  },
  {
    path: 'dist/apps/permissions/seed-permissions.js',
    label: 'permissions seed',
  },
  { path: 'dist/apps/store/seed-store.js', label: 'store seed' },
  { path: 'dist/apps/social/seed-social.js', label: 'social seed' },
  {
    path: 'dist/apps/social/seed-local-communities.js',
    label: 'local communities seed',
  },
  {
    path: 'dist/apps/social/seed-community-posts.js',
    label: 'community posts seed',
  },
  {
    path: 'dist/apps/payments/seed-products.js',
    label: 'payments products seed',
  },
  { path: 'dist/apps/videos/seed-videos.js', label: 'videos seed' },
  {
    path: 'dist/apps/classifieds/seed-classifieds.js',
    label: 'classifieds seed',
  },
];

for (const entry of seedRuntimeEntries) {
  assert.equal(
    existsSync(new URL(entry.path, root)),
    true,
    `${entry.label} runtime entry must exist at ${entry.path}`,
  );
}

const devSeedScript = readFileSync(
  new URL('scripts/dev-seed.sh', root),
  'utf8',
);
const prodSeedScript = readFileSync(
  new URL('scripts/prod-seed.sh', root),
  'utf8',
);

for (const token of [
  'run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js',
  'run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js',
  'run_seed store "${APP_RUNTIME_DIR}" node ./seed-store.js',
  'run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-social.js',
  'run_seed_with_run social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js',
  'run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-community-posts.js',
  'run_seed_with_env classifieds "${CLASSIFIEDS_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_BASE_URL}" node ./seed-classifieds.js',
  'run_seed_with_run payments "${APP_RUNTIME_DIR}" node ./seed-products.js',
  'run_seed_with_run videos "${APP_RUNTIME_DIR}" node ./seed-videos.js',
]) {
  assert.equal(
    devSeedScript.includes(token),
    true,
    `dev seed script must include ${token}`,
  );
}

assert.equal(
  prodSeedScript.includes(
    'run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js',
  ),
  true,
  'prod seed script must use the permissions runtime seed entrypoint',
);

const ignoredPackageManagerScanDirs = new Set([
  '.angular',
  '.git',
  '.nx',
  '.vscode',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
  'tmp',
]);
const ignoredPackageManagerScanFiles = new Set([
  'ollama-screener-results-graphs.html',
  'pnpm-lock.yaml',
  'scripts/validate-docker-bootstrap.mjs',
  'tools/stack-client/stack-client',
]);
const ignoredPackageManagerScanExtensions = new Set([
  '.db',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
]);

const forbiddenPackageManagerPatterns = [
  {
    pattern: /\bnpm\s+(?:run|install|ci|i|audit|start)\b/,
    label: 'npm command',
  },
  { pattern: /\bnpx\b/, label: 'npx command' },
  { pattern: /package-lock\.json/, label: 'package-lock.json reference' },
  { pattern: /package\*\.json/, label: 'package*.json Docker copy glob' },
  {
    pattern: /pnpm install --legacy-peer-deps/,
    label: 'legacy npm peer flag on pnpm install',
  },
  {
    pattern: /--omit=dev --legacy-peer-deps/,
    label: 'legacy npm peer flag on production install',
  },
  {
    pattern: /RUN .*pnpm install --frozen-lockfile\s+\S/,
    label: 'pnpm install used where pnpm add is required',
  },
];

function collectFiles(dirUrl, relativeDir = '') {
  const files = [];
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoredPackageManagerScanDirs.has(entry.name)) {
        continue;
      }
      files.push(
        ...collectFiles(
          new URL(`${entry.name}/`, dirUrl),
          join(relativeDir, entry.name),
        ),
      );
      continue;
    }

    const file = join(relativeDir, entry.name);
    const extension = entry.name.includes('.')
      ? entry.name.slice(entry.name.lastIndexOf('.'))
      : '';
    if (
      !entry.isFile() ||
      ignoredPackageManagerScanFiles.has(entry.name) ||
      ignoredPackageManagerScanFiles.has(file) ||
      ignoredPackageManagerScanExtensions.has(extension)
    ) {
      continue;
    }
    files.push(file);
  }
  return files;
}

const packageManagerViolations = [];
for (const file of collectFiles(root)) {
  const content = readFileSync(new URL(file, root), 'utf8');
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes('cdn.jsdelivr.net/npm/')) {
      continue;
    }
    for (const { pattern, label } of forbiddenPackageManagerPatterns) {
      if (pattern.test(line)) {
        packageManagerViolations.push(`${file}:${index + 1}: ${label}`);
      }
    }
  }
}

assert.deepEqual(
  packageManagerViolations,
  [],
  'package operations must use pnpm',
);
